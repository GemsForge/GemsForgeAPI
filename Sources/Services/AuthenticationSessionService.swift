import Crypto
import Fluent
import Foundation

/// Issues and validates opaque API sessions independently of the sign-in provider.
struct AuthenticationSessionService: Sendable {
    func revokeSession(token: String, on database: any Database, now: Date = Date()) async throws {
        let tokenHash = Self.sha256Hex(token)
        guard let session = try await AuthenticationSession.query(on: database)
            .filter(\.$tokenHash == tokenHash).first(), session.revokedAt == nil else { return }
        session.revokedAt = now
        try await session.save(on: database)
    }

    static func issue(accountID: String, on database: any Database, now: Date = Date(), lifetime: TimeInterval = 2_592_000) async throws -> (token: String, expiresAt: Date) {
        let token = randomToken(byteCount: 32)
        let expiresAt = now.addingTimeInterval(lifetime)
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: sha256Hex(token),
            expiresAt: expiresAt
        ).save(on: database)
        return (token, expiresAt)
    }

    static func validAccountID(forSessionToken token: String, on database: any Database, now: Date = Date()) async throws -> String? {
        let tokenHash = sha256Hex(token)
        guard let session = try await AuthenticationSession.query(on: database)
            .filter(\.$tokenHash == tokenHash).first(),
            session.revokedAt == nil,
            session.expiresAt > now else { return nil }
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
}
