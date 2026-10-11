import Foundation
import Fluent
import SQLKit

/// Provides the auditable history of live schema changes. The service creates
/// the audit table idempotently because an existing personal database may not
/// have received this infrastructure table yet.
struct LiveMigrationAuditService: Sendable {
    let database: any Database
    let databaseIdentity: String

    func ensureTable() async throws {
        guard let sqlDatabase = database as? any SQLDatabase else {
            throw LiveMigrationAuditError.sqliteDatabaseRequired
        }

        try await sqlDatabase.raw(SQLQueryString(stringLiteral: """
            CREATE TABLE IF NOT EXISTS "SchemaMigrationAudits" (
                "AuditID" TEXT PRIMARY KEY NOT NULL,
                "MigrationName" TEXT NOT NULL,
                "AppliedAt" DATETIME NOT NULL,
                "Result" TEXT NOT NULL,
                "DatabaseIdentity" TEXT NOT NULL,
                "BackupFileName" TEXT,
                "FailureDetails" TEXT
            )
            """)).run()
    }

    func record(
        migrationName: String,
        result: String,
        appliedAt: Date = Date(),
        backupFileName: String? = nil,
        failureDetails: String? = nil
    ) async throws {
        try await ensureTable()
        let audit = SchemaMigrationAudit(
            migrationName: migrationName,
            appliedAt: appliedAt,
            result: result,
            databaseIdentity: databaseIdentity,
            backupFileName: backupFileName,
            failureDetails: failureDetails
        )
        try await audit.create(on: database)
    }

    func history() async throws -> [SchemaMigrationAudit] {
        try await ensureTable()
        return try await SchemaMigrationAudit.query(on: database)
            .sort(\.$appliedAt, .descending)
            .all()
    }
}

enum LiveMigrationAuditError: Error, CustomStringConvertible {
    case sqliteDatabaseRequired

    var description: String {
        switch self {
        case .sqliteDatabaseRequired:
            return "Live migration history requires the configured SQLite database."
        }
    }
}
