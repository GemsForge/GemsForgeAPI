import Fluent

/// Creates an explicit, account-owned hub. Existing data remains unassigned.
struct CreateHubs: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Hub.schema)
            .field("HubID", .string, .identifier(auto: false))
            .field("AccountID", .string, .required, .references(
                AppleAccount.schema, "AccountID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("Name", .string, .required)
            .field("CreatedAt", .datetime)
            .unique(on: "AccountID")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Hub.schema).delete()
    }
}
