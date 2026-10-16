import Fluent
import Vapor

/// The only table currently approved for live creation. Future tables must be
/// added here with a reviewed migration rather than accepted from the browser.
enum ApprovedLiveTable: String, CaseIterable, Sendable {
    case fileMetadata = "file-metadata"

    var tableName: String { FileMetadata.schema }

    var columns: [String] {
        ["FileMetadataID", "RelativePath", "FileName", "FileKind", "MimeType", "ByteSize", "Checksum", "OwnerType", "OwnerID"]
    }

    func apply(on database: Database) async throws {
        switch self {
        case .fileMetadata:
            try await CreateFileMetadata().prepare(on: database)
        }
    }
}

struct LiveTableCreationRequest: Content, Sendable {
    let confirmationToken: String
}

struct LiveTableCreationResponse: Content, Sendable {
    let table: String
    let backupFileName: String
    let backupSizeBytes: Int64
    let status: String
}

enum LiveTableCreationError: Error, CustomStringConvertible {
    case backupNotConfigured
    case unsupportedTable
    case tableAlreadyExists
    case migrationFailed(String)
    case verificationFailed

    var description: String {
        switch self {
        case .backupNotConfigured:
            return "Live table creation requires DATABASE_PATH and LIVE_DATABASE_BACKUP_DIRECTORY."
        case .unsupportedTable:
            return "This table is not approved for live creation."
        case .tableAlreadyExists:
            return "The approved table already exists; no changes were made."
        case .migrationFailed(let reason):
            return "The approved table migration failed: \(reason)"
        case .verificationFailed:
            return "The table migration completed but schema verification failed."
        }
    }
}

/// Executes one approved table migration only after token confirmation and a
/// verified SQLite backup have completed.
struct LiveTableCreationService: Sendable {
    let previewService: LiveMigrationPreviewService
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    func execute(_ request: LiveTableCreationRequest, using database: Database) async throws -> LiveTableCreationResponse {
        let plan = try await previewService.confirm(LiveMigrationConfirmationRequest(
            confirmationToken: request.confirmationToken
        ))

        guard plan.operations.count == 1,
              let operation = plan.operations.first,
              operation.operation == "create-table",
              let approvedTable = ApprovedLiveTable(rawValue: "file-metadata"),
              operation.table == approvedTable.tableName,
              operation.columns == approvedTable.columns else {
            throw LiveTableCreationError.unsupportedTable
        }

        let currentSchema = try await LiveSchemaService(database: database).inspect()
        guard !currentSchema.tables.contains(where: { $0.name == approvedTable.tableName }) else {
            throw LiveTableCreationError.tableAlreadyExists
        }

        let backup: LiveDatabaseBackupResult
        do {
            backup = try await VerifiedSchemaChangeExecutor.execute(
                migrationName: "create-\(approvedTable.rawValue)",
                using: database,
                backupConfiguration: backupConfiguration,
                verificationFailureDetails: "The expected table was not found after migration.",
                apply: {
                    try await approvedTable.apply(on: database)
                },
                verify: {
                    let schema = try await LiveSchemaService(database: database).inspect()
                    return schema.tables.contains { $0.name == approvedTable.tableName }
                }
            )
        } catch let error as VerifiedSchemaChangeExecutionError {
            switch error {
            case .backupNotConfigured:
                throw LiveTableCreationError.backupNotConfigured
            case .backupFailed(let reason), .changeFailed(let reason):
                throw LiveTableCreationError.migrationFailed(reason)
            case .verificationFailed:
                throw LiveTableCreationError.verificationFailed
            }
        }

        return LiveTableCreationResponse(
            table: approvedTable.tableName,
            backupFileName: backup.backupFileName,
            backupSizeBytes: backup.backupSizeBytes,
            status: "created-and-verified"
        )
    }
}
