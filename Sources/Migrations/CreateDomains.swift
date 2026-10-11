import Fluent

/// Defines the existing Domains schema for isolated tests.
struct CreateDomains: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("Domains")
            .field("DomainID", .string, .identifier(auto: false))
            .field("Title", .string, .required)
            .field("Description", .string)
            .field("DateCreated", .datetime, .required)
            .field("DateUpdated", .datetime, .required)
            .unique(on: "Title")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("Domains").delete()
    }
}
