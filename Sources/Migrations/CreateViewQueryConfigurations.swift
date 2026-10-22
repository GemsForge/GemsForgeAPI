import Fluent
import SQLKit

/// Creates server-validated query-tree metadata for each table view.
struct CreateViewQueryConfigurations: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw ViewQueryConfigurationMigrationError.sqliteDatabaseRequired
        }

        try await database.schema(ViewQueryConfiguration.schema)
            .field("ViewQueryID", .string, .identifier(auto: false))
            .field("ViewID", .string, .required, .references(
                TableView.schema, "ViewID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field("ParentQueryID", .string, .references(
                ViewQueryConfiguration.schema, "ViewQueryID", onDelete: .cascade, onUpdate: .cascade
            ))
            .field(
                "NodeType",
                .string,
                .required,
                .sql(.check(SQLRaw(#""NodeType" IN ('Group', 'Condition', 'Sort', 'RecordGroup')"#)))
            )
            .field("ColumnName", .string)
            .field(
                "Operator",
                .string,
                .sql(.check(SQLRaw(#""Operator" IS NULL OR "Operator" IN ('Equals', 'NotEquals', 'Contains', 'StartsWith', 'EndsWith', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual', 'IsNull', 'IsNotNull', 'Between', 'In')"#)))
            )
            .field(
                "ValueType",
                .string,
                .sql(.check(SQLRaw(#""ValueType" IS NULL OR "ValueType" IN ('Text', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Null')"#)))
            )
            .field("Value", .string)
            .field(
                "BooleanOperator",
                .string,
                .sql(.check(SQLRaw(#""BooleanOperator" IS NULL OR "BooleanOperator" IN ('AND', 'OR')"#)))
            )
            .field(
                "Direction",
                .string,
                .sql(.check(SQLRaw(#""Direction" IS NULL OR "Direction" IN ('Ascending', 'Descending')"#)))
            )
            .field(
                "SortOrder",
                .int,
                .required,
                .sql(.default(0)),
                .sql(.check(SQLRaw(#""SortOrder" >= 0"#)))
            )
            .create()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_ViewQueryConfigurations_ViewID_ParentQueryID_SortOrder"
            ON "ViewQueryConfigurations" ("ViewID", "ParentQueryID", "SortOrder")
            """)).run()

        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE INDEX "idx_ViewQueryConfigurations_ParentQueryID_SortOrder"
            ON "ViewQueryConfigurations" ("ParentQueryID", "SortOrder")
            """)).run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw ViewQueryConfigurationMigrationError.sqliteDatabaseRequired
        }

        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_ViewQueryConfigurations_ParentQueryID_SortOrder\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP INDEX IF EXISTS \"idx_ViewQueryConfigurations_ViewID_ParentQueryID_SortOrder\"")).run()
        try await database.schema(ViewQueryConfiguration.schema).delete()
    }
}

private enum ViewQueryConfigurationMigrationError: Error {
    case sqliteDatabaseRequired
}
