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

    func testFileMetadataForeignKeysAreAddedToLegacyTablesWithoutLosingRows() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
        }) { app in
            let database = app.db(.sqlite)
            let sqlDatabase = try XCTUnwrap(database as? SQLDatabase)
            for statement in legacySchemaStatements(withOrphan: false) {
                try await sqlDatabase.raw(SQLQueryString(stringLiteral: statement)).run()
            }

            try await AddFileMetadataForeignKeys().prepare(on: database)

            let schema = try await LiveSchemaService(database: database).inspect()
            let expected = [
                ("Addresses", "ImageFileMetadataID"),
                ("Education", "DocumentFileMetadataID"),
                ("HomeInventory", "ImageFileMetadataID"),
                ("Services", "LogoFileMetadataID"),
                ("Transactions", "Image"),
                ("GemHueImages", "FileMetadataID"),
                ("ServiceLogoAssets", "FileMetadataID")
            ]

            for (table, column) in expected {
                let inspected = try XCTUnwrap(schema.tables.first { $0.name == table })
                XCTAssertTrue(inspected.foreignKeys.contains {
                    $0.column == column &&
                    $0.referencedTable == FileMetadata.schema &&
                    $0.referencedColumn == "FileMetadataID"
                }, "Missing FileMetadata foreign key for \(table).\(column)")
            }

            let addressCount = try await sqlDatabase.raw(SQLQueryString(stringLiteral: "SELECT COUNT(*) AS count FROM Addresses")).all()
                .first?.decode(column: "count", as: Int.self)
            XCTAssertEqual(addressCount, 1)
        }
    }

    func testFileMetadataForeignKeyMigrationRejectsOrphans() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
        }) { app in
            let database = app.db(.sqlite)
            let sqlDatabase = try XCTUnwrap(database as? SQLDatabase)
            for statement in legacySchemaStatements(withOrphan: true) {
                try await sqlDatabase.raw(SQLQueryString(stringLiteral: statement)).run()
            }

            do {
                try await AddFileMetadataForeignKeys().prepare(on: database)
                XCTFail("Expected orphaned FileMetadata references to abort the migration")
            } catch {
                let foreignKeys = try await sqlDatabase.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_key_list(Addresses)")).all()
                XCTAssertTrue(foreignKeys.isEmpty, "The migration should leave the legacy table unchanged after an orphan check failure")
            }
        }
    }
}

private func legacySchemaStatements(withOrphan: Bool) -> [String] {
    var statements = [
        "PRAGMA foreign_keys = OFF",
        "CREATE TABLE FileMetadata (FileMetadataID TEXT PRIMARY KEY)",
        "CREATE TABLE Addresses (AddressID TEXT PRIMARY KEY, ImageFileMetadataID TEXT)",
        "CREATE TABLE Education (EducationID TEXT PRIMARY KEY, DocumentFileMetadataID TEXT)",
        "CREATE TABLE HomeInventory (InventoryID TEXT PRIMARY KEY, ImageFileMetadataID TEXT)",
        "CREATE TABLE Services (ServiceID TEXT PRIMARY KEY, LogoFileMetadataID TEXT)",
        "CREATE TABLE Transactions (TransactionID TEXT PRIMARY KEY, Image TEXT)",
        "CREATE TABLE GemHueImages (ImageID TEXT PRIMARY KEY, FileMetadataID TEXT)",
        "CREATE TABLE ServiceLogoAssets (LogoAssetID TEXT PRIMARY KEY, FileMetadataID TEXT)"
    ]
    if withOrphan {
        statements.append("INSERT INTO Addresses VALUES ('orphan-address', 'missing-file')")
    } else {
        statements.append(contentsOf: [
            "INSERT INTO FileMetadata VALUES ('file-1')",
            "INSERT INTO Addresses VALUES ('address-1', 'file-1')",
            "INSERT INTO Education VALUES ('education-1', 'file-1')",
            "INSERT INTO HomeInventory VALUES ('inventory-1', 'file-1')",
            "INSERT INTO Services VALUES ('service-1', 'file-1')",
            "INSERT INTO Transactions VALUES ('transaction-1', 'file-1')",
            "INSERT INTO GemHueImages VALUES ('hue-1', 'file-1')",
            "INSERT INTO ServiceLogoAssets VALUES ('logo-1', 'file-1')"
        ])
    }
    return statements
}
