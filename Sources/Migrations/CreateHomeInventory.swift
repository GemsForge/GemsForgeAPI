import Fluent

/// Defines the HomeInventory pilot schema for isolated local databases and tests.
///
/// The production API does not run this migration against the personal database
/// automatically. It becomes available through the approved local development
/// profile and can later be reviewed by the schema-builder workflow.
struct CreateHomeInventory: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(HomeInventory.schema)
            .field("InventoryID", .string, .identifier(auto: false))
            .field("ItemName", .string, .required)
            .field("Category", .string)
            .field("Description", .string)
            .field("Quantity", .int, .required)
            .field("PurchaseDate", .string)
            .field("PurchasePrice", .double)
            .field("CurrentValue", .double)
            .field("Condition", .string)
            .field("Location", .string)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(HomeInventory.schema).delete()
    }
}
