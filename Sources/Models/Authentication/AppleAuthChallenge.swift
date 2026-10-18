import Fluent
import Foundation

/// Holds a short-lived one-time nonce digest to prevent identity-token replay.
final class AppleAuthChallenge: Model, @unchecked Sendable {
    static let schema = "AppleAuthChallenges"

    @ID(custom: "ChallengeID")
    var id: String?

    @Field(key: "NonceHash")
    var nonceHash: String

    @Field(key: "ExpiresAt")
    var expiresAt: Date

    @OptionalField(key: "ConsumedAt")
    var consumedAt: Date?

    init() {}

    init(id: String = UUID().uuidString, nonceHash: String, expiresAt: Date) {
        self.id = id
        self.nonceHash = nonceHash
        self.expiresAt = expiresAt
    }
}
