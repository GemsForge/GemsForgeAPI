import Fluent
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LiveMigrationAuditRouteTests: XCTestCase {
    func testMigrationHistoryReturnsSafeAuditRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateSchemaMigrationAudits())
            try await app.autoMigrate()
            registerLiveMigrationRoutes(app)

            try await LiveMigrationAuditService(
                database: app.db,
                databaseIdentity: "GemLife.sqlite"
            ).record(
                migrationName: "file-metadata-add-domain-id",
                result: "succeeded",
                backupFileName: "GemLife-backup-test.sqlite"
            )
        }) { app in
            try await app.test(.GET, "live-database/migrations/history") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let history = try response.content.decode([SchemaMigrationAudit].self)
                let record = try XCTUnwrap(history.first)

                XCTAssertEqual(record.migrationName, "file-metadata-add-domain-id")
                XCTAssertEqual(record.result, "succeeded")
                XCTAssertEqual(record.databaseIdentity, "GemLife.sqlite")
                XCTAssertEqual(record.backupFileName, "GemLife-backup-test.sqlite")
                XCTAssertNil(record.failureDetails)
            }
        }
    }
}
