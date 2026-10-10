import Fluent

/// Creates the four top-level Gem Life domains.
struct CreateDomains: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("domains")
            .field("id", .string, .identifier(auto: false))
            .field("title", .string, .required)
            .field("description", .string, .required)
            .field("notes", .string)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "title")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("domains").delete()
    }
}
