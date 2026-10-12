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
                TableBuilderColumnRequest(name: "InventoryID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: true, unique: false),
                TableBuilderColumnRequest(name: "ItemName", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
                TableBuilderColumnRequest(name: "Quantity", dataType: .integer, nullable: false, defaultValue: "1", primaryKey: false, unique: false)
            ])

            try await app.test(.POST, "live-database/tables/preview", beforeRequest: { httpRequest in
                try httpRequest.content.encode(request)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(UserTablePreviewResponse.self)
                XCTAssertEqual(preview.definition.tableName, "HomeInventoryDraft")
                XCTAssertEqual(preview.definition.columns.count, 3)
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
            registerLiveMigrationRoutes(app, backupConfiguration: configuration)
        }) { app in
            let request = TableBuilderRequest(tableName: "HomeInventoryDraft", columns: [
                TableBuilderColumnRequest(name: "InventoryID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: true, unique: false),
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
            XCTAssertEqual(table.columns.map { $0.name }, ["InventoryID", "ItemName", "Quantity"])
        }
    }
}
