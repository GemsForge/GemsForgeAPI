import Fluent

/// Changes the legacy EmailUpdated text column to a nullable boolean.
struct MakeServiceAccountEmailUpdatedBoolean: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema)
            .updateField("EmailUpdated", .bool)
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema)
            .updateField("EmailUpdated", .string)
            .update()
    }
}
