import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class TableViewContractTests: XCTestCase {
    /// Verifies the contract's per-View uniqueness and nullable width behavior.
    func testColumnConfigurationRejectsDuplicateLogicalColumnWithinView() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            try await app.autoMigrate()
        }) { app in
            let sql = try XCTUnwrap(app.db(.sqlite) as? SQLDatabase)
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-1', 'subject-1')")).run()
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-1', 'account-1', 'Gem Life')")).run()

            let view = TableView(hubID: "hub-1", tableName: "Services", name: "Default", viewType: .table)
            try await view.create(on: app.db(.sqlite))
            let first = ViewColumnConfiguration(viewID: view.id!, columnName: "InternalNotes", isVisible: false)
            try await first.create(on: app.db(.sqlite))
            XCTAssertNil(first.width)

            let duplicate = ViewColumnConfiguration(viewID: view.id!, columnName: "InternalNotes", width: 240)
            do {
                try await duplicate.create(on: app.db(.sqlite))
                XCTFail("Expected duplicate logical column configuration to be rejected")
            } catch {
                // The composite (ViewID, ColumnName) uniqueness constraint is authoritative.
            }
        }
    }

    func testControlledVocabulariesAndValueEncodingAreCanonical() throws {
        XCTAssertEqual(TableViewType.allCases.map(\.rawValue), ["Table", "List", "Gallery", "Grid"])
        XCTAssertEqual(ViewQueryBooleanOperator.and.rawValue, "AND")
        XCTAssertEqual(ViewQuerySortDirection.descending.rawValue, "Descending")

        XCTAssertEqual(try ViewQueryValueCodec.encode(.decimal("20.00")), "20")
        XCTAssertEqual(try ViewQueryValueCodec.encode(.boolean(true)), "true")
        XCTAssertEqual(try ViewQueryValueCodec.encode(.date("2026-11-01")), "2026-11-01")
        XCTAssertNil(try ViewQueryValueCodec.encode(.null))
        XCTAssertEqual(
            try ViewQueryValueCodec.encode([.integer(20), .integer(30)], for: .between),
            "[\"20\",\"30\"]"
        )
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("not-a-number", as: .integer))
    }

    func testDTOsMapPersistedMetadataWithoutExposingRawVocabularies() throws {
        let view = TableView(hubID: "hub-1", tableName: "Services", name: "Active", viewType: .gallery)
        let viewResponse = try TableViewResponse(model: view)
        XCTAssertEqual(viewResponse.viewType, .gallery)
        XCTAssertEqual(viewResponse.tableName, "Services")

        let column = ViewColumnConfiguration(viewID: view.id!, columnName: "Status", width: 120)
        XCTAssertEqual(try ViewColumnConfigurationResponse(model: column).width, 120)

        let query = ViewQueryConfiguration(
            viewID: view.id!, nodeType: .condition, columnName: "Status",
            comparisonOperator: .equals, valueType: .text, value: "Active"
        )
        let queryResponse = try ViewQueryConfigurationResponse(model: query)
        XCTAssertEqual(queryResponse.nodeType, .condition)
        XCTAssertEqual(queryResponse.comparisonOperator, .equals)
    }

    func testMetadataMigrationsCreateConstraintsIndexesAndCascadeOwnership() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            try await app.autoMigrate()
        }) { app in
            let sql = try XCTUnwrap(app.db(.sqlite) as? SQLDatabase)
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-1', 'subject-1')")).run()
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-1', 'account-1', 'Gem Life')")).run()

            let schema = try await LiveSchemaService(database: app.db(.sqlite)).inspect()
            let tableViews = try XCTUnwrap(schema.tables.first { $0.name == TableView.schema })
            XCTAssertTrue(tableViews.foreignKeys.contains {
                $0.column == "HubID" && $0.referencedTable == Hub.schema && $0.onDelete == "CASCADE"
            })
            XCTAssertTrue(tableViews.indexes.contains { $0.name == "uq_TableViews_DefaultPerHubTable" && $0.unique })
            let columnConfigurations = try XCTUnwrap(schema.tables.first { $0.name == ViewColumnConfiguration.schema })
            XCTAssertTrue(columnConfigurations.indexes.contains {
                $0.unique && $0.columns == ["ViewID", "ColumnName"]
            })
            XCTAssertTrue(columnConfigurations.foreignKeys.contains {
                $0.column == "ViewID" && $0.referencedTable == TableView.schema && $0.onDelete == "CASCADE"
            })
            let queryConfigurations = try XCTUnwrap(schema.tables.first { $0.name == ViewQueryConfiguration.schema })
            XCTAssertTrue(queryConfigurations.indexes.contains {
                $0.name == "idx_ViewQueryConfigurations_ViewID_ParentQueryID_SortOrder"
            })
            XCTAssertTrue(queryConfigurations.foreignKeys.contains {
                $0.column == "ParentQueryID" && $0.referencedTable == ViewQueryConfiguration.schema && $0.onDelete == "CASCADE"
            })

            let first = TableView(hubID: "hub-1", tableName: "Services", name: "Default", viewType: .table, isDefault: true)
            try await first.create(on: app.db(.sqlite))
            let duplicate = TableView(hubID: "hub-1", tableName: "Services", name: "Also default", viewType: .list, isDefault: true)
            do {
                try await duplicate.create(on: app.db(.sqlite))
                XCTFail("Expected the partial default-view index to reject a duplicate")
            } catch {
                // Expected uniqueness failure.
            }

            let child = ViewColumnConfiguration(viewID: first.id!, columnName: "Status")
            try await child.create(on: app.db(.sqlite))
            let query = ViewQueryConfiguration(viewID: first.id!, nodeType: .group, booleanOperator: .and)
            try await query.create(on: app.db(.sqlite))

            try await sql.raw(SQLQueryString(stringLiteral: "DELETE FROM Hubs WHERE HubID = 'hub-1'")).run()
            let columnCount = try await ViewColumnConfiguration.query(on: app.db(.sqlite)).count()
            let queryCount = try await ViewQueryConfiguration.query(on: app.db(.sqlite)).count()
            let viewCount = try await TableView.query(on: app.db(.sqlite)).count()
            XCTAssertEqual(columnCount, 0)
            XCTAssertEqual(queryCount, 0)
            XCTAssertEqual(viewCount, 0)
        }
    }
}
