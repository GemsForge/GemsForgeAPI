import Fluent
import SQLKit
import Vapor

/// Server-owned additive schema changes. The browser selects an ID; it never
/// supplies SQL, table definitions, or identifiers for these operations.
enum ApprovedSchemaChange: String, CaseIterable, Sendable {
    case fileMetadataDomainColumn = "file-metadata-add-domain-id"
    case fileMetadataRelativePathIndex = "file-metadata-index-relative-path"

    var operation: String {
        switch self {
        case .fileMetadataDomainColumn: return "add-column-and-foreign-key"
        case .fileMetadataRelativePathIndex: return "add-index"
        }
    }

    var table: String { FileMetadata.schema }

    var affectedColumns: [String] {
        switch self {
        case .fileMetadataDomainColumn: return ["DomainID"]
        case .fileMetadataRelativePathIndex: return ["RelativePath"]
        }
    }

    var warnings: [String] {
        switch self {
        case .fileMetadataDomainColumn:
            return ["Existing FileMetadata rows receive a nullable DomainID."]
        case .fileMetadataRelativePathIndex:
            return ["The index improves lookup performance without changing records."]
        }
    }

    func apply(on database: Database) async throws {
        guard let sqlDatabase = database as? SQLDatabase else {
            throw ApprovedSchemaChangeError.sqliteDatabaseRequired
        }

        switch self {
        case .fileMetadataDomainColumn:
            try await sqlDatabase.raw(SQLQueryString(stringLiteral: """
                ALTER TABLE "FileMetadata"
                ADD COLUMN "DomainID" TEXT
                REFERENCES "Domains" ("DomainID")
                ON DELETE RESTRICT
                ON UPDATE CASCADE
                """)).run()
        case .fileMetadataRelativePathIndex:
            try await sqlDatabase.raw(SQLQueryString(stringLiteral: """
                CREATE INDEX "idx_FileMetadata_RelativePath"
                ON "FileMetadata" ("RelativePath")
                """)).run()
        }
    }

    func isAlreadyApplied(in schema: LiveSchemaResponse) -> Bool {
        guard let table = schema.tables.first(where: { $0.name == self.table }) else { return false }
        switch self {
        case .fileMetadataDomainColumn:
            return table.columns.contains { $0.name == "DomainID" }
        case .fileMetadataRelativePathIndex:
            return table.indexes.contains { $0.name == "idx_FileMetadata_RelativePath" }
        }
    }
}

struct ApprovedSchemaChangePreviewRequest: Content, Sendable {
    let changeID: String
}

struct ApprovedSchemaChangePreview: Content, Sendable {
    let changeID: String
    let operation: String
    let table: String
    let affectedColumns: [String]
    let warnings: [String]
    let confirmationToken: String
    let expiresAt: Date
    let status: String
}

struct ApprovedSchemaChangeExecutionResponse: Content, Sendable {
    let changeID: String
    let table: String
    let backupFileName: String
    let backupSizeBytes: Int64
    let status: String
}

enum ApprovedSchemaChangeError: Error, CustomStringConvertible {
    case unsupportedChange
    case expiredOrUnknownToken
    case sqliteDatabaseRequired
    case alreadyApplied
    case backupNotConfigured
    case migrationFailed(String)
    case verificationFailed

    var description: String {
        switch self {
        case .unsupportedChange: return "This schema change is not approved."
        case .expiredOrUnknownToken: return "The schema-change confirmation token is unknown or expired."
        case .sqliteDatabaseRequired: return "Approved schema changes require SQLite."
        case .alreadyApplied: return "This schema change is already applied; no changes were made."
        case .backupNotConfigured: return "Schema changes require DATABASE_PATH and LIVE_DATABASE_BACKUP_DIRECTORY."
        case .migrationFailed(let reason): return "The approved schema change failed: \(reason)"
        case .verificationFailed: return "The schema change completed but verification failed."
        }
    }
}

/// Previews and executes one named additive change at a time.
struct ApprovedSchemaChangeService: Sendable {
    private let approvals: ApprovedSchemaChangeApprovalStore
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    init(backupConfiguration: LiveDatabaseBackupConfiguration?) {
        self.approvals = ApprovedSchemaChangeApprovalStore()
        self.backupConfiguration = backupConfiguration
    }

    func preview(_ request: ApprovedSchemaChangePreviewRequest, now: Date = Date()) async throws -> ApprovedSchemaChangePreview {
        guard let change = ApprovedSchemaChange(rawValue: request.changeID) else {
            throw ApprovedSchemaChangeError.unsupportedChange
        }

        let token = UUID().uuidString
        let expiresAt = now.addingTimeInterval(5 * 60)
        await approvals.issue(token: token, change: change, expiresAt: expiresAt)

        return ApprovedSchemaChangePreview(
            changeID: change.rawValue,
            operation: change.operation,
            table: change.table,
            affectedColumns: change.affectedColumns,
            warnings: change.warnings + ["A backup is created immediately before execution."],
            confirmationToken: token,
            expiresAt: expiresAt,
            status: "preview"
        )
    }

    func execute(_ request: LiveTableCreationRequest, using database: Database) async throws -> ApprovedSchemaChangeExecutionResponse {
        guard let approval = await approvals.consume(token: request.confirmationToken) else {
            throw ApprovedSchemaChangeError.expiredOrUnknownToken
        }

        let currentSchema = try await LiveSchemaService(database: database).inspect()
        guard !approval.change.isAlreadyApplied(in: currentSchema) else {
            throw ApprovedSchemaChangeError.alreadyApplied
        }
        guard let backupConfiguration else {
            throw ApprovedSchemaChangeError.backupNotConfigured
        }

        let backup: LiveDatabaseBackupResult
        do {
            backup = try await LiveDatabaseBackupService(configuration: backupConfiguration).createBackup(using: database)
        } catch let error as LiveDatabaseBackupError {
            throw ApprovedSchemaChangeError.migrationFailed(error.description)
        }

        do {
            try await approval.change.apply(on: database)
        } catch {
            throw ApprovedSchemaChangeError.migrationFailed(error.localizedDescription)
        }

        let updatedSchema = try await LiveSchemaService(database: database).inspect()
        guard approval.change.isAlreadyApplied(in: updatedSchema) else {
            throw ApprovedSchemaChangeError.verificationFailed
        }

        return ApprovedSchemaChangeExecutionResponse(
            changeID: approval.change.rawValue,
            table: approval.change.table,
            backupFileName: backup.backupFileName,
            backupSizeBytes: backup.backupSizeBytes,
            status: "updated-and-verified"
        )
    }
}

actor ApprovedSchemaChangeApprovalStore {
    private var approvals: [String: (change: ApprovedSchemaChange, expiresAt: Date)] = [:]

    func issue(token: String, change: ApprovedSchemaChange, expiresAt: Date) {
        approvals[token] = (change: change, expiresAt: expiresAt)
    }

    func consume(token: String, now: Date = Date()) -> (change: ApprovedSchemaChange, expiresAt: Date)? {
        guard let approval = approvals.removeValue(forKey: token), approval.expiresAt > now else {
            return nil
        }
        return approval
    }
}
