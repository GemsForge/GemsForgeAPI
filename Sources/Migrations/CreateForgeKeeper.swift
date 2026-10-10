import Fluent

/// Creates the hierarchical table for pages within each Gem Life domain.
struct CreateForgeKeeper: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("forgekeeper")
            .field("id", .string, .identifier(auto: false))
            .field("parent_id", .string, .references("forgekeeper", "id", onDelete: .cascade, onUpdate: .cascade))
            .field("domain_id", .string, .required, .references("domains", "id", onDelete: .restrict, onUpdate: .cascade))
            .field("title", .string, .required)
            .field("description", .string, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("forgekeeper").delete()
    }
}
