import Fluent
import Foundation

/// Represents one revocable application session; only its token digest is stored.
final class AuthenticationSession: Model, @unchecked Sendable {
    static let schema = "AuthenticationSessions"

    @ID(custom: "SessionID")
    var id: String?

    @Field(key: "AccountID")
    var accountID: String

    @Field(key: "TokenHash")
    var tokenHash: String

    @Field(key: "ExpiresAt")
    var expiresAt: Date

    @OptionalField(key: "RevokedAt")
    var revokedAt: Date?

    @Timestamp(key: "CreatedAt", on: .create)
    var createdAt: Date?

    init() {}

    init(
        id: String = UUID().uuidString,
        accountID: String,
        tokenHash: String,
        expiresAt: Date
    ) {
        self.id = id
        self.accountID = accountID
        self.tokenHash = tokenHash
        self.expiresAt = expiresAt
    }
}
