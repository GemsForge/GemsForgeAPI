import Fluent
import SQLKit

/// Stores Hub-scoped semantic types and ordered options for physical columns.
struct CreateTableColumnDefinitions: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TableColumnDefinitionMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(TableColumnDefinition.schema)
            .field("DefinitionID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("ColumnName", .string, .required)
            .field("PropertyType", .string, .required, .sql(.check(
                SQLRaw(#""PropertyType" IN ('Select', 'MultiSelect', 'Status')"#)
            )))
            .field("OptionsJSON", .string, .required, .sql(.default("[]")))
            .field("CreatedAt", .datetime)
            .field("UpdatedAt", .datetime)
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_TableColumnDefinitions_HubTableColumn"
            ON "TableColumnDefinitions" ("HubID", "TableName", "ColumnName")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TableColumnDefinitionMigrationError.sqliteDatabaseRequired
        }
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_TableColumnDefinitions_HubTableColumn\"")).run()
        try await database.schema(TableColumnDefinition.schema).delete()
    }
}

private enum TableColumnDefinitionMigrationError: Error {
    case sqliteDatabaseRequired
}
