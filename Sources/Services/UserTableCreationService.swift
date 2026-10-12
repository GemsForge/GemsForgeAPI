import Fluent
import SQLKit
import Vapor

struct UserTablePreviewResponse: Content, Sendable {
    let definition: ValidatedTableDefinition
    let warnings: [String]
    let confirmationToken: String
    let expiresAt: Date
    let status: String
}

struct UserTableCreationResponse: Content, Sendable {
    let table: String
    let backupFileName: String
    let backupSizeBytes: Int64
    let status: String
}

enum UserTableCreationError: Error, CustomStringConvertible {
    case expiredOrUnknownToken
    case backupNotConfigured
    case sqliteDatabaseRequired
    case tableAlreadyExists
    case migrationFailed(String)
    case verificationFailed

    var description: String {
        switch self {
        case .expiredOrUnknownToken: return "The table preview token is unknown or expired."
        case .backupNotConfigured: return "User table creation requires DATABASE_PATH and LIVE_DATABASE_BACKUP_DIRECTORY."
        case .sqliteDatabaseRequired: return "User table creation requires SQLite."
        case .tableAlreadyExists: return "A table with this name already exists; no changes were made."
        case .migrationFailed(let reason): return "The table creation failed: \(reason)"
        case .verificationFailed: return "The table was created but schema verification failed."
        }
    }
}

/// Previews and safely applies a user-defined table after validation and backup.
struct UserTableCreationService: Sendable {
    private struct Approval: Sendable {
        let definition: ValidatedTableDefinition
        let expiresAt: Date
    }

    actor ApprovalStore {
        private var approvals: [String: Approval] = [:]

        func issue(_ definition: ValidatedTableDefinition, token: String, expiresAt: Date) {
            approvals[token] = Approval(definition: definition, expiresAt: expiresAt)
        }

        func consume(_ token: String, now: Date = Date()) -> ValidatedTableDefinition? {
            guard let approval = approvals.removeValue(forKey: token), approval.expiresAt > now else { return nil }
            return approval.definition
        }
    }

    static let tokenLifetime: TimeInterval = 5 * 60
    private let approvals: ApprovalStore
    private let backupConfiguration: LiveDatabaseBackupConfiguration?

    init(
        approvals: ApprovalStore = ApprovalStore(),
        backupConfiguration: LiveDatabaseBackupConfiguration?
    ) {
        self.approvals = approvals
        self.backupConfiguration = backupConfiguration
    }

    func preview(_ request: TableBuilderRequest, using database: Database, now: Date = Date()) async throws -> UserTablePreviewResponse {
        let definition = try TableBuilderContractService().validate(request)
        let schema = try await LiveSchemaService(database: database).inspect()
        guard !schema.tables.contains(where: { $0.name == definition.tableName }) else {
            throw UserTableCreationError.tableAlreadyExists
        }

        let token = UUID().uuidString
        let expiresAt = now.addingTimeInterval(Self.tokenLifetime)
        await approvals.issue(definition, token: token, expiresAt: expiresAt)
        return UserTablePreviewResponse(
            definition: definition,
            warnings: [
                "Preview only: the live database is unchanged.",
                "A verified SQLite backup is created immediately before execution.",
                "The table cannot be dropped through this workflow."
            ],
            confirmationToken: token,
            expiresAt: expiresAt,
            status: "preview"
        )
    }

    func execute(confirmationToken: String, using database: Database) async throws -> UserTableCreationResponse {
        guard let definition = await approvals.consume(confirmationToken) else {
            throw UserTableCreationError.expiredOrUnknownToken
        }
        guard let backupConfiguration else { throw UserTableCreationError.backupNotConfigured }
        guard let sqlDatabase = database as? SQLDatabase else { throw UserTableCreationError.sqliteDatabaseRequired }

        let audit = LiveMigrationAuditService(database: database, databaseIdentity: backupConfiguration.databaseIdentity)
        try await audit.ensureTable()
        let backup: LiveDatabaseBackupResult
        do {
            backup = try await LiveDatabaseBackupService(configuration: backupConfiguration).createBackup(using: database)
        } catch let error as LiveDatabaseBackupError {
            try? await audit.record(migrationName: "create-user-table-\(definition.tableName)", result: "failed", failureDetails: error.description)
            throw UserTableCreationError.migrationFailed(error.description)
        }

        do {
            try await sqlDatabase.raw(SQLQueryString(buildCreateTableSQL(for: definition))).run()
        } catch {
            try? await audit.record(migrationName: "create-user-table-\(definition.tableName)", result: "failed", backupFileName: backup.backupFileName, failureDetails: error.localizedDescription)
            throw UserTableCreationError.migrationFailed(error.localizedDescription)
        }

        let schema = try await LiveSchemaService(database: database).inspect()
        guard schema.tables.contains(where: { $0.name == definition.tableName }) else {
            try? await audit.record(migrationName: "create-user-table-\(definition.tableName)", result: "verification-failed", backupFileName: backup.backupFileName)
            throw UserTableCreationError.verificationFailed
        }

        try await audit.record(migrationName: "create-user-table-\(definition.tableName)", result: "succeeded", backupFileName: backup.backupFileName)
        return UserTableCreationResponse(table: definition.tableName, backupFileName: backup.backupFileName, backupSizeBytes: backup.backupSizeBytes, status: "created-and-verified")
    }

    private func buildCreateTableSQL(for definition: ValidatedTableDefinition) -> String {
        let columns = definition.columns.map { column in
            var declaration = "\(quote(column.name)) \(column.dataType.rawValue)"
            if column.primaryKey { declaration += " PRIMARY KEY" }
            else if !column.nullable { declaration += " NOT NULL" }
            if column.unique && !column.primaryKey { declaration += " UNIQUE" }
            if let defaultValue = column.defaultValue { declaration += " DEFAULT \(defaultValue)" }
            return declaration
        }.joined(separator: ", ")
        return "CREATE TABLE \(quote(definition.tableName)) (\(columns))"
    }

    private func quote(_ identifier: String) -> String {
        "\"\(identifier.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}
