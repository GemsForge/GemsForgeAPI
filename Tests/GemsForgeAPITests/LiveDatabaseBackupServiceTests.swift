import Fluent
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LiveDatabaseBackupServiceTests: XCTestCase {
    func testBackupCreatesVerifiedSnapshotWithoutReplacingSource() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LiveDatabaseBackupTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = rootDirectory.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(sourceURL.path)), as: .sqlite)
            app.migrations.add(CreateDomains())
            try await app.autoMigrate()
        }) { app in
            let service = LiveDatabaseBackupService(configuration: .init(
                sourceURL: sourceURL,
                destinationDirectory: backupDirectory
            ))

            let result = try await service.createBackup(using: app.db)
            let backupURL = backupDirectory.appendingPathComponent(result.backupFileName)

            XCTAssertEqual(result.status, "created-and-verified")
            XCTAssertTrue(result.backupFileName.hasPrefix("GemLife-backup-"))
            XCTAssertTrue(FileManager.default.fileExists(atPath: sourceURL.path))
            XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path))
            XCTAssertGreaterThan(result.backupSizeBytes, 0)
        }
    }

    func testBackupRejectsMissingOrUnsafeLocations() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LiveDatabaseBackupSafetyTests-\(UUID().uuidString)")
        let sourceURL = rootDirectory.appendingPathComponent("GemLife.sqlite")
        try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: sourceURL.path, contents: Data())
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
        }) { app in
            let missingDirectoryService = LiveDatabaseBackupService(configuration: .init(
                sourceURL: sourceURL,
                destinationDirectory: rootDirectory.appendingPathComponent("missing")
            ))
            do {
                _ = try await missingDirectoryService.createBackup(using: app.db)
                XCTFail("Expected a missing backup directory to be rejected")
            } catch let error as LiveDatabaseBackupError {
                XCTAssertEqual(error.description, LiveDatabaseBackupError.destinationDirectoryMissing.description)
            }

            let sameLocationService = LiveDatabaseBackupService(configuration: .init(
                sourceURL: sourceURL,
                destinationDirectory: sourceURL
            ))
            do {
                _ = try await sameLocationService.createBackup(using: app.db)
                XCTFail("Expected the source path to be rejected as a backup directory")
            } catch let error as LiveDatabaseBackupError {
                XCTAssertEqual(error.description, LiveDatabaseBackupError.destinationDirectoryMissing.description)
            }
        }
    }
}
