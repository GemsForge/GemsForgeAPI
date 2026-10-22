import Fluent
import SQLKit

/// Creates Hub-owned presentation metadata for existing logical tables.
struct CreateTableViews: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TableViewMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(TableView.schema)
            .field("ViewID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("Name", .string, .required)
            .field(
                "ViewType",
                .string,
                .required,
                .sql(.check(SQLRaw(#""ViewType" IN ('Table', 'List', 'Gallery', 'Grid')"#)))
            )
            .field("IsDefault", .bool, .required, .sql(.default(false)))
            .field(
                "SortOrder",
                .int,
                .required,
                .sql(.default(0)),
                .sql(.check(SQLRaw(#""SortOrder" >= 0"#)))
            )
            .field(
                "ConfigurationVersion",
                .int,
                .required,
                .sql(.default(1)),
                .sql(.check(SQLRaw(#""ConfigurationVersion" >= 1"#)))
            )
            .field("CreatedAt", .datetime)
            .field("UpdatedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_TableViews_HubID_TableName_SortOrder"
            ON "TableViews" ("HubID", "TableName", "SortOrder")
            """)).run()

        // Fluent's schema builder has no partial-index API.
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_TableViews_DefaultPerHubTable"
            ON "TableViews" ("HubID", "TableName")
            WHERE "IsDefault" = 1
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TableViewMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_TableViews_DefaultPerHubTable\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_TableViews_HubID_TableName_SortOrder\"")).run()
        try await database.schema(TableView.schema).delete()
    }
}

private enum TableViewMigrationError: Error {
    case sqliteDatabaseRequired
}
