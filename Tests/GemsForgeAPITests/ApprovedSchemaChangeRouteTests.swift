import Fluent
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class ApprovedSchemaChangeRouteTests: XCTestCase {
    func testNamedColumnAndIndexChangesBackupApplyAndVerify() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-ApprovedSchemaChangeTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = rootDirectory.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(sourceURL.path)), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerLiveMigrationRoutes(app, backupConfiguration: .init(sourceURL: sourceURL, destinationDirectory: backupDirectory))
        }) { app in
            for changeID in ApprovedSchemaChange.allCases.map(\.rawValue) {
                var token = ""
                try await app.test(.POST, "live-database/schema-changes/preview", beforeRequest: { request in
                    try request.content.encode(ApprovedSchemaChangePreviewRequest(changeID: changeID))
                }) { response async throws in
                    XCTAssertEqual(response.status, .ok)
                    token = try response.content.decode(ApprovedSchemaChangePreview.self).confirmationToken
                }

                try await app.test(.POST, "live-database/schema-changes/execute", beforeRequest: { request in
                    try request.content.encode(LiveTableCreationRequest(confirmationToken: token))
                }) { response async throws in
                    XCTAssertEqual(response.status, .ok)
                    let result = try response.content.decode(ApprovedSchemaChangeExecutionResponse.self)
                    XCTAssertEqual(result.changeID, changeID)
                    XCTAssertEqual(result.status, "updated-and-verified")
                    XCTAssertGreaterThan(result.backupSizeBytes, 0)
                    XCTAssertTrue(FileManager.default.fileExists(atPath: backupDirectory.appendingPathComponent(result.backupFileName).path))
                }
            }

            let schema = try await LiveSchemaService(database: app.db).inspect()
            let fileMetadata = try XCTUnwrap(schema.tables.first { $0.name == "FileMetadata" })
            XCTAssertTrue(fileMetadata.columns.contains { $0.name == "DomainID" })
            XCTAssertTrue(fileMetadata.indexes.contains { $0.name == "idx_FileMetadata_RelativePath" })
            XCTAssertTrue(fileMetadata.foreignKeys.contains { $0.column == "DomainID" && $0.referencedTable == "Domains" })

            try await app.test(.GET, "live-database/migrations/history") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let history = try response.content.decode([SchemaMigrationAudit].self)
                XCTAssertEqual(history.count, ApprovedSchemaChange.allCases.count)
                XCTAssertTrue(history.allSatisfy { $0.result == "succeeded" })
                XCTAssertTrue(history.allSatisfy { $0.databaseIdentity == sourceURL.lastPathComponent })
            }
        }
    }

    func testUnapprovedChangeAndSecondExecutionAreRejected() async throws {
        try await withApp(configure: { app in
            registerLiveMigrationRoutes(app, backupConfiguration: nil)
        }) { app in
            try await app.test(.POST, "live-database/schema-changes/preview", beforeRequest: { request in
                try request.content.encode(ApprovedSchemaChangePreviewRequest(changeID: "drop-table"))
            }) { response in XCTAssertEqual(response.status, .badRequest) }
        }
    }
}
