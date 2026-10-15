import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryMigrationTests: XCTestCase {
    func testMigrationCreatesThePilotSchema() async throws {
        let app = try await Application.make(.testing)
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateHomeInventory())
        app.migrations.add(CreateFileMetadata())
        app.migrations.add(AddHomeInventoryAttachmentReference())

        try await app.autoMigrate()

        let rows = try await HomeInventory.query(on: app.db(.sqlite)).all()
        XCTAssertTrue(rows.isEmpty)
        try await app.asyncShutdown()
    }

    func testExistingDatabaseGainsHomeInventoryAttachmentReferenceWithoutLosingRows() async throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-HomeInventoryMigration-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: databaseURL) }

        do {
            try await withApp(configure: { app in
                app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
                app.migrations.add(CreateFileMetadata())
                app.migrations.add(CreateHomeInventory())
                try await app.autoMigrate()
            }) { app in
                let sqlDatabase = try XCTUnwrap(app.db(.sqlite) as? SQLDatabase)
                try await sqlDatabase.raw(SQLQueryString(stringLiteral: """
                    INSERT INTO HomeInventory (InventoryID, ItemName, Quantity)
                    VALUES ('existing-home-inventory', 'Existing item', 1)
                    """)).run()
            }
        }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
        }) { app in
            let rows = try await HomeInventory.query(on: app.db(.sqlite)).all()
            XCTAssertEqual(rows.count, 1)
            XCTAssertEqual(rows.first?.itemName, "Existing item")

            let schema = try await LiveSchemaService(database: app.db(.sqlite)).inspect()
            let homeInventory = try XCTUnwrap(schema.tables.first { $0.name == HomeInventory.schema })
            XCTAssertTrue(homeInventory.columns.contains { $0.name == "ImageFileMetadataID" })
            XCTAssertTrue(homeInventory.foreignKeys.contains {
                $0.column == "ImageFileMetadataID" &&
                $0.referencedTable == FileMetadata.schema &&
                $0.referencedColumn == "FileMetadataID"
            })
        }
    }
}
