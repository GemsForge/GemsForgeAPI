import Fluent
import SQLKit

/// Replaces the Apple-specific account root with provider-independent accounts
/// while preserving existing account IDs, identity records, and hubs.
struct MakeAuthenticationProviderAgnostic: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw AuthenticationSchemaMigrationError.unsupportedDatabase
        }

        try await sql.raw(#"CREATE TABLE "Accounts" ("AccountID" TEXT PRIMARY KEY NOT NULL, "CreatedAt" DATETIME)"#).run()
        try await sql.raw(#"INSERT INTO "Accounts" ("AccountID", "CreatedAt") SELECT "AccountID", "CreatedAt" FROM "AppleAccounts""#).run()

        try await database.schema(AuthenticationIdentity.schema)
            .field("IdentityID", .string, .identifier(auto: false))
            .field("AccountID", .string, .required, .references(
                AuthenticationAccount.schema, "AccountID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("Issuer", .string, .required)
            .field("Subject", .string, .required)
            .field("CreatedAt", .datetime)
            .unique(on: "Issuer", "Subject")
            .create()

        try await sql.raw(#"INSERT INTO "AccountIdentities" ("IdentityID", "AccountID", "Issuer", "Subject", "CreatedAt") SELECT lower(hex(randomblob(16))), "AccountID", 'https://appleid.apple.com', "AppleSubject", "CreatedAt" FROM "AppleAccounts""#).run()

        // Rebuild Hubs so its foreign key targets Accounts. Resource records
        // reference HubID as data fields and are intentionally not modified.
        try await sql.raw(#"ALTER TABLE "Hubs" RENAME TO "Hubs_AppleAccounts""#).run()
        try await sql.raw(#"CREATE TABLE "Hubs" ("HubID" TEXT PRIMARY KEY NOT NULL, "AccountID" TEXT NOT NULL REFERENCES "Accounts"("AccountID") ON DELETE CASCADE ON UPDATE CASCADE, "Name" TEXT NOT NULL, "CreatedAt" DATETIME, UNIQUE ("AccountID"))"#).run()
        try await sql.raw(#"INSERT INTO "Hubs" ("HubID", "AccountID", "Name", "CreatedAt") SELECT "HubID", "AccountID", "Name", "CreatedAt" FROM "Hubs_AppleAccounts""#).run()
        try await sql.raw(#"DROP TABLE "Hubs_AppleAccounts""#).run()
        try await sql.raw(#"DROP TABLE "AppleAuthChallenges""#).run()
        try await sql.raw(#"DROP TABLE "AppleAccounts""#).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw AuthenticationSchemaMigrationError.unsupportedDatabase
        }
        let nonAppleIdentity = try await sql.raw(#"SELECT COUNT(*) AS "count" FROM "AccountIdentities" WHERE "Issuer" != 'https://appleid.apple.com'"#).first()
        guard try nonAppleIdentity?.decode(column: "count", as: Int.self) == 0 else {
            throw AuthenticationSchemaMigrationError.cannotRevertWithNonAppleIdentities
        }

        try await sql.raw(#"CREATE TABLE "AppleAccounts" ("AccountID" TEXT PRIMARY KEY NOT NULL, "AppleSubject" TEXT NOT NULL UNIQUE, "CreatedAt" DATETIME)"#).run()
        try await sql.raw(#"INSERT INTO "AppleAccounts" ("AccountID", "AppleSubject", "CreatedAt") SELECT "AccountID", "Subject", "CreatedAt" FROM "AccountIdentities" WHERE "Issuer" = 'https://appleid.apple.com'"#).run()
        try await sql.raw(#"CREATE TABLE "AppleAuthChallenges" ("ChallengeID" TEXT PRIMARY KEY NOT NULL, "NonceHash" TEXT NOT NULL, "ExpiresAt" DATETIME NOT NULL, "ConsumedAt" DATETIME)"#).run()
        try await sql.raw(#"ALTER TABLE "Hubs" RENAME TO "Hubs_Accounts""#).run()
        try await sql.raw(#"CREATE TABLE "Hubs" ("HubID" TEXT PRIMARY KEY NOT NULL, "AccountID" TEXT NOT NULL REFERENCES "AppleAccounts"("AccountID") ON DELETE CASCADE ON UPDATE CASCADE, "Name" TEXT NOT NULL, "CreatedAt" DATETIME, UNIQUE ("AccountID"))"#).run()
        try await sql.raw(#"INSERT INTO "Hubs" ("HubID", "AccountID", "Name", "CreatedAt") SELECT "HubID", "AccountID", "Name", "CreatedAt" FROM "Hubs_Accounts""#).run()
        try await sql.raw(#"DROP TABLE "Hubs_Accounts""#).run()
        try await sql.raw(#"DROP TABLE "AccountIdentities""#).run()
        try await sql.raw(#"DROP TABLE "Accounts""#).run()
    }
}

enum AuthenticationSchemaMigrationError: Error {
    case unsupportedDatabase
    case cannotRevertWithNonAppleIdentities
}
