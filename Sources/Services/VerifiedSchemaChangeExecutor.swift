import Fluent

enum VerifiedSchemaChangeExecutionError: Error {
    case backupNotConfigured
    case backupFailed(String)
    case changeFailed(String)
    case verificationFailed
}

/// Shares the safety lifecycle for approved schema changes while callers keep
/// ownership of approval, the schema operation, and its verification rule.
struct VerifiedSchemaChangeExecutor {
    static func execute(
        migrationName: String,
        using database: Database,
        backupConfiguration: LiveDatabaseBackupConfiguration?,
        verificationFailureDetails: String,
        apply: () async throws -> Void,
        verify: () async throws -> Bool
    ) async throws -> LiveDatabaseBackupResult {
        guard let backupConfiguration else {
            throw VerifiedSchemaChangeExecutionError.backupNotConfigured
        }

        let audit = LiveMigrationAuditService(
            database: database,
            databaseIdentity: backupConfiguration.databaseIdentity
        )
        try await audit.ensureTable()

        let backup: LiveDatabaseBackupResult
        do {
            backup = try await LiveDatabaseBackupService(configuration: backupConfiguration)
                .createBackup(using: database)
        } catch let error as LiveDatabaseBackupError {
            try? await audit.record(
                migrationName: migrationName,
                result: "failed",
                failureDetails: error.description
            )
            throw VerifiedSchemaChangeExecutionError.backupFailed(error.description)
        }

        do {
            try await apply()
        } catch {
            try? await audit.record(
                migrationName: migrationName,
                result: "failed",
                backupFileName: backup.backupFileName,
                failureDetails: error.localizedDescription
            )
            throw VerifiedSchemaChangeExecutionError.changeFailed(error.localizedDescription)
        }

        guard try await verify() else {
            try? await audit.record(
                migrationName: migrationName,
                result: "verification-failed",
                backupFileName: backup.backupFileName,
                failureDetails: verificationFailureDetails
            )
            throw VerifiedSchemaChangeExecutionError.verificationFailed
        }

        try await audit.record(
            migrationName: migrationName,
            result: "succeeded",
            backupFileName: backup.backupFileName
        )
        return backup
    }
}
