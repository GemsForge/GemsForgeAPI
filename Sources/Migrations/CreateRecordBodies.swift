import Fluent
import SQLKit

/// Creates the Hub-scoped Markdown sidecar used by record and page bodies.
struct CreateRecordBodies: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw RecordBodyMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(RecordBody.schema)
            .field("RecordBodyID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("RecordID", .string, .required)
            .field("Markdown", .string, .required, .sql(.default("")))
            .field("Revision", .int, .required, .sql(.default(0)))
            .field("CreatedAt", .datetime)
            .field("UpdatedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_RecordBodies_Hub_Table_Record"
            ON "RecordBodies" ("HubID", "TableName", "RecordID")
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_RecordBodies_Hub_Table"
            ON "RecordBodies" ("HubID", "TableName")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw RecordBodyMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_RecordBodies_Hub_Table\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_RecordBodies_Hub_Table_Record\"")).run()
        try await database.schema(RecordBody.schema).delete()
    }
}

private enum RecordBodyMigrationError: Error {
    case sqliteDatabaseRequired
}
