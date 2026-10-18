import Fluent
import Foundation
import JWTKit
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

struct SupabaseAuthenticationConfiguration: Sendable {
    let issuer: String
    let jwksURL: URL
    let ownerSubject: String
    let ownerAccountID: String
    let sessionLifetime: TimeInterval

    static func fromEnvironment(_ lookup: (String) -> String? = Environment.get) -> Self? {
        guard let rawURL = lookup("SUPABASE_URL")?.trimmingCharacters(in: .whitespacesAndNewlines),
            let projectURL = URL(string: rawURL),
            projectURL.scheme == "https",
            projectURL.host != nil,
            let ownerSubject = lookup("SUPABASE_OWNER_SUBJECT")?.trimmingCharacters(in: .whitespacesAndNewlines),
            !ownerSubject.isEmpty,
            let ownerAccountID = lookup("GEM_LIFE_OPERATOR_ACCOUNT_ID")?.trimmingCharacters(in: .whitespacesAndNewlines),
            !ownerAccountID.isEmpty
        else { return nil }

        let normalizedProjectURL = projectURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let authURL = URL(string: normalizedProjectURL + "/auth/v1") else { return nil }
        let issuer = authURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let lifetime: TimeInterval
        if let rawLifetime = lookup("API_SESSION_LIFETIME_SECONDS") {
            guard let parsed = TimeInterval(rawLifetime), (60...7_776_000).contains(parsed) else { return nil }
            lifetime = parsed
        } else {
            lifetime = 2_592_000
        }
        return Self(
            issuer: issuer,
            jwksURL: authURL.appending(path: ".well-known/jwks.json"),
            ownerSubject: ownerSubject,
            ownerAccountID: ownerAccountID,
            sessionLifetime: lifetime
        )
    }
}

struct SupabaseSessionResponse: Content, Sendable {
    let sessionToken: String
    let expiresAt: Date
}

struct VerifiedSupabaseIdentity: Sendable {
    let issuer: String
    let subject: String
}

protocol SupabaseAccessTokenValidating: Sendable {
    func verify(accessToken: String) async throws -> VerifiedSupabaseIdentity
}

enum SupabaseAuthenticationError: Error {
    case invalidToken
    case verificationUnavailable
    case ownerNotAllowed
    case identityConflict
}

struct SupabaseAuthenticationService: Sendable {
    let configuration: SupabaseAuthenticationConfiguration
    let tokenValidator: any SupabaseAccessTokenValidating

    init(configuration: SupabaseAuthenticationConfiguration, tokenValidator: (any SupabaseAccessTokenValidating)? = nil) {
        self.configuration = configuration
        self.tokenValidator = tokenValidator ?? SupabaseAccessTokenVerifier(configuration: configuration)
    }

    func signIn(accessToken: String, on database: any Database, now: Date = Date()) async throws -> SupabaseSessionResponse {
        let identity = try await tokenValidator.verify(accessToken: accessToken)
        guard identity.issuer == configuration.issuer,
            identity.subject == configuration.ownerSubject else { throw SupabaseAuthenticationError.ownerNotAllowed }

        return try await database.transaction { transaction in
            let account: AuthenticationAccount
            if let existingIdentity = try await AuthenticationIdentity.query(on: transaction)
                .filter(\.$issuer == identity.issuer)
                .filter(\.$subject == identity.subject)
                .first() {
                guard existingIdentity.$account.id == configuration.ownerAccountID,
                    let existingAccount = try await AuthenticationAccount.find(configuration.ownerAccountID, on: transaction)
                else { throw SupabaseAuthenticationError.identityConflict }
                account = existingAccount
            } else {
                if let existingAccount = try await AuthenticationAccount.find(configuration.ownerAccountID, on: transaction) {
                    account = existingAccount
                } else {
                    account = AuthenticationAccount(id: configuration.ownerAccountID)
                    try await account.save(on: transaction)
                }
                try await AuthenticationIdentity(
                    accountID: configuration.ownerAccountID,
                    issuer: identity.issuer,
                    subject: identity.subject
                ).save(on: transaction)
            }

            if try await Hub.query(on: transaction).filter(\.$accountID == configuration.ownerAccountID).first() == nil {
                try await Hub(accountID: configuration.ownerAccountID).save(on: transaction)
            }

            let session = try await AuthenticationSessionService.issue(
                accountID: account.requireID(),
                on: transaction,
                now: now,
                lifetime: configuration.sessionLifetime
            )
            return SupabaseSessionResponse(sessionToken: session.token, expiresAt: session.expiresAt)
        }
    }
}

private struct SupabaseAccessToken: JWTPayload {
    let issuer: IssuerClaim
    let subject: SubjectClaim
    let audience: AudienceClaim
    let expiration: ExpirationClaim
    let issuedAt: IssuedAtClaim

    enum CodingKeys: String, CodingKey {
        case issuer = "iss"
        case subject = "sub"
        case audience = "aud"
        case expiration = "exp"
        case issuedAt = "iat"
    }

    func verify(using _: some JWTAlgorithm) throws {
        guard subject.value.isEmpty == false else {
            throw JWTError.claimVerificationFailure(failedClaim: subject, reason: "missing subject")
        }
        try audience.verifyIntendedAudience(includes: "authenticated")
        try expiration.verifyNotExpired()
        guard issuedAt.value <= Date().addingTimeInterval(30) else {
            throw JWTError.claimVerificationFailure(failedClaim: issuedAt, reason: "issued in the future")
        }
    }
}

private struct SupabaseJWTHeader: Decodable {
    let algorithm: String
    let keyID: String?

    enum CodingKeys: String, CodingKey {
        case algorithm = "alg"
        case keyID = "kid"
    }
}

struct SupabaseAccessTokenVerifier: SupabaseAccessTokenValidating {
    private let configuration: SupabaseAuthenticationConfiguration
    private let jwksCache: SupabaseJWKSCache
    private let staticJWKSJSON: String?

    init(configuration: SupabaseAuthenticationConfiguration, jwksCache: SupabaseJWKSCache? = nil, jwksJSON: String? = nil) {
        self.configuration = configuration
        self.jwksCache = jwksCache ?? SupabaseJWKSCache(url: configuration.jwksURL)
        self.staticJWKSJSON = jwksJSON
    }

    func verify(accessToken: String) async throws -> VerifiedSupabaseIdentity {
        let parts = accessToken.split(separator: ".", omittingEmptySubsequences: false)
        guard accessToken.utf8.count <= 16_384,
            parts.count == 3,
            let headerData = Data(base64URL: String(parts[0])),
            let header = try? JSONDecoder().decode(SupabaseJWTHeader.self, from: headerData),
            ["ES256", "RS256"].contains(header.algorithm),
            let keyID = header.keyID,
            !keyID.isEmpty else { throw SupabaseAuthenticationError.invalidToken }

        let jwks: String
        do {
            if let staticJWKSJSON {
                jwks = staticJWKSJSON
            } else {
                jwks = try await jwksCache.json()
            }
        } catch {
            throw SupabaseAuthenticationError.verificationUnavailable
        }
        guard await jwksCache.contains(keyID: keyID, algorithm: header.algorithm, json: jwks) else {
            throw SupabaseAuthenticationError.invalidToken
        }

        do {
            let keys = try await JWTKeyCollection().add(jwksJSON: staticJWKSJSON ?? jwks)
            let payload = try await keys.verify(accessToken, as: SupabaseAccessToken.self)
            guard payload.issuer.value == configuration.issuer else { throw SupabaseAuthenticationError.invalidToken }
            return VerifiedSupabaseIdentity(issuer: payload.issuer.value, subject: payload.subject.value)
        } catch let error as SupabaseAuthenticationError {
            throw error
        } catch {
            throw SupabaseAuthenticationError.invalidToken
        }
    }
}

actor SupabaseJWKSCache {
    private let url: URL
    private let fetcher: @Sendable () async throws -> String
    private var cachedJSON: String?
    private var expiresAt = Date.distantPast

    init(url: URL, fetcher: (@Sendable () async throws -> String)? = nil) {
        self.url = url
        self.fetcher = fetcher ?? { try await Self.fetch(url: url) }
    }

    func json() async throws -> String {
        if Date() < expiresAt, let cachedJSON { return cachedJSON }
        let value = try await fetcher()
        guard value.utf8.count <= 65_536,
            let data = value.data(using: .utf8),
            let jwks = try? JSONDecoder().decode(SupabaseJWKS.self, from: data),
            !jwks.keys.isEmpty else { throw SupabaseAuthenticationError.verificationUnavailable }
        cachedJSON = value
        expiresAt = Date().addingTimeInterval(600)
        return value
    }

    func contains(keyID: String, algorithm: String, json: String) -> Bool {
        guard let data = json.data(using: .utf8), let jwks = try? JSONDecoder().decode(SupabaseJWKS.self, from: data) else { return false }
        let expectedType = algorithm == "ES256" ? "EC" : "RSA"
        return jwks.keys.contains { $0.keyID == keyID && $0.keyType == expectedType && ($0.algorithm == nil || $0.algorithm == algorithm) }
    }

    private static func fetch(url: URL) async throws -> String {
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
            data.count <= 65_536, let json = String(data: data, encoding: .utf8) else {
            throw SupabaseAuthenticationError.verificationUnavailable
        }
        return json
    }
}

private struct SupabaseJWKS: Decodable {
    let keys: [SupabaseJWK]
}

private struct SupabaseJWK: Decodable {
    let keyType: String
    let keyID: String
    let algorithm: String?

    enum CodingKeys: String, CodingKey {
        case keyType = "kty"
        case keyID = "kid"
        case algorithm = "alg"
    }
}

private extension Data {
    init?(base64URL value: String) {
        var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder != 0 { base64.append(String(repeating: "=", count: 4 - remainder)) }
        self.init(base64Encoded: base64)
    }
}
