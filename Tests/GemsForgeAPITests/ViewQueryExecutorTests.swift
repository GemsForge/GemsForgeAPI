import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class ViewQueryExecutorTests: XCTestCase {
    func testAdHocQueriesAreHubScopedEscapedAndPagedWithTrashExcluded() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTableColumnDefinitions())
            app.migrations.add(CreateTrashEntries())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
        }) { app in
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A')").run()
            try await sql.raw("INSERT INTO SchemaPageFixture (ID, HubID, Name, Quantity) VALUES ('one', 'hub-a', '100%_ready', 1), ('two', 'hub-a', '100xYready', 2), ('three', 'hub-a', '100%_ready', 3), ('foreign', 'hub-b', '100%_ready', 4)").run()
            try await sql.raw("INSERT INTO TrashEntries (EntryID, HubID, TableName, RecordID, Title, Snapshot) VALUES ('trash-one', 'hub-a', 'SchemaPageFixture', 'three', 'Removed', '{}')").run()

            let emptyGroup = [SchemaPageQueryNode(
                id: "root", parentQueryID: nil, nodeType: .group, columnName: nil,
                comparisonOperator: nil, valueType: nil, value: nil,
                booleanOperator: .and, direction: nil, sortOrder: 0
            )]
            let all = try await ViewQueryExecutor(database: app.db, hubID: "hub-a").execute(
                tableName: "SchemaPageFixture",
                request: SchemaPageQueryRequest(viewID: nil, nodes: emptyGroup, search: nil, limit: 1, offset: 0)
            )
            XCTAssertEqual(all.total, 2)
            XCTAssertEqual(all.records.count, 1)
            let next = try await ViewQueryExecutor(database: app.db, hubID: "hub-a").execute(
                tableName: "SchemaPageFixture",
                request: SchemaPageQueryRequest(viewID: nil, nodes: emptyGroup, search: nil, limit: 1, offset: 1)
            )
            XCTAssertEqual(next.records.count, 1)
            XCTAssertNotEqual(all.records.first?.row["ID"] ?? nil, next.records.first?.row["ID"] ?? nil)

            let nameFilter = SchemaPageQueryNode(
                id: "name", parentQueryID: "root", nodeType: .condition, columnName: "Name",
                comparisonOperator: .contains, valueType: .text, value: "100%_ready",
                booleanOperator: nil, direction: nil, sortOrder: 0
            )
            let escaped = try await ViewQueryExecutor(database: app.db, hubID: "hub-a").execute(
                tableName: "SchemaPageFixture",
                request: SchemaPageQueryRequest(viewID: nil, nodes: [emptyGroup[0], nameFilter], search: nil, limit: 10, offset: 0)
            )
            XCTAssertEqual(escaped.total, 1)
            XCTAssertEqual(escaped.records.first?.row["ID"] ?? nil, "one")
        }
    }
}
