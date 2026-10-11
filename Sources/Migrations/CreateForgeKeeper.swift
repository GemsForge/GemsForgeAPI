import Fluent

/// Creates the hierarchical table for pages within each Gem Life domain.
struct CreateForgeKeeper: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("ForgeKeeper")
            .field("ForgeKeeperID", .int, .identifier(auto: true))
            .field("ParentID", .int, .references("ForgeKeeper", "ForgeKeeperID", onDelete: .restrict, onUpdate: .cascade))
            .field("DomainID", .string, .required, .references("Domains", "DomainID", onDelete: .restrict, onUpdate: .cascade))
            .field("Title", .string, .required)
            .field("Description", .string)
            .field("DateCreated", .datetime, .required)
            .field("DateUpdated", .datetime, .required)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("ForgeKeeper").delete()
    }
}
