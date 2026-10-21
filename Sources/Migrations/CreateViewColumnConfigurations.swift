import Fluent
import SQLKit

/// Creates per-view presentation metadata for logical table columns.
struct CreateViewColumnConfigurations: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw ViewColumnConfigurationMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(ViewColumnConfiguration.schema)
            .field("ViewColumnID", .string, .identifier(auto: false))
            .field("ViewID", .string, .required, .references(
                TableView.schema, "ViewID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("ColumnName", .string, .required)
            .field("IsVisible", .bool, .required, .sql(.default(true)))
            .field(
                "SortOrder",
                .int,
                .required,
                .sql(.default(0)),
                .sql(.check(SQLRaw(#""SortOrder" >= 0"#)))
            )
            .field(
                "Width",
                .double,
                .sql(.check(SQLRaw(#""Width" IS NULL OR "Width" >= 0"#)))
            )
            .unique(on: "ViewID", "ColumnName", name: "uq_ViewColumnConfigurations_ViewID_ColumnName")
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_ViewColumnConfigurations_ViewID_SortOrder"
            ON "ViewColumnConfigurations" ("ViewID", "SortOrder")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw ViewColumnConfigurationMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_ViewColumnConfigurations_ViewID_SortOrder\"")).run()
        try await database.schema(ViewColumnConfiguration.schema).delete()
    }
}

private enum ViewColumnConfigurationMigrationError: Error {
    case sqliteDatabaseRequired
}
