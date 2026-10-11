import Fluent

/// Defines the infrastructure table used to audit live schema changes.
struct CreateSchemaMigrationAudits: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(SchemaMigrationAudit.schema)
            .field("AuditID", .string, .identifier(auto: false))
            .field("MigrationName", .string, .required)
            .field("AppliedAt", .datetime, .required)
            .field("Result", .string, .required)
            .field("DatabaseIdentity", .string, .required)
            .field("BackupFileName", .string)
            .field("FailureDetails", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(SchemaMigrationAudit.schema).delete()
    }
}
