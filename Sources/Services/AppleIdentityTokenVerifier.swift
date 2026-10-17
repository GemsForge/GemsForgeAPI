import Crypto
import Foundation
import JWTKit

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

protocol AppleIdentityTokenValidating: Sendable {
    func verify(identityToken: String, expectedNonceHash: String) async throws
        -> VerifiedAppleIdentity
}

struct VerifiedAppleIdentity: Sendable {
    let subject: String
}

struct AppleIdentityTokenVerifier: AppleIdentityTokenValidating {
    private let clientID: String
    private let jwksCache: AppleJWKSCache
    private let staticJWKSJSON: String?

    init(clientID: String, jwksCache: AppleJWKSCache = .shared, jwksJSON: String? = nil) {
        self.clientID = clientID
        self.jwksCache = jwksCache
        self.staticJWKSJSON = jwksJSON
    }

    func verify(identityToken: String, expectedNonceHash: String) async throws
        -> VerifiedAppleIdentity
    {
        let tokenParts = identityToken.split(separator: ".", omittingEmptySubsequences: false)
        guard identityToken.utf8.count <= 16_384,
            tokenParts.count == 3,
            let headerData = Data(base64URL: String(tokenParts[0])),
            let header = try? JSONDecoder().decode(AppleJWTHeader.self, from: headerData),
            header.algorithm == "RS256",
            let keyID = header.keyID,
            !keyID.isEmpty
        else {
            throw AppleAuthenticationError.invalidIdentityToken
        }

        var jwksJSON: String
        do {
            if let staticJWKSJSON {
                jwksJSON = staticJWKSJSON
            } else {
                jwksJSON = try await jwksCache.json()
            }
            if !Self.contains(keyID: keyID, in: jwksJSON), staticJWKSJSON == nil {
                jwksJSON = try await jwksCache.json(forceRefresh: true)
            }
        } catch {
            throw AppleAuthenticationError.verificationUnavailable
        }
        guard Self.contains(keyID: keyID, in: jwksJSON) else {
            throw AppleAuthenticationError.invalidIdentityToken
        }

        let keys: JWTKeyCollection
        do {
            keys = try await JWTKeyCollection().add(jwksJSON: jwksJSON)
        } catch {
            throw AppleAuthenticationError.verificationUnavailable
        }
        let payload: AppleIdentityToken
        do {
            payload = try await keys.verify(identityToken, as: AppleIdentityToken.self)
        } catch {
            throw AppleAuthenticationError.invalidIdentityToken
        }

        do {
            try payload.audience.verifyIntendedAudience(includes: clientID)
        } catch {
            throw AppleAuthenticationError.invalidIdentityToken
        }
        guard payload.issuedAt.value <= Date().addingTimeInterval(30),
            let nonce = payload.nonce,
            Self.constantTimeEqual(Self.sha256Hex(nonce), expectedNonceHash),
            !payload.subject.value.isEmpty
        else {
            throw AppleAuthenticationError.invalidIdentityToken
        }
        return VerifiedAppleIdentity(subject: payload.subject.value)
    }

    private static func contains(keyID: String, in json: String) -> Bool {
        guard let data = json.data(using: .utf8),
            let keySet = try? JSONDecoder().decode(AppleJWKS.self, from: data)
        else { return false }
        return keySet.keys.contains {
            $0.keyID == keyID && $0.keyType == "RSA" && $0.algorithm == "RS256"
        }
    }

    private static func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func constantTimeEqual(_ lhs: String, _ rhs: String) -> Bool {
        let left = Array(lhs.utf8)
        let right = Array(rhs.utf8)
        guard left.count == right.count else { return false }
        return zip(left, right).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }
}

private struct AppleJWTHeader: Decodable {
    let algorithm: String
    let keyID: String?

    enum CodingKeys: String, CodingKey {
        case algorithm = "alg"
        case keyID = "kid"
    }
}

private struct AppleJWKS: Decodable {
    let keys: [AppleJWK]
}

private struct AppleJWK: Decodable {
    let keyType: String
    let keyID: String
    let algorithm: String?

    enum CodingKeys: String, CodingKey {
        case keyType = "kty"
        case keyID = "kid"
        case algorithm = "alg"
    }
}

actor AppleJWKSCache {
    static let shared = AppleJWKSCache()
    private let fetcher: @Sendable () async throws -> String
    private var cachedJSON: String?
    private var expiresAt = Date.distantPast
    private var lastForcedRefresh = Date.distantPast

    init() {
        self.fetcher = { try await AppleJWKSCache.fetchAppleJWKS() }
    }

    init(fetcher: @escaping @Sendable () async throws -> String) {
        self.fetcher = fetcher
    }

    func json(forceRefresh: Bool = false) async throws -> String {
        let now = Date()
        if forceRefresh, now.timeIntervalSince(lastForcedRefresh) < 60, let cachedJSON {
            return cachedJSON
        }
        if !forceRefresh, now < expiresAt, let cachedJSON { return cachedJSON }

        let json = try await fetcher()
        guard json.utf8.count <= 65_536,
            AppleIdentityTokenVerifier.containsValidKeySet(json)
        else {
            throw AppleAuthenticationError.verificationUnavailable
        }
        cachedJSON = json
        expiresAt = now.addingTimeInterval(3600)
        if forceRefresh { lastForcedRefresh = now }
        return json
    }

    private static func fetchAppleJWKS() async throws -> String {
        let url = URL(string: "https://appleid.apple.com/auth/keys")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse,
            (200..<300).contains(response.statusCode),
            data.count <= 65_536,
            let json = String(data: data, encoding: .utf8)
        else {
            throw AppleAuthenticationError.verificationUnavailable
        }
        return json
    }
}

extension AppleIdentityTokenVerifier {
    fileprivate static func containsValidKeySet(_ json: String) -> Bool {
        guard let data = json.data(using: .utf8),
            let keySet = try? JSONDecoder().decode(AppleJWKS.self, from: data)
        else { return false }
        return keySet.keys.contains { $0.keyType == "RSA" && $0.algorithm == "RS256" }
    }
}

extension Data {
    fileprivate init?(base64URL value: String) {
        var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(
            of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder != 0 { base64.append(String(repeating: "=", count: 4 - remainder)) }
        self.init(base64Encoded: base64)
    }
}
