import Fluent
import FluentSQLiteDriver
import SQLKit
import XCTVapor
import XCTest
@testable import GemsForgeAPI

final class RecordBodyMigrationTests: XCTestCase {
    func testRecordBodiesMigrationCreatesConstraintsAndReverts() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateRecordBodies())
            try await app.autoMigrate()
        }) { app in
            let database = app.db(.sqlite)
            let sql = try XCTUnwrap(database as? SQLDatabase)
            let schema = try await LiveSchemaService(database: database).inspect()
            let table = try XCTUnwrap(schema.tables.first { $0.name == RecordBody.schema })

            XCTAssertTrue(table.columns.contains { $0.name == "Markdown" && $0.dataType.uppercased() == "TEXT" })
            XCTAssertTrue(table.columns.contains { $0.name == "Revision" && $0.defaultValue == "0" })
            XCTAssertTrue(table.indexes.contains {
                $0.name == "uq_RecordBodies_Hub_Table_Record" && $0.unique
                    && $0.columns == ["HubID", "TableName", "RecordID"]
            })
            XCTAssertTrue(table.foreignKeys.contains {
                $0.column == "HubID" && $0.referencedTable == Hub.schema && $0.onDelete == "CASCADE"
            })

            try await CreateRecordBodies().revert(on: database)
            let remaining = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'RecordBodies'
                """)).first()
            XCTAssertNil(remaining)
            let indexes = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT name FROM sqlite_master WHERE type = 'index'
                  AND name IN ('uq_RecordBodies_Hub_Table_Record', 'idx_RecordBodies_Hub_Table')
                """)).all()
            XCTAssertTrue(indexes.isEmpty)
        }
    }
}
