import Fluent

/// Creates identity, one-time challenge, and revocable-session tables.
struct CreateAuthenticationSchema: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(AppleAccount.schema)
            .field("AccountID", .string, .identifier(auto: false))
            .field("AppleSubject", .string, .required)
            .field("CreatedAt", .datetime)
            .unique(on: "AppleSubject")
            .create()

        try await database.schema(AppleAuthChallenge.schema)
            .field("ChallengeID", .string, .identifier(auto: false))
            .field("NonceHash", .string, .required)
            .field("ExpiresAt", .datetime, .required)
            .field("ConsumedAt", .datetime)
            .create()

        try await database.schema(AuthenticationSession.schema)
            .field("SessionID", .string, .identifier(auto: false))
            .field("AccountID", .string, .required)
            .field("TokenHash", .string, .required)
            .field("ExpiresAt", .datetime, .required)
            .field("RevokedAt", .datetime)
            .field("CreatedAt", .datetime)
            .unique(on: "TokenHash")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(AuthenticationSession.schema).delete()
        try await database.schema(AppleAuthChallenge.schema).delete()
        try await database.schema(AppleAccount.schema).delete()
    }
}
