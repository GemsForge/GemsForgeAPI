import Crypto
import Fluent
import Foundation
import Vapor

struct AppleAuthenticationConfiguration: Sendable {
    let clientID: String
    let sessionLifetime: TimeInterval
    let challengeLifetime: TimeInterval

    static func fromEnvironment(_ lookup: (String) -> String? = Environment.get) -> Self? {
        guard
            let clientID = lookup("APPLE_CLIENT_ID")?.trimmingCharacters(
                in: .whitespacesAndNewlines),
            !clientID.isEmpty
        else { return nil }
        let sessionLifetime: TimeInterval
        if let configuredLifetime = lookup("APPLE_SESSION_LIFETIME_SECONDS") {
            guard let parsedLifetime = TimeInterval(configuredLifetime) else { return nil }
            sessionLifetime = parsedLifetime
        } else {
            sessionLifetime = 2_592_000
        }
        guard (60...7_776_000).contains(sessionLifetime) else { return nil }
        return Self(clientID: clientID, sessionLifetime: sessionLifetime, challengeLifetime: 300)
    }
}

struct AppleChallengeResponse: Content, Sendable {
    let challengeID: String
    let nonce: String
    let expiresAt: Date
}

struct AppleSignInRequest: Content, Sendable {
    let challengeID: String
    let identityToken: String
}

struct AppleSessionResponse: Content, Sendable {
    let accountID: String
    let sessionToken: String
    let expiresAt: Date
}

enum AppleAuthenticationError: Error {
    case verificationUnavailable
    case invalidIdentityToken
    case invalidChallenge
}

struct AppleAuthenticationService: Sendable {
    let configuration: AppleAuthenticationConfiguration
    let tokenValidator: any AppleIdentityTokenValidating

    init(
        configuration: AppleAuthenticationConfiguration,
        tokenValidator: (any AppleIdentityTokenValidating)? = nil
    ) {
        self.configuration = configuration
        self.tokenValidator =
            tokenValidator ?? AppleIdentityTokenVerifier(clientID: configuration.clientID)
    }

    func createChallenge(on database: any Database, now: Date = Date()) async throws
        -> AppleChallengeResponse
    {
        let nonce = Self.randomToken(byteCount: 32)
        let challenge = AppleAuthChallenge(
            nonceHash: Self.sha256Hex(nonce),
            expiresAt: now.addingTimeInterval(configuration.challengeLifetime)
        )
        try await challenge.save(on: database)
        return AppleChallengeResponse(
            challengeID: try challenge.requireID(),
            nonce: nonce,
            expiresAt: challenge.expiresAt
        )
    }

    func signIn(_ input: AppleSignInRequest, on database: any Database, now: Date = Date())
        async throws -> AppleSessionResponse
    {
        guard let challenge = try await AppleAuthChallenge.find(input.challengeID, on: database),
            challenge.consumedAt == nil,
            challenge.expiresAt > now
        else {
            throw AppleAuthenticationError.invalidChallenge
        }
        let identity = try await tokenValidator.verify(
            identityToken: input.identityToken,
            expectedNonceHash: challenge.nonceHash
        )

        return try await database.transaction { transaction in
            guard
                let currentChallenge = try await AppleAuthChallenge.find(
                    input.challengeID, on: transaction),
                currentChallenge.consumedAt == nil,
                currentChallenge.expiresAt > now,
                Self.constantTimeEqual(currentChallenge.nonceHash, challenge.nonceHash)
            else {
                throw AppleAuthenticationError.invalidChallenge
            }
            currentChallenge.consumedAt = now
            try await currentChallenge.save(on: transaction)

            let account: AppleAccount
            if let existing = try await AppleAccount.query(on: transaction)
                .filter(\.$appleSubject == identity.subject).first()
            {
                account = existing
            } else {
                account = AppleAccount(appleSubject: identity.subject)
                try await account.save(on: transaction)
            }

            let accountID = try account.requireID()
            if try await Hub.query(on: transaction)
                .filter(\.$accountID == accountID).first() == nil
            {
                try await Hub(accountID: accountID).save(on: transaction)
            }

            let sessionToken = Self.randomToken(byteCount: 32)
            let expiresAt = now.addingTimeInterval(configuration.sessionLifetime)
            let session = AuthenticationSession(
                accountID: accountID,
                tokenHash: Self.sha256Hex(sessionToken),
                expiresAt: expiresAt
            )
            try await session.save(on: transaction)
            return AppleSessionResponse(
                accountID: accountID,
                sessionToken: sessionToken,
                expiresAt: expiresAt
            )
        }
    }

    func revokeSession(token: String, on database: any Database, now: Date = Date()) async throws {
        let tokenHash = Self.sha256Hex(token)
        guard
            let session = try await AuthenticationSession.query(on: database)
                .filter(\.$tokenHash == tokenHash).first(),
            session.revokedAt == nil
        else { return }
        session.revokedAt = now
        try await session.save(on: database)
    }

    func validAccountID(
        forSessionToken token: String, on database: any Database, now: Date = Date()
    ) async throws -> String? {
        try await Self.validAccountID(forSessionToken: token, on: database, now: now)
    }

    static func validAccountID(
        forSessionToken token: String, on database: any Database, now: Date = Date()
    ) async throws -> String? {
        let tokenHash = Self.sha256Hex(token)
        guard
            let session = try await AuthenticationSession.query(on: database)
                .filter(\.$tokenHash == tokenHash).first(),
            session.revokedAt == nil,
            session.expiresAt > now
        else { return nil }
        return session.accountID
    }

    private static func randomToken(byteCount: Int) -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<byteCount).map { _ in UInt8.random(in: .min ... .max, using: &generator) }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
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
