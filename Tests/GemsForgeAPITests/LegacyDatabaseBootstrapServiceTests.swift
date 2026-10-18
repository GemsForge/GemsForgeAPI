import Fluent
import FluentSQLiteDriver
import SQLKit
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LegacyDatabaseBootstrapServiceTests: XCTestCase {
    func testBootstrapCreatesBackupAppliesSchemaAndRecordsAudit() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LegacyBootstrap-\(UUID().uuidString)")
        let databaseURL = root.appendingPathComponent("GemLife_DB_dev.sqlite")
        let backupDirectory = root.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        XCTAssertTrue(FileManager.default.createFile(atPath: databaseURL.path, contents: Data()))
        defer { try? FileManager.default.removeItem(at: root) }

        let fixtureApp = try await Application.make(.testing)
        fixtureApp.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
        LocalDatabaseProfile.gemLifeDevelopment.registerMigrations(on: fixtureApp)
        try await fixtureApp.autoMigrate()
        try await Address(id: "ADDR-UNASSIGNED", city: "Legacy record", addressStatus: "Former")
            .save(on: fixtureApp.db)
        let fixtureSQL = try XCTUnwrap(fixtureApp.db as? any SQLDatabase)
        for table in [Hub.schema, AuthenticationSession.schema, AppleAuthChallenge.schema, AppleAccount.schema] {
            try await fixtureSQL.raw(SQLQueryString(stringLiteral: "DROP TABLE \"\(table)\"")).run()
        }
        for migrationName in [
            String(reflecting: CreateAuthenticationSchema.self),
            String(reflecting: CreateHubs.self),
            String(reflecting: AddHubOwnershipFields.self),
        ] {
            try await MigrationLog.query(on: fixtureApp.db).filter(\.$name == migrationName).delete()
        }
        try await fixtureApp.asyncShutdown()

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
        }) { app in
            let backupConfiguration = LiveDatabaseBackupConfiguration(
                sourceURL: databaseURL,
                destinationDirectory: backupDirectory
            )
            let result = try await LegacyDatabaseBootstrapService(
                environment: .dev,
                backupConfiguration: backupConfiguration
            ).execute(using: app, confirmationFilename: databaseURL.lastPathComponent)

            XCTAssertEqual(result.status, "updated-and-verified")
            XCTAssertGreaterThan(result.backupSizeBytes, 0)
            XCTAssertTrue(FileManager.default.fileExists(
                atPath: backupDirectory.appendingPathComponent(result.backupFileName).path
            ))

            let sql = try XCTUnwrap(app.db as? any SQLDatabase)
            let appliedTables = try await sql.raw(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).all().map { try $0.decode(column: "name", as: String.self) }
            XCTAssertTrue(appliedTables.contains(Hub.schema))
            XCTAssertTrue(appliedTables.contains(AuthenticationSession.schema))
            XCTAssertTrue(appliedTables.contains("SchemaMigrationAudits"))

            try await AppleAccount(id: "owner-account", appleSubject: "owner-subject").save(on: app.db)
            try await Hub(id: "owner-hub", accountID: "owner-account").save(on: app.db)
            let ownershipPreview = try await HubOwnershipMigrationService(database: app.db)
                .preview(hubID: "owner-hub")
            XCTAssertEqual(ownershipPreview.unownedCounts[Address.schema], 1)
            let stillUnassigned = try await Address.find("ADDR-UNASSIGNED", on: app.db)
            XCTAssertNil(stillUnassigned?.hubID)

            let audit = try await LiveMigrationAuditService(
                database: app.db,
                databaseIdentity: databaseURL.lastPathComponent
            ).history()
            XCTAssertEqual(audit.first?.migrationName, "legacy-database-bootstrap")
            XCTAssertEqual(audit.first?.result, "succeeded")
            XCTAssertEqual(audit.first?.backupFileName, result.backupFileName)
        }
    }

    func testBootstrapRequiresDevAndExactExistingDatabaseFilename() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LegacyBootstrapSafety-\(UUID().uuidString)")
        let databaseURL = root.appendingPathComponent("GemLife_DB_dev.sqlite")
        let backupDirectory = root.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        XCTAssertTrue(FileManager.default.createFile(atPath: databaseURL.path, contents: Data()))
        defer { try? FileManager.default.removeItem(at: root) }

        let configuration = LiveDatabaseBackupConfiguration(
            sourceURL: databaseURL,
            destinationDirectory: backupDirectory
        )
        let productionService = LegacyDatabaseBootstrapService(environment: .prod, backupConfiguration: configuration)
        do {
            try productionService.validateTarget(configuration, confirmationFilename: databaseURL.lastPathComponent)
            XCTFail("Production bootstrap must be rejected.")
        } catch LegacyDatabaseBootstrapError.developmentOnly {
            // Expected.
        }

        let developmentService = LegacyDatabaseBootstrapService(environment: .dev, backupConfiguration: configuration)
        do {
            try developmentService.validateTarget(configuration, confirmationFilename: "another.sqlite")
            XCTFail("A mismatched target confirmation must be rejected.")
        } catch LegacyDatabaseBootstrapError.confirmationRequired {
            // Expected.
        }

        let symlinkURL = root.appendingPathComponent("database-alias.sqlite")
        try FileManager.default.createSymbolicLink(at: symlinkURL, withDestinationURL: databaseURL)
        let symlinkConfiguration = LiveDatabaseBackupConfiguration(
            sourceURL: symlinkURL,
            destinationDirectory: backupDirectory
        )
        do {
            try developmentService.validateTarget(
                symlinkConfiguration,
                confirmationFilename: symlinkURL.lastPathComponent
            )
            XCTFail("A symbolic-link database target must be rejected.")
        } catch LegacyDatabaseBootstrapError.sqliteFileRequired {
            // Expected.
        }

        let colocatedBackupConfiguration = LiveDatabaseBackupConfiguration(
            sourceURL: databaseURL,
            destinationDirectory: root
        )
        do {
            try developmentService.validateTarget(
                colocatedBackupConfiguration,
                confirmationFilename: databaseURL.lastPathComponent
            )
            XCTFail("The database directory cannot be reused as the backup directory.")
        } catch LegacyDatabaseBootstrapError.backupDirectoryMustBeSeparate {
            // Expected.
        }
    }

    func testFailedBootstrapPreservesBackupAndAuditsFailureWithoutReplacingSource() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LegacyBootstrapFailure-\(UUID().uuidString)")
        let databaseURL = root.appendingPathComponent("GemLife_DB_dev.sqlite")
        let backupDirectory = root.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
        XCTAssertTrue(FileManager.default.createFile(atPath: databaseURL.path, contents: Data()))
        defer { try? FileManager.default.removeItem(at: root) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
        }) { app in
            let sql = try XCTUnwrap(app.db as? any SQLDatabase)
            try await sql.raw("CREATE TABLE \"Addresses\" (\"AddressID\" TEXT PRIMARY KEY)").run()

            let backupConfiguration = LiveDatabaseBackupConfiguration(
                sourceURL: databaseURL,
                destinationDirectory: backupDirectory
            )
            do {
                _ = try await LegacyDatabaseBootstrapService(
                    environment: .dev,
                    backupConfiguration: backupConfiguration
                ).execute(using: app, confirmationFilename: databaseURL.lastPathComponent)
                XCTFail("An incompatible existing table should stop the migration.")
            } catch let error as LegacyDatabaseBootstrapError {
                guard case .migrationFailed = error else {
                    return XCTFail("Expected a migration failure, got \(error).")
                }
            }

            let backups = try FileManager.default.contentsOfDirectory(atPath: backupDirectory.path)
            XCTAssertEqual(backups.count, 1)
            XCTAssertGreaterThan(try Data(contentsOf: databaseURL).count, 0)
            let history = try await LiveMigrationAuditService(
                database: app.db,
                databaseIdentity: databaseURL.lastPathComponent
            ).history()
            XCTAssertEqual(history.first?.result, "failed")
            XCTAssertNotNil(history.first?.failureDetails)
            let rows = try await sql.raw("PRAGMA table_info(\"Addresses\")").all()
            XCTAssertEqual(rows.count, 1, "A failed bootstrap must not replace the existing table.")
        }
    }
}
