import Fluent
import SQLKit

/// Creates the Hub-scoped record archive used by the Console Trash page.
struct CreateTrashEntries: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TrashMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(TrashEntry.schema)
            .field("EntryID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("RecordID", .string, .required)
            .field("Title", .string, .required)
            .field("Snapshot", .string, .required)
            .field("TrashedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_TrashEntries_Hub_Table_Record"
            ON "TrashEntries" ("HubID", "TableName", "RecordID")
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_TrashEntries_Hub_TrashedAt"
            ON "TrashEntries" ("HubID", "TrashedAt")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TrashMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_TrashEntries_Hub_TrashedAt\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_TrashEntries_Hub_Table_Record\"")).run()
        try await database.schema(TrashEntry.schema).delete()
    }
}

private enum TrashMigrationError: Error {
    case sqliteDatabaseRequired
}
