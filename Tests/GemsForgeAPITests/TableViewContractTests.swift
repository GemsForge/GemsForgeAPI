import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class TableViewContractTests: XCTestCase {
    /// Verifies defaults are unique within a Hub/Table scope but independent across Hubs.
    func testTableViewServiceScopesDefaultConflictsPerHubAndTable() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema()); app.migrations.add(CreateHubs()); app.migrations.add(CreateTableViews())
            try await app.autoMigrate()
        }) { app in
            let database = app.db(.sqlite); let sql = try XCTUnwrap(database as? SQLDatabase)
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('a1', 's1'), ('a2', 's2')")).run()
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('h1', 'a1', 'One'), ('h2', 'a2', 'Two')")).run()
            let service = TableViewService(database: database)
            try await service.create(TableView(hubID: "h1", tableName: "Services", name: "All", viewType: .table, isDefault: true))
            do {
                try await service.create(TableView(hubID: "h1", tableName: "Services", name: "Active", viewType: .list, isDefault: true))
                XCTFail("Expected a same-scope default conflict")
            } catch { XCTAssertEqual(error as? TableViewPersistenceError, .defaultConflict) }
            try await service.create(TableView(hubID: "h2", tableName: "Services", name: "All", viewType: .table, isDefault: true))
            let defaults = try await TableView.query(on: database).filter(\.$isDefault == true).count()
            XCTAssertEqual(defaults, 2)
        }
    }

    /// Verifies promotion and deletion are atomic and choose the lowest SortOrder replacement.
    func testTableViewServicePromotesLowestSortOrderOnPromotionAndDeletion() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema()); app.migrations.add(CreateHubs()); app.migrations.add(CreateTableViews())
            try await app.autoMigrate()
        }) { app in
            let database = app.db(.sqlite); let sql = try XCTUnwrap(database as? SQLDatabase)
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('a1', 's1')")).run()
            try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('h1', 'a1', 'One')")).run()
            let current = TableView(hubID: "h1", tableName: "Services", name: "Current", viewType: .table, isDefault: true, sortOrder: 5)
            let lowest = TableView(hubID: "h1", tableName: "Services", name: "Lowest", viewType: .list, sortOrder: 1)
            let other = TableView(hubID: "h1", tableName: "Services", name: "Other", viewType: .gallery, sortOrder: 3)
            let service = TableViewService(database: database)
            try await service.create(current); try await service.create(lowest); try await service.create(other)
            try await service.update(other, isDefault: true)
            let promotedOptional = try await TableView.find(other.id!, on: database)
            let promoted = try XCTUnwrap(promotedOptional)
            XCTAssertTrue(promoted.isDefault)
            try await service.delete(other)
            let replacementOptional = try await TableView.find(lowest.id!, on: database)
            let replacement = try XCTUnwrap(replacementOptional)
            XCTAssertTrue(replacement.isDefault)
            let remainingDefaults = try await TableView.query(on: database).filter(\.$isDefault == true).count()
            XCTAssertEqual(remainingDefaults, 1)
        }
    }

    /// Confirms column metadata is scoped to a View and never becomes a schema mutation.
    func testColumnConfigurationsRemainPerViewAndLogical() async throws {
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

            let first = TableView(hubID: "hub-1", tableName: "Services", name: "Compact", viewType: .table)
            let second = TableView(hubID: "hub-1", tableName: "Services", name: "Wide", viewType: .table)
            try await first.create(on: app.db(.sqlite))
            try await second.create(on: app.db(.sqlite))

            let compact = ViewColumnConfiguration(viewID: first.id!, columnName: "Status", isVisible: false, sortOrder: 3)
            let wide = ViewColumnConfiguration(viewID: second.id!, columnName: "Status", isVisible: true, sortOrder: 0, width: 120)
            try await compact.create(on: app.db(.sqlite))
            try await wide.create(on: app.db(.sqlite))

            let configurations = try await ViewColumnConfiguration.query(on: app.db(.sqlite)).all()
            XCTAssertEqual(configurations.count, 2)
            XCTAssertEqual(configurations.first { $0.viewID == first.id }?.isVisible, false)
            XCTAssertEqual(configurations.first { $0.viewID == second.id }?.width, 120)

            let tables = try await LiveSchemaService(database: app.db(.sqlite)).inspect()
            let services = tables.tables.first { $0.name == "Services" }
            XCTAssertNil(services, "View metadata must not create or alter a canonical logical table")
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

    /// Verifies every persisted scalar has one stable representation and rejects malformed input.
    func testQueryValueCodecRoundTripsAndRejectsMalformedValues() throws {
        let values: [(ViewQueryValue, String?)] = [
            (.text("hello"), "hello"),
            (.integer(-20), "-20"),
            (.decimal("20"), "20"),
            (.boolean(true), "true"),
            (.date("2026-11-01"), "2026-11-01"),
            (.dateTime("2026-11-01T12:30:00Z"), "2026-11-01T12:30:00Z"),
            (.null, nil)
        ]
        for (value, encoded) in values {
            XCTAssertEqual(try ViewQueryValueCodec.encode(value), encoded)
            XCTAssertEqual(try ViewQueryValueCodec.decode(encoded, as: value.type), value)
        }

        XCTAssertThrowsError(try ViewQueryValueCodec.decode("01", as: .integer))
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("+1", as: .integer))
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("-0", as: .integer))
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("TRUE", as: .boolean))
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("2026-11-01T12:30:00+00:00", as: .dateTime))
        XCTAssertThrowsError(try ViewQueryValueCodec.decode("2026-02-30", as: .date))
    }

    /// Verifies operator cardinality and homogeneous operand typing before persistence.
    func testQueryValueCodecEnforcesOperatorCardinalityAndOperandTypes() throws {
        XCTAssertThrowsError(try ViewQueryValueCodec.encode([], for: .equals))
        XCTAssertThrowsError(try ViewQueryValueCodec.encode([.integer(1)], for: .between))
        XCTAssertThrowsError(try ViewQueryValueCodec.encode([.integer(1), .text("1")], for: .between))
        XCTAssertNil(try ViewQueryValueCodec.encode([], for: .isNull))
        XCTAssertThrowsError(try ViewQueryValueCodec.encode([.null], for: .isNull))
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

    func testTableViewDTORejectsUnsupportedPersistedViewType() throws {
        let view = TableView(hubID: "hub-1", tableName: "Services", name: "Unsupported", viewType: .table)
        view.viewType = "Kanban"

        XCTAssertThrowsError(try TableViewResponse(model: view)) { error in
            XCTAssertEqual(error as? TableViewModelMappingError, .invalidPersistedValue)
        }
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
