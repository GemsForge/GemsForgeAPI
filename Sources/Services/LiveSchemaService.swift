import Fluent
import SQLKit
import Vapor

/// Describes one column in a table in the configured SQLite database.
struct LiveSchemaColumnResponse: Content, Sendable {
    let name: String
    let dataType: String
    let nullable: Bool
    let primaryKey: Bool
    let defaultValue: String?
}

/// Describes one foreign-key relationship in the configured SQLite database.
struct LiveSchemaForeignKeyResponse: Content, Sendable {
    let column: String
    let referencedTable: String
    let referencedColumn: String
    let onUpdate: String
    let onDelete: String
}

/// Describes one index in the configured SQLite database.
struct LiveSchemaIndexResponse: Content, Sendable {
    let name: String
    let unique: Bool
    let columns: [String]
}

/// Describes a table without exposing the database's absolute filesystem path.
struct LiveSchemaTableResponse: Content, Sendable {
    let name: String
    let columns: [LiveSchemaColumnResponse]
    let foreignKeys: [LiveSchemaForeignKeyResponse]
    let indexes: [LiveSchemaIndexResponse]
}

/// The read-only schema snapshot returned to the testing console.
struct LiveSchemaResponse: Content, Sendable {
    let databaseName: String
    let tableCount: Int
    let tables: [LiveSchemaTableResponse]
}

enum LiveSchemaError: Error, CustomStringConvertible {
    case sqliteDatabaseRequired

    var description: String {
        switch self {
        case .sqliteDatabaseRequired:
            return "Live schema inspection requires the configured SQLite database."
        }
    }
}

/// Reads SQLite schema metadata without changing the database.
struct LiveSchemaService: Sendable {
    let database: Database
    let databaseName: String

    init(database: Database, databaseName: String = "configured Gem Life database") {
        self.database = database
        self.databaseName = databaseName
    }

    func inspect() async throws -> LiveSchemaResponse {
        guard let sqlDatabase = database as? SQLDatabase else {
            throw LiveSchemaError.sqliteDatabaseRequired
        }

        let tableRows = try await sqlDatabase.raw(SQLQueryString(stringLiteral: """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
              AND name NOT LIKE '_fluent_%'
            ORDER BY name
            """)).all()

        var tables: [LiveSchemaTableResponse] = []
        for row in tableRows {
            let tableName = try row.decode(column: "name", as: String.self)
            tables.append(try await inspectTable(tableName, using: sqlDatabase))
        }

        return LiveSchemaResponse(
            databaseName: databaseName,
            tableCount: tables.count,
            tables: tables
        )
    }

    private func inspectTable(_ tableName: String, using database: SQLDatabase) async throws -> LiveSchemaTableResponse {
        let quotedTableName = quoteIdentifier(tableName)
        let columnRows = try await database.raw(SQLQueryString(stringLiteral: "PRAGMA table_info(\(quotedTableName))")).all()
        let foreignKeyRows = try await database.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_key_list(\(quotedTableName))")).all()
        let indexRows = try await database.raw(SQLQueryString(stringLiteral: "PRAGMA index_list(\(quotedTableName))")).all()

        let columns = try columnRows.map { row in
            LiveSchemaColumnResponse(
                name: try row.decode(column: "name", as: String.self),
                dataType: try row.decode(column: "type", as: String.self),
                nullable: try row.decode(column: "notnull", as: Int.self) == 0,
                primaryKey: try row.decode(column: "pk", as: Int.self) > 0,
                defaultValue: try row.decode(column: "dflt_value", as: String?.self)
            )
        }

        let foreignKeys = try foreignKeyRows.map { row in
            LiveSchemaForeignKeyResponse(
                column: try row.decode(column: "from", as: String.self),
                referencedTable: try row.decode(column: "table", as: String.self),
                referencedColumn: try row.decode(column: "to", as: String.self),
                onUpdate: try row.decode(column: "on_update", as: String.self),
                onDelete: try row.decode(column: "on_delete", as: String.self)
            )
        }

        var indexes: [LiveSchemaIndexResponse] = []
        for row in indexRows {
            let indexName = try row.decode(column: "name", as: String.self)
            let indexColumns = try await database
                .raw(SQLQueryString(stringLiteral: "PRAGMA index_info(\(quoteIdentifier(indexName)))"))
                .all()
                .map { try $0.decode(column: "name", as: String.self) }

            indexes.append(LiveSchemaIndexResponse(
                name: indexName,
                unique: try row.decode(column: "unique", as: Int.self) == 1,
                columns: indexColumns
            ))
        }

        return LiveSchemaTableResponse(
            name: tableName,
            columns: columns,
            foreignKeys: foreignKeys,
            indexes: indexes
        )
    }

    private func quoteIdentifier(_ identifier: String) -> String {
        "\"\(identifier.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}
