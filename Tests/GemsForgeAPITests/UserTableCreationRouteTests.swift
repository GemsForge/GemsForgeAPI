import Fluent
import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class UserTableCreationRouteTests: XCTestCase {
    func testDynamicTablePreviewReturnsValidatedDefinitionWithoutChangingSchema() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerLiveMigrationRoutes(app)
        }) { app in
            let request = TableBuilderRequest(tableName: "HomeInventoryDraft", columns: [
                TableBuilderColumnRequest(name: "ItemName", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
                TableBuilderColumnRequest(name: "Quantity", dataType: .integer, nullable: false, defaultValue: "1", primaryKey: false, unique: false)
            ])

            try await app.test(.POST, "live-database/tables/preview", beforeRequest: { httpRequest in
                try httpRequest.content.encode(request)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(UserTablePreviewResponse.self)
                XCTAssertEqual(preview.definition.tableName, "HomeInventoryDraft")
                XCTAssertEqual(preview.definition.columns.map(\.name), ["ID", "HubID", "Title", "ItemName", "Quantity"])
                XCTAssertEqual(preview.status, "preview")
            }

            let schema = try await LiveSchemaService(database: app.db).inspect()
            XCTAssertFalse(schema.tables.contains { $0.name == "HomeInventoryDraft" })
        }
    }

    func testDynamicTableExecutionBacksUpCreatesAndVerifiesTheTable() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-UserTableTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = rootDirectory.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        let configuration = LiveDatabaseBackupConfiguration(sourceURL: sourceURL, destinationDirectory: backupDirectory)
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(sourceURL.path)), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            try await app.autoMigrate()
            registerLiveMigrationRoutes(app, backupConfiguration: configuration)
        }) { app in
            let request = TableBuilderRequest(tableName: "HomeInventoryDraft", columns: [
                TableBuilderColumnRequest(name: "ItemName", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
                TableBuilderColumnRequest(name: "Quantity", dataType: .integer, nullable: false, defaultValue: "1", primaryKey: false, unique: false)
            ])
            var token = ""
            try await app.test(.POST, "live-database/tables/preview", beforeRequest: { httpRequest in
                try httpRequest.content.encode(request)
            }) { response async throws in
                token = try response.content.decode(UserTablePreviewResponse.self).confirmationToken
            }

            try await app.test(.POST, "live-database/tables/execute", beforeRequest: { httpRequest in
                try httpRequest.content.encode(LiveTableCreationRequest(confirmationToken: token))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(UserTableCreationResponse.self)
                XCTAssertEqual(result.table, "HomeInventoryDraft")
                XCTAssertGreaterThan(result.backupSizeBytes, 0)
                XCTAssertTrue(FileManager.default.fileExists(atPath: backupDirectory.appendingPathComponent(result.backupFileName).path))
            }

            let schema = try await LiveSchemaService(database: app.db).inspect()
            let table = try XCTUnwrap(schema.tables.first { $0.name == "HomeInventoryDraft" })
            XCTAssertEqual(table.columns.map { $0.name }, ["ID", "HubID", "Title", "ItemName", "Quantity"])
            XCTAssertEqual(table.columns.first(where: { $0.name == "Title" })?.nullable, false)
            let schemaPages = try await SchemaPageService(database: app.db, hubID: "hub-a").listTables()
            XCTAssertTrue(schemaPages.availableTables.contains { $0.name == "HomeInventoryDraft" })
        }
    }

    func testTableCanBeCreatedWithOnlyTheRequiredServerManagedColumnsAndTitle() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerLiveMigrationRoutes(app)
        }) { app in
            try await app.test(.POST, "live-database/tables/preview", beforeRequest: { request in
                try request.content.encode(TableBuilderRequest(tableName: "Goals", columns: []))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(UserTablePreviewResponse.self)
                XCTAssertEqual(preview.definition.columns.map(\.name), ["ID", "HubID", "Title"])
                XCTAssertFalse(preview.definition.columns[2].nullable)
            }
        }
    }

    func testTitleCannotBeRedefinedAsAUserColumn() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerLiveMigrationRoutes(app)
        }) { app in
            try await app.test(.POST, "live-database/tables/preview", beforeRequest: { request in
                try request.content.encode(TableBuilderRequest(tableName: "DuplicateTitle", columns: [
                    TableBuilderColumnRequest(name: "title", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false)
                ]))
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
        }
    }
}
