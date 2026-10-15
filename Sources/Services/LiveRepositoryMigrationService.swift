import Fluent
import Vapor

struct LiveRepositoryMigrationPreview: Content, Sendable {
    let migrationNames: [String]
    let confirmationToken: String
    let expiresAt: Date
    let status: String
}

struct LiveRepositoryMigrationExecution: Content, Sendable {
    let migrationNames: [String]
    let backupFileName: String
    let backupSizeBytes: Int64
    let status: String
}

struct LiveRepositoryMigrationRequest: Content, Sendable {
    let confirmationToken: String
}

/// Provides the only live-database path for applying repository migrations.
/// The caller must preview first; execution backs up before autoMigrate.
actor LiveRepositoryMigrationApprovalStore {
    private var approvals: [String: Date] = [:]

    func issue(_ token: String, expiresAt: Date) { approvals[token] = expiresAt }

    func consume(_ token: String, now: Date = Date()) -> Bool {
        guard let expiresAt = approvals.removeValue(forKey: token), expiresAt > now else { return false }
        return true
    }
}

struct LiveRepositoryMigrationService: Sendable {
    private let approvals: LiveRepositoryMigrationApprovalStore
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    init(backupConfiguration: LiveDatabaseBackupConfiguration?) {
        self.approvals = LiveRepositoryMigrationApprovalStore()
        self.backupConfiguration = backupConfiguration
    }

    func preview() async -> LiveRepositoryMigrationPreview {
        let names = LocalDatabaseProfile.gemLifeDevelopment.migrationNames
        let token = UUID().uuidString
        let expiresAt = Date().addingTimeInterval(5 * 60)
        await approvals.issue(token, expiresAt: expiresAt)
        return LiveRepositoryMigrationPreview(
            migrationNames: names,
            confirmationToken: token,
            expiresAt: expiresAt,
            status: "preview"
        )
    }

    func execute(_ request: LiveRepositoryMigrationRequest, using application: Application) async throws -> LiveRepositoryMigrationExecution {
        guard await approvals.consume(request.confirmationToken) else {
            throw Abort(.conflict, reason: "The migration confirmation token is unknown or expired.")
        }
        guard let backupConfiguration else {
            throw Abort(.serviceUnavailable, reason: "Live migrations require DATABASE_PATH and LIVE_DATABASE_BACKUP_DIRECTORY.")
        }

        let audit = LiveMigrationAuditService(database: application.db, databaseIdentity: backupConfiguration.databaseIdentity)
        try await audit.ensureTable()
        let backup = try await LiveDatabaseBackupService(configuration: backupConfiguration).createBackup(using: application.db)
        let profile = LocalDatabaseProfile.gemLifeDevelopment
        profile.registerMigrations(on: application)

        do {
            try await application.autoMigrate()
        } catch {
            try? await audit.record(
                migrationName: "repository-migrations",
                result: "failed",
                backupFileName: backup.backupFileName,
                failureDetails: error.localizedDescription
            )
            throw Abort(.unprocessableEntity, reason: "Repository migrations failed: \(error.localizedDescription)")
        }

        try await audit.record(
            migrationName: "repository-migrations",
            result: "succeeded",
            backupFileName: backup.backupFileName
        )
        return LiveRepositoryMigrationExecution(
            migrationNames: profile.migrationNames,
            backupFileName: backup.backupFileName,
            backupSizeBytes: backup.backupSizeBytes,
            status: "updated-and-verified"
        )
    }
}
