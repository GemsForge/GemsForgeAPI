import Fluent
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LiveTableCreationRouteTests: XCTestCase {
    func testApprovedTableRequiresPreviewTokenBackupAndVerifiesCreation() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LiveTableCreationTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = rootDirectory.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        let configuration = LiveDatabaseBackupConfiguration(sourceURL: sourceURL, destinationDirectory: backupDirectory)
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(sourceURL.path)), as: .sqlite)
            registerLiveMigrationRoutes(app, backupConfiguration: configuration)
        }) { app in
            let preview = LiveMigrationPreviewRequest(operations: [
                LiveMigrationOperationRequest(
                    operation: "create-table",
                    table: "FileMetadata",
                    columns: ApprovedLiveTable.fileMetadata.columns
                )
            ])
            var token = ""
            var backupFileName = ""

            try await app.test(.POST, "live-database/migrations/preview", beforeRequest: { request in
                try request.content.encode(preview)
            }) { response async throws in
                token = try response.content.decode(LiveMigrationPlan.self).confirmationToken
            }

            try await app.test(.POST, "live-database/migrations/execute", beforeRequest: { request in
                try request.content.encode(LiveTableCreationRequest(confirmationToken: token))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(LiveTableCreationResponse.self)
                XCTAssertEqual(result.table, "FileMetadata")
                XCTAssertEqual(result.status, "created-and-verified")
                XCTAssertGreaterThan(result.backupSizeBytes, 0)
                backupFileName = result.backupFileName
            }

            let schema = try await LiveSchemaService(database: app.db).inspect()
            XCTAssertTrue(schema.tables.contains { $0.name == "FileMetadata" })
            XCTAssertTrue(FileManager.default.fileExists(atPath: backupDirectory.appendingPathComponent(backupFileName).path))
        }
    }

    func testUnapprovedTableCannotExecute() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LiveTableSafetyTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = rootDirectory.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        let configuration = LiveDatabaseBackupConfiguration(sourceURL: sourceURL, destinationDirectory: backupDirectory)
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(sourceURL.path)), as: .sqlite)
            registerLiveMigrationRoutes(app, backupConfiguration: configuration)
        }) { app in
            let preview = LiveMigrationPreviewRequest(operations: [
                LiveMigrationOperationRequest(operation: "create-table", table: "NotApproved", columns: ["ID"])
            ])
            var token = ""
            try await app.test(.POST, "live-database/migrations/preview", beforeRequest: { request in
                try request.content.encode(preview)
            }) { response async throws in
                token = try response.content.decode(LiveMigrationPlan.self).confirmationToken
            }

            try await app.test(.POST, "live-database/migrations/execute", beforeRequest: { request in
                try request.content.encode(LiveTableCreationRequest(confirmationToken: token))
            }) { response in XCTAssertEqual(response.status, .badRequest) }
        }
    }
}
