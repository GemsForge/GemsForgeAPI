import Fluent

/// Adds a server-authored last-update value to legacy tables that lacked one.
struct AddAddressUpdatedAt: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Address.schema).field("DateUpdated", .string).update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Address.schema).deleteField("DateUpdated").update()
    }
}

struct AddEducationUpdatedAt: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Education.schema).field("DateUpdated", .string).update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Education.schema).deleteField("DateUpdated").update()
    }
}

struct AddEmploymentUpdatedAt: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Employment.schema).field("DateUpdated", .string).update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Employment.schema).deleteField("DateUpdated").update()
    }
}
