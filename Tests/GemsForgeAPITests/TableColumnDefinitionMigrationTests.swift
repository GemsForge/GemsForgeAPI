import Fluent
import FluentSQLiteDriver
import SQLKit
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class TableColumnDefinitionMigrationTests: XCTestCase {
    func testCreatesHubScopedUniqueDefinitionsAndReverts() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableColumnDefinitions())
            try await app.autoMigrate()
        }) { app in
            let sql = try XCTUnwrap(app.db(.sqlite) as? SQLDatabase)
            let schema = try await LiveSchemaService(database: app.db(.sqlite)).inspect()
            let definitions = try XCTUnwrap(schema.tables.first { $0.name == TableColumnDefinition.schema })
            XCTAssertEqual(definitions.indexes.first { $0.name == "uq_TableColumnDefinitions_HubTableColumn" }?.columns,
                           ["HubID", "TableName", "ColumnName"])
            XCTAssertTrue(definitions.foreignKeys.contains {
                $0.column == "HubID" && $0.referencedTable == Hub.schema && $0.onDelete == "CASCADE"
            })

            try await CreateTableColumnDefinitions().revert(on: app.db(.sqlite))
            let remaining = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT COUNT(*) AS count FROM sqlite_master
                WHERE type = 'table' AND name = 'TableColumnDefinitions'
                """)).first()
            XCTAssertEqual(try remaining?.decode(column: "count", as: Int.self), 0)
        }
    }
}
