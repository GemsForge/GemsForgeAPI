import Fluent
import SQLKit

/// Stores per-record presentation state separately from user-owned record data.
struct CreateRecordPresentations: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw RecordPresentationMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(RecordPresentation.schema)
            .field("RecordPresentationID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("RecordID", .string, .required)
            .field("Presentation", .string, .required)
            .field("CreatedAt", .datetime)
            .field("UpdatedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_RecordPresentations_Hub_Table_Record"
            ON "RecordPresentations" ("HubID", "TableName", "RecordID")
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_RecordPresentations_Hub_Table"
            ON "RecordPresentations" ("HubID", "TableName")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw RecordPresentationMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_RecordPresentations_Hub_Table\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_RecordPresentations_Hub_Table_Record\"")).run()
        try await database.schema(RecordPresentation.schema).delete()
    }
}

private enum RecordPresentationMigrationError: Error {
    case sqliteDatabaseRequired
}
