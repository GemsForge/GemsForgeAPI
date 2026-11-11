import Fluent
import SQLKit

/// Persists Hub-scoped relation and lookup definitions for logical tables.
struct CreateTablePropertyDefinitions: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TablePropertyMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(TablePropertyDefinition.schema)
            .field("DefinitionID", .string, .identifier(auto: false))
            .field("HubID", .string, .required, .references(
                Hub.schema, "HubID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("TableName", .string, .required)
            .field("Name", .string, .required)
            .field("Kind", .string, .required, .sql(.check(SQLRaw(#""Kind" IN ('Relation', 'Lookup')"#))))
            .field("SourceColumnName", .string)
            .field("TargetTableName", .string)
            .field("TargetKeyColumnName", .string)
            .field("TargetDisplayColumnName", .string)
            .field("RelationDefinitionID", .string)
            .field("TargetColumnName", .string)
            .field("FilterByDefinitionID", .string)
            .field("TargetFilterColumnName", .string)
            .field("SortOrder", .int, .required, .sql(.default(0)), .sql(.check(SQLRaw(#""SortOrder" >= 0"#))))
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE UNIQUE INDEX "uq_TablePropertyDefinitions_HubTableName"
            ON "TablePropertyDefinitions" ("HubID", "TableName", "Name")
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_TablePropertyDefinitions_HubTableOrder"
            ON "TablePropertyDefinitions" ("HubID", "TableName", "SortOrder")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw TablePropertyMigrationError.sqliteDatabaseRequired
        }
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_TablePropertyDefinitions_HubTableOrder\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"uq_TablePropertyDefinitions_HubTableName\"")).run()
        try await database.schema(TablePropertyDefinition.schema).delete()
    }
}

private enum TablePropertyMigrationError: Error {
    case sqliteDatabaseRequired
}
