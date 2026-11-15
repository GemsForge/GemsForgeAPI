import Fluent
import SQLKit

/// Creates the Hub-scoped identity map used to keep Notion re-runs idempotent.
struct CreateNotionImportReferences: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw NotionImportReferenceMigrationError.sqliteDatabaseRequired
        }
        try await database.schema(NotionImportReference.schema)
            .field("NotionImportReferenceID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("NotionPageID", .string, .required)
            .field("TableName", .string, .required)
            .field("RecordID", .string, .required)
            .field("CreatedAt", .datetime)
            .field("UpdatedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_NotionImportReferences_Hub_Page"
            ON "NotionImportReferences" ("HubID", "NotionPageID")
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_NotionImportReferences_Hub_Table_Record"
            ON "NotionImportReferences" ("HubID", "TableName", "RecordID")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw NotionImportReferenceMigrationError.sqliteDatabaseRequired
        }
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_NotionImportReferences_Hub_Table_Record\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_NotionImportReferences_Hub_Page\"")).run()
        try await database.schema(NotionImportReference.schema).delete()
    }
}

private enum NotionImportReferenceMigrationError: Error {
    case sqliteDatabaseRequired
}
