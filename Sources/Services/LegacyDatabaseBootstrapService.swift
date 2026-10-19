import Fluent
import Foundation
import SQLKit
import Vapor

enum LegacyDatabaseBootstrapError: Error, CustomStringConvertible {
    case developmentOnly
    case confirmationRequired
    case databaseMissing
    case sqliteFileRequired
    case backupDirectoryMustBeSeparate
    case backupNotConfigured
    case migrationFailed(String)
    case verificationFailed(String)

    var description: String {
        switch self {
        case .developmentOnly:
            return "Legacy database bootstrap is restricted to the dev and fit environments."
        case .confirmationRequired:
            return "Confirm the exact configured database filename before applying migrations."
        case .databaseMissing:
            return "The configured database file does not exist. Bootstrap will not create or replace it."
        case .sqliteFileRequired:
            return "Legacy database bootstrap requires a regular, non-symlink .sqlite file."
        case .backupDirectoryMustBeSeparate:
            return "The backup directory must be separate from the database's parent directory."
        case .backupNotConfigured:
            return "Set LIVE_DATABASE_BACKUP_DIRECTORY to an existing, separate backup directory."
        case .migrationFailed(let details):
            return "Repository migrations failed. Preserve the verified backup and review the failure before retrying: \(details)"
        case .verificationFailed(let details):
            return "The migrated schema did not pass verification. Preserve the verified backup and review the failure: \(details)"
        }
    }
}

/// Runs the repository migration profile offline for an existing DEV or FIT
/// database. This path exists for first authenticated startup, when protected
/// live migration routes cannot yet be reached because auth tables are missing.
struct LegacyDatabaseBootstrapService: Sendable {
    let environment: DatabaseEnvironment
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    func execute(
        using application: Application,
        confirmationFilename: String
    ) async throws -> LiveRepositoryMigrationExecution {
        guard environment == .dev || environment == .fit else {
            throw LegacyDatabaseBootstrapError.developmentOnly
        }
        guard let backupConfiguration else {
            throw LegacyDatabaseBootstrapError.backupNotConfigured
        }
        try validateTarget(backupConfiguration, confirmationFilename: confirmationFilename)

        let backup = try await LiveDatabaseBackupService(configuration: backupConfiguration)
            .createBackup(using: application.db)
        let audit = LiveMigrationAuditService(
            database: application.db,
            databaseIdentity: backupConfiguration.databaseIdentity
        )

        do {
            try await audit.ensureTable()
            let profile = LocalDatabaseProfile.gemLifeDevelopment
            profile.registerMigrations(on: application)
            try await application.autoMigrate()
            try await Self.verifyOwnershipSchema(on: application.db)
            try await audit.record(
                migrationName: "legacy-database-bootstrap",
                result: "succeeded",
                backupFileName: backup.backupFileName
            )
            return LiveRepositoryMigrationExecution(
                migrationNames: profile.migrationNames,
                backupFileName: backup.backupFileName,
                backupSizeBytes: backup.backupSizeBytes,
                status: "updated-and-verified"
            )
        } catch {
            try? await audit.record(
                migrationName: "legacy-database-bootstrap",
                result: "failed",
                backupFileName: backup.backupFileName,
                failureDetails: error.localizedDescription
            )
            if error is LegacyDatabaseBootstrapError {
                throw error
            }
            throw LegacyDatabaseBootstrapError.migrationFailed(error.localizedDescription)
        }
    }

    func validateTarget(
        _ configuration: LiveDatabaseBackupConfiguration,
        confirmationFilename: String
    ) throws {
        guard environment == .dev || environment == .fit else {
            throw LegacyDatabaseBootstrapError.developmentOnly
        }
        let sourceURL = configuration.sourceURL.standardizedFileURL
        var isDirectory = ObjCBool(false)
        guard FileManager.default.fileExists(atPath: sourceURL.path, isDirectory: &isDirectory) else {
            throw LegacyDatabaseBootstrapError.databaseMissing
        }
        guard !isDirectory.boolValue,
              sourceURL.pathExtension.lowercased() == "sqlite",
              (try? sourceURL.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) != true
        else {
            throw LegacyDatabaseBootstrapError.sqliteFileRequired
        }
        guard confirmationFilename == sourceURL.lastPathComponent else {
            throw LegacyDatabaseBootstrapError.confirmationRequired
        }
        guard configuration.destinationDirectory.standardizedFileURL
            != sourceURL.deletingLastPathComponent().standardizedFileURL
        else {
            throw LegacyDatabaseBootstrapError.backupDirectoryMustBeSeparate
        }
    }

    private static func verifyOwnershipSchema(on database: any Database) async throws {
        guard let sql = database as? any SQLDatabase else {
            throw LegacyDatabaseBootstrapError.verificationFailed("A supported SQLite database is required.")
        }
        let requiredTables = [Hub.schema, AuthenticationSession.schema] + AddHubOwnershipFields.ownedTables
        let tables = try await sql.raw(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).all().map { try $0.decode(column: "name", as: String.self) }
        let tableNames = Set(tables)
        let missingTables = requiredTables.filter { !tableNames.contains($0) }
        guard missingTables.isEmpty else {
            throw LegacyDatabaseBootstrapError.verificationFailed(
                "Required tables are missing: \(missingTables.joined(separator: ", "))."
            )
        }

        var tablesMissingOwnership: [String] = []
        for table in AddHubOwnershipFields.ownedTables {
            let columns = try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA table_info(\"\(table)\")"))
                .all()
            if !columns.contains(where: { (try? $0.decode(column: "name", as: String.self)) == "HubID" }) {
                tablesMissingOwnership.append(table)
            }
        }
        guard tablesMissingOwnership.isEmpty else {
            throw LegacyDatabaseBootstrapError.verificationFailed(
                "Ownership columns are missing from: \(tablesMissingOwnership.joined(separator: ", "))."
            )
        }
    }
}
