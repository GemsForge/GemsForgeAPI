import Fluent
import SQLKit
import Vapor

/// Describes where the existing live SQLite database is located and where
/// backups may be written. The service never creates or replaces the source.
struct LiveDatabaseBackupConfiguration: Sendable {
    let sourceURL: URL
    let destinationDirectory: URL

    var isReady: Bool {
        let fileManager = FileManager.default
        var sourceIsDirectory = ObjCBool(false)
        var destinationIsDirectory = ObjCBool(false)

        guard fileManager.fileExists(atPath: sourceURL.path, isDirectory: &sourceIsDirectory), !sourceIsDirectory.boolValue,
              fileManager.fileExists(atPath: destinationDirectory.path, isDirectory: &destinationIsDirectory), destinationIsDirectory.boolValue else {
            return false
        }

        return sourceURL.standardizedFileURL != destinationDirectory.standardizedFileURL
    }
}

/// The public result of a backup operation. The absolute path is intentionally
/// omitted so an API response does not disclose a local filesystem location.
struct LiveDatabaseBackupResult: Content, Sendable {
    let backupFileName: String
    let backupSizeBytes: Int64
    let status: String
}

enum LiveDatabaseBackupError: Error, CustomStringConvertible {
    case sourceDatabaseMissing
    case destinationDirectoryMissing
    case destinationIsSource
    case sqliteDatabaseRequired
    case backupFailed(String)
    case verificationFailed

    var description: String {
        switch self {
        case .sourceDatabaseMissing:
            return "The configured source database does not exist or is not a regular file."
        case .destinationDirectoryMissing:
            return "The configured backup directory does not exist or is not a directory."
        case .destinationIsSource:
            return "The backup directory must be different from the source database path."
        case .sqliteDatabaseRequired:
            return "Live database backup requires the configured SQLite database."
        case .backupFailed(let reason):
            return "The SQLite backup failed: \(reason)"
        case .verificationFailed:
            return "The backup file was not created as a readable, non-empty file."
        }
    }
}

/// Creates a consistent SQLite backup without modifying the live database.
/// SQLite's VACUUM INTO operation copies a transactionally consistent snapshot
/// while the database connection remains open.
struct LiveDatabaseBackupService: Sendable {
    let configuration: LiveDatabaseBackupConfiguration

    init(configuration: LiveDatabaseBackupConfiguration) {
        self.configuration = configuration
    }

    func createBackup(using database: Database) async throws -> LiveDatabaseBackupResult {
        try validateConfiguration()

        guard let sqlDatabase = database as? SQLDatabase else {
            throw LiveDatabaseBackupError.sqliteDatabaseRequired
        }

        let sourceStem = configuration.sourceURL.deletingPathExtension().lastPathComponent
        let backupFileName = "\(sourceStem)-backup-\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString).sqlite"
        let backupURL = configuration.destinationDirectory.appendingPathComponent(backupFileName)

        do {
            let escapedPath = backupURL.path.replacingOccurrences(of: "'", with: "''")
            try await sqlDatabase.raw(SQLQueryString(stringLiteral: "VACUUM INTO '\(escapedPath)'" )).run()
        } catch {
            throw LiveDatabaseBackupError.backupFailed(error.localizedDescription)
        }

        guard let attributes = try? FileManager.default.attributesOfItem(atPath: backupURL.path),
              let size = attributes[.size] as? NSNumber,
              size.int64Value > 0 else {
            throw LiveDatabaseBackupError.verificationFailed
        }

        return LiveDatabaseBackupResult(
            backupFileName: backupFileName,
            backupSizeBytes: size.int64Value,
            status: "created-and-verified"
        )
    }

    private func validateConfiguration() throws {
        let fileManager = FileManager.default
        var sourceIsDirectory = ObjCBool(false)
        var destinationIsDirectory = ObjCBool(false)

        guard fileManager.fileExists(atPath: configuration.sourceURL.path, isDirectory: &sourceIsDirectory), !sourceIsDirectory.boolValue else {
            throw LiveDatabaseBackupError.sourceDatabaseMissing
        }

        guard fileManager.fileExists(atPath: configuration.destinationDirectory.path, isDirectory: &destinationIsDirectory), destinationIsDirectory.boolValue else {
            throw LiveDatabaseBackupError.destinationDirectoryMissing
        }

        guard configuration.sourceURL.standardizedFileURL != configuration.destinationDirectory.standardizedFileURL else {
            throw LiveDatabaseBackupError.destinationIsSource
        }
    }
}
