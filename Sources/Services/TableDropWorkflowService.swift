import Crypto
import Fluent
import SQLKit
import Vapor

struct TableDropFileReference: Content, Sendable, Equatable {
    let fileMetadataID: String
    let relativePath: String
}

struct TableDropBlockingReference: Content, Sendable, Equatable {
    let kind: String
    let table: String
    let hubID: String?
    let name: String
    let reason: String
}

struct TableDropMetadataCounts: Content, Sendable, Equatable {
    let tableViews: Int
    let viewColumnConfigurations: Int
    let viewQueryConfigurations: Int
    let tablePropertyDefinitions: Int
    let tableColumnDefinitions: Int
    let recordPresentations: Int
    let recordBodies: Int
    let trashEntries: Int
    let attachmentReferences: Int
}

struct TableDropPreviewResponse: Content, Sendable, Equatable {
    let tableName: String
    let rowCount: Int
    let totalDatabaseRowCount: Int
    let metadata: TableDropMetadataCounts
    let filesThatWouldBecomeUnreferenced: [TableDropFileReference]
    let blockingReferences: [TableDropBlockingReference]
    let warnings: [String]
    let confirmationToken: String
    let expiresAt: Date
    let status: String
}

struct TableDropConfirmationRequest: Content, Sendable {
    let confirmationToken: String
    let typedTableName: String
}

struct TableDropResponse: Content, Sendable, Equatable {
    let tableName: String
    let rowCount: Int
    let backupFileName: String
    let backupSizeBytes: Int64
    let metadata: TableDropMetadataCounts
    let status: String
}

enum TableDropWorkflowError: Error, CustomStringConvertible {
    case sqliteDatabaseRequired
    case backupNotConfigured
    case backupFailed(String)
    case tableUnavailable
    case notEligible(String)
    case blocked([TableDropBlockingReference])
    case expiredOrUnknownToken
    case typedNameMismatch
    case previewChanged(TableDropPreviewResponse)
    case dropFailed(String)
    case verificationFailed

    var description: String {
        switch self {
        case .sqliteDatabaseRequired: return "Reviewed table deletion requires SQLite."
        case .backupNotConfigured: return "Reviewed table deletion requires DATABASE_PATH and LIVE_DATABASE_BACKUP_DIRECTORY."
        case .backupFailed(let reason): return "A verified database backup could not be created: \(reason)"
        case .tableUnavailable: return "The table is not available in the live schema."
        case .notEligible(let reason): return reason
        case .blocked(let references):
            return references.map(\.reason).joined(separator: " ")
        case .expiredOrUnknownToken: return "The table-drop confirmation token is unknown, expired, or already used."
        case .typedNameMismatch: return "Type the exact table name to confirm deletion."
        case .previewChanged: return "The table or its metadata changed since preview. Review the refreshed preview before confirming again."
        case .dropFailed(let reason): return "The table deletion failed and was rolled back: \(reason)"
        case .verificationFailed: return "The table deletion did not pass verification and was rolled back."
        }
    }
}

/// Hub-scoped preview and confirmation for dropping a single user-created table.
struct TableDropWorkflowService: Sendable {
    struct Snapshot: Sendable, Equatable {
        let tableName: String
        let hubID: String
        let rowCount: Int
        let totalRowCount: Int
        let metadata: TableDropMetadataCounts
        let files: [TableDropFileReference]
        let blockers: [TableDropBlockingReference]
        let fingerprint: String
    }

    struct Approval: Sendable {
        let snapshot: Snapshot
        let expiresAt: Date
    }

    actor ApprovalStore {
        private var approvals: [String: Approval] = [:]

        func issue(snapshot: Snapshot, token: String, expiresAt: Date) {
            let now = expiresAt.addingTimeInterval(-TableDropWorkflowService.tokenLifetime)
            approvals = approvals.filter { $0.value.expiresAt > now }
            approvals[token] = Approval(snapshot: snapshot, expiresAt: expiresAt)
        }

        func consume(_ token: String, now: Date) -> Approval? {
            guard let approval = approvals.removeValue(forKey: token), approval.expiresAt > now else { return nil }
            return approval
        }
    }

    static let tokenLifetime: TimeInterval = 5 * 60
    private let approvals: ApprovalStore
    private let backupConfiguration: LiveDatabaseBackupConfiguration?
    private let auditDatabaseIdentity: String

    init(
        approvals: ApprovalStore = ApprovalStore(),
        backupConfiguration: LiveDatabaseBackupConfiguration?,
        auditDatabaseIdentity: String = "configured Gem Life database"
    ) {
        self.approvals = approvals
        self.backupConfiguration = backupConfiguration
        self.auditDatabaseIdentity = backupConfiguration?.databaseIdentity ?? auditDatabaseIdentity
    }

    func preview(tableName: String, hubID: String, using database: Database, now: Date = Date()) async throws -> TableDropPreviewResponse {
        let snapshot = try await inspect(tableName: tableName, hubID: hubID, using: database)
        let token = UUID().uuidString
        let expiresAt = now.addingTimeInterval(Self.tokenLifetime)
        await approvals.issue(snapshot: snapshot, token: token, expiresAt: expiresAt)
        return response(tableName: tableName, snapshot: snapshot, token: token, expiresAt: expiresAt)
    }

    func confirm(
        tableName: String,
        hubID: String,
        request: TableDropConfirmationRequest,
        using database: Database,
        now: Date = Date()
    ) async throws -> TableDropResponse {
        guard request.typedTableName == tableName else { throw TableDropWorkflowError.typedNameMismatch }
        guard let approval = await approvals.consume(request.confirmationToken, now: now) else {
            throw TableDropWorkflowError.expiredOrUnknownToken
        }
        let current = try await inspect(tableName: tableName, hubID: hubID, using: database)
        guard current == approval.snapshot else {
            let fresh = try await preview(tableName: tableName, hubID: hubID, using: database, now: now)
            throw TableDropWorkflowError.previewChanged(fresh)
        }
        guard current.blockers.isEmpty else { throw TableDropWorkflowError.blocked(current.blockers) }
        guard let backupConfiguration else { throw TableDropWorkflowError.backupNotConfigured }
        guard database is SQLDatabase else { throw TableDropWorkflowError.sqliteDatabaseRequired }

        let backup: LiveDatabaseBackupResult
        do {
            backup = try await VerifiedSchemaChangeExecutor.execute(
                migrationName: auditName(tableName: tableName, snapshot: approval.snapshot),
                using: database,
                backupConfiguration: backupConfiguration,
                verificationFailureDetails: "The table or its owned metadata remained after deletion.",
                apply: {
                    try await self.dropInTransaction(tableName: tableName, hubID: hubID, approval: approval, using: database)
                },
                verify: {
                    try await self.isDropVerified(tableName: tableName, hubID: hubID, using: database)
                }
            )
        } catch let error as VerifiedSchemaChangeExecutionError {
            switch error {
            case .backupNotConfigured:
                throw TableDropWorkflowError.backupNotConfigured
            case .backupFailed(let reason):
                throw TableDropWorkflowError.backupFailed(reason)
            case .changeFailed(let reason):
                if reason == TransactionDropError.changed.errorDescription {
                    let fresh = try await preview(tableName: tableName, hubID: hubID, using: database, now: now)
                    throw TableDropWorkflowError.previewChanged(fresh)
                }
                if reason == TransactionDropError.blocked.errorDescription {
                    let updated = try await inspect(tableName: tableName, hubID: hubID, using: database)
                    throw TableDropWorkflowError.blocked(updated.blockers)
                }
                if reason == TransactionDropError.verification.errorDescription {
                    throw TableDropWorkflowError.verificationFailed
                }
                if reason == TransactionDropError.database.errorDescription {
                    throw TableDropWorkflowError.sqliteDatabaseRequired
                }
                throw TableDropWorkflowError.dropFailed(reason)
            case .verificationFailed:
                throw TableDropWorkflowError.verificationFailed
            }
        }

        return TableDropResponse(
            tableName: tableName,
            rowCount: current.rowCount,
            backupFileName: backup.backupFileName,
            backupSizeBytes: backup.backupSizeBytes,
            metadata: current.metadata,
            status: "dropped-and-verified"
        )
    }

    private enum TransactionDropError: Error, LocalizedError {
        case changed, blocked, verification, database

        var errorDescription: String? {
            switch self {
            case .changed: return "table-drop-preview-changed"
            case .blocked: return "table-drop-became-blocked"
            case .verification: return "table-drop-verification-failed"
            case .database: return "table-drop-sqlite-database-required"
            }
        }
    }

    private func dropInTransaction(tableName: String, hubID: String, approval: Approval, using database: Database) async throws {
        try await database.transaction { transaction in
            let inTransaction = try await self.inspect(tableName: tableName, hubID: hubID, using: transaction)
            guard inTransaction == approval.snapshot else { throw TransactionDropError.changed }
            guard inTransaction.blockers.isEmpty else { throw TransactionDropError.blocked }
            guard let sql = transaction as? SQLDatabase else { throw TransactionDropError.database }

            if try await self.tableExists(TableView.schema, on: sql) {
                var deleteColumns = SQLQueryString("DELETE FROM \(ident: ViewColumnConfiguration.schema) WHERE \(ident: "ViewID") IN (SELECT \(ident: "ViewID") FROM \(ident: TableView.schema) WHERE \(ident: "HubID") = ")
                deleteColumns.appendInterpolation(bind: hubID)
                deleteColumns.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
                deleteColumns.appendInterpolation(bind: tableName)
                deleteColumns.appendInterpolation(unsafeRaw: ")")
                if try await self.tableExists(ViewColumnConfiguration.schema, on: sql) {
                    try await sql.raw(deleteColumns).run()
                }
                var deleteQueries = SQLQueryString("DELETE FROM \(ident: ViewQueryConfiguration.schema) WHERE \(ident: "ViewID") IN (SELECT \(ident: "ViewID") FROM \(ident: TableView.schema) WHERE \(ident: "HubID") = ")
                deleteQueries.appendInterpolation(bind: hubID)
                deleteQueries.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
                deleteQueries.appendInterpolation(bind: tableName)
                deleteQueries.appendInterpolation(unsafeRaw: ")")
                if try await self.tableExists(ViewQueryConfiguration.schema, on: sql) {
                    try await sql.raw(deleteQueries).run()
                }
                var deleteViews = SQLQueryString("DELETE FROM \(ident: TableView.schema) WHERE \(ident: "HubID") = ")
                deleteViews.appendInterpolation(bind: hubID)
                deleteViews.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
                deleteViews.appendInterpolation(bind: tableName)
                try await sql.raw(deleteViews).run()
            }

            try await self.deleteHubTableMetadata(TablePropertyDefinition.schema, tableName: tableName, hubID: hubID, on: sql)
            try await self.deleteHubTableMetadata(TrashEntry.schema, tableName: tableName, hubID: hubID, on: sql)
            try await RecordSidecarCleanupService.deleteTableSidecars(tableName: tableName, hubID: hubID, on: transaction)
            let schema = try await LiveSchemaService(database: transaction).inspect()
            guard let targetTable = schema.tables.first(where: { $0.name == tableName }),
                  let primaryKey = targetTable.columns.first(where: { $0.primaryKey })?.name else {
                throw TransactionDropError.verification
            }
            try await self.deleteAttachmentReferences(tableName: tableName, primaryKey: primaryKey, hubID: hubID, on: sql)

            let validatedSchema = try await LiveSchemaService(database: transaction).inspect()
            let safeTable = try SQLiteSchemaReferenceValidator(schema: validatedSchema).validateTable(named: tableName)
            try await sql.raw(SQLQueryString("DROP TABLE \(ident: safeTable.name)")).run()

            guard try await self.isDropVerified(tableName: tableName, hubID: hubID, using: transaction) else {
                throw TransactionDropError.verification
            }
        }
    }

    private func isDropVerified(tableName: String, hubID: String, using database: Database) async throws -> Bool {
        guard let sql = database as? SQLDatabase else { throw TableDropWorkflowError.sqliteDatabaseRequired }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard !schema.tables.contains(where: { $0.name == tableName }) else { return false }
        let metadata = try await metadataCounts(tableName: tableName, hubID: hubID, on: sql)
        let attachments = try await attachmentReferenceCount(tableName: tableName, hubID: hubID, on: sql)
        return metadata == Self.emptyMetadataCounts && attachments == 0
    }

    private static let emptyMetadataCounts = TableDropMetadataCounts(
        tableViews: 0, viewColumnConfigurations: 0, viewQueryConfigurations: 0,
        tablePropertyDefinitions: 0, tableColumnDefinitions: 0, recordPresentations: 0,
        recordBodies: 0, trashEntries: 0, attachmentReferences: 0
    )

    static let tableNameMetadataTables: Set<String> = [
        TableView.schema,
        TablePropertyDefinition.schema,
        TableColumnDefinition.schema,
        RecordPresentation.schema,
        RecordBody.schema,
        TrashEntry.schema,
    ]

    private func response(tableName: String, snapshot: Snapshot, token: String, expiresAt: Date) -> TableDropPreviewResponse {
        TableDropPreviewResponse(
            tableName: tableName,
            rowCount: snapshot.rowCount,
            totalDatabaseRowCount: snapshot.totalRowCount,
            metadata: snapshot.metadata,
            filesThatWouldBecomeUnreferenced: snapshot.files,
            blockingReferences: snapshot.blockers,
            warnings: [
                "Preview only; the live database is unchanged.",
                "A verified full database backup is created immediately before deletion.",
                "Unreferenced files are reported and are not deleted from storage.",
            ],
            confirmationToken: token,
            expiresAt: expiresAt,
            status: "preview"
        )
    }

    private func inspect(tableName: String, hubID: String, using database: Database) async throws -> Snapshot {
        guard let sql = database as? SQLDatabase else { throw TableDropWorkflowError.sqliteDatabaseRequired }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }) else { throw TableDropWorkflowError.tableUnavailable }
        var blockers: [TableDropBlockingReference] = []
        if !HubOwnedCustomTablePolicy.isDropEligible(table) {
            blockers.append(TableDropBlockingReference(
                kind: "eligibility", table: tableName, hubID: nil, name: tableName,
                reason: "Only eligible user-created Hub-owned tables can be deleted. Built-in and protected tables are never deletable."
            ))
        }
        let foreignKeyReferences = schema.tables.flatMap { source in
            source.foreignKeys.filter { $0.referencedTable == tableName && source.name != tableName }.map { key in
                TableDropBlockingReference(
                    kind: "foreign-key", table: source.name, hubID: nil, name: key.column,
                    reason: "\(source.name).\(key.column) refers to \(tableName). Remove this relationship before deleting the table."
                )
            }
        }
        blockers.append(contentsOf: foreignKeyReferences)
        if try await tableExists(TablePropertyDefinition.schema, on: sql) {
            for definition in try await TablePropertyDefinition.query(on: database).all()
                where definition.tableName != tableName && definition.targetTableName == tableName {
                blockers.append(TableDropBlockingReference(
                    kind: "property-definition", table: definition.tableName, hubID: definition.hubID,
                    name: definition.name,
                    reason: "\(definition.tableName).\(definition.name) references \(tableName). Remove this Relation or Lookup before deleting the table."
                ))
            }
        }
        if try await tableExists(TableView.schema, on: sql) {
            let otherHubViewCount = try await countRows(
                from: TableView.schema,
                where: [("TableName", .text(tableName)), ("HubID", .notEqualText(hubID))],
                on: sql
            )
            if otherHubViewCount > 0 {
                blockers.append(TableDropBlockingReference(
                    kind: "other-hub-view", table: TableView.schema, hubID: nil, name: tableName,
                    reason: "Another Hub has saved views for \(tableName). Remove those references or coordinate deletion with that Hub."
                ))
            }
        }
        if try await tableExists(TablePropertyDefinition.schema, on: sql) {
            let otherHubDefinitionCount = try await countRows(
                from: TablePropertyDefinition.schema,
                where: [("TableName", .text(tableName)), ("HubID", .notEqualText(hubID))],
                on: sql
            )
            if otherHubDefinitionCount > 0 {
                blockers.append(TableDropBlockingReference(
                    kind: "other-hub-property", table: TablePropertyDefinition.schema, hubID: nil, name: tableName,
                    reason: "Another Hub has property metadata for \(tableName); deletion is blocked to preserve that Hub's metadata."
                ))
            }
        }

        let hasHubColumn = table.columns.contains { $0.name == "HubID" }
        let rowCount = hasHubColumn
            ? try await countRows(from: tableName, where: [("HubID", .text(hubID))], on: sql)
            : 0
        let totalRowCount = try await countRows(from: tableName, where: [], on: sql)
        if totalRowCount != rowCount {
            blockers.append(TableDropBlockingReference(
                kind: "other-hub-data", table: tableName, hubID: nil, name: tableName,
                reason: "The table contains rows outside the authenticated Hub. Deletion is blocked to protect other Hub data."
            ))
        }
        var foreignHubMetadataCount = 0
        for metadataTable in Self.tableNameMetadataTables where try await tableExists(metadataTable, on: sql) {
            foreignHubMetadataCount += try await countRows(
                from: metadataTable,
                where: [("TableName", .text(tableName)), ("HubID", .notEqualText(hubID))],
                on: sql
            )
        }
        if foreignHubMetadataCount > 0 {
            blockers.append(TableDropBlockingReference(
                kind: "other-hub-metadata", table: "table metadata", hubID: nil, name: tableName,
                reason: "Another Hub has metadata for \(tableName). Deletion is blocked to preserve that Hub's metadata."
            ))
        }
        if try await tableExists(FileMetadata.schema, on: sql) {
            let otherHubFiles = try await countRows(
                from: FileMetadata.schema,
                where: [("OwnerType", .text(tableName)), ("HubID", .notEqualText(hubID))],
                on: sql
            )
            if otherHubFiles > 0 {
                blockers.append(TableDropBlockingReference(
                    kind: "other-hub-attachments", table: FileMetadata.schema, hubID: nil, name: tableName,
                    reason: "Another Hub has attachment references for \(tableName); deletion is blocked to preserve those references."
                ))
            }
        }
        let validatedPrimaryKey: String?
        if let primaryKeyName = table.columns.first(where: \.primaryKey)?.name {
            validatedPrimaryKey = try SQLiteSchemaReferenceValidator(schema: schema)
                .validateColumn(named: primaryKeyName, inTable: tableName).name
        } else {
            validatedPrimaryKey = nil
            blockers.append(TableDropBlockingReference(
                kind: "primary-key", table: tableName, hubID: nil, name: tableName,
                reason: "The table does not have one primary key and cannot be safely deleted through this workflow."
            ))
        }
        if let validatedPrimaryKey, try await tableExists(FileMetadata.schema, on: sql) {
            let staleReferences = try await staleAttachmentReferenceCount(
                tableName: tableName,
                primaryKey: validatedPrimaryKey,
                hubID: hubID,
                on: sql
            )
            if staleReferences > 0 {
                blockers.append(TableDropBlockingReference(
                    kind: "stale-attachments", table: FileMetadata.schema, hubID: hubID, name: tableName,
                    reason: "The table has \(staleReferences) attachment reference(s) whose owner row is missing. Clean up those references before deleting the table."
                ))
            }
        }
        let metadata = try await metadataCounts(tableName: tableName, hubID: hubID, on: sql)
        let files: [TableDropFileReference]
        let dataFingerprint: String
        if let validatedPrimaryKey {
            files = try await attachmentFiles(tableName: tableName, hubID: hubID, primaryKey: validatedPrimaryKey, on: sql)
            dataFingerprint = try await tableDataFingerprint(table: table, primaryKey: validatedPrimaryKey, on: sql)
        } else {
            files = []
            dataFingerprint = "unkeyed:" + table.columns.map(\.name).joined(separator: "|")
        }
        let canonical = [
            String(rowCount), String(totalRowCount), String(describing: metadata),
            blockers.map(\.reason).sorted().joined(separator: "|"),
            files.map { "\($0.fileMetadataID):\($0.relativePath)" }.sorted().joined(separator: "|"),
            table.columns.map { "\($0.name):\($0.dataType):\($0.nullable):\($0.primaryKey)" }.joined(separator: "|"),
            dataFingerprint,
        ].joined(separator: "\n")
        return Snapshot(
            tableName: tableName,
            hubID: hubID,
            rowCount: rowCount,
            totalRowCount: totalRowCount,
            metadata: metadata,
            files: files,
            blockers: blockers.sorted { ($0.kind, $0.table, $0.name) < ($1.kind, $1.table, $1.name) },
            fingerprint: SHA256.hash(data: Data(canonical.utf8)).map { String(format: "%02x", $0) }.joined()
        )
    }

    private enum FilterValue { case text(String), notEqualText(String) }

    private func countRows(from tableName: String, where filters: [(String, FilterValue)], on sql: SQLDatabase) async throws -> Int {
        var query = SQLQueryString("SELECT COUNT(*) AS \(ident: "rowCount") FROM \(ident: tableName)")
        if !filters.isEmpty {
            query.appendInterpolation(unsafeRaw: " WHERE ")
            for (index, filter) in filters.enumerated() {
                if index > 0 { query.appendInterpolation(unsafeRaw: " AND ") }
                query.appendInterpolation(ident: filter.0)
                switch filter.1 {
                case .text(let value):
                    query.appendInterpolation(unsafeRaw: " = ")
                    query.appendInterpolation(bind: value)
                case .notEqualText(let value):
                    query.appendInterpolation(unsafeRaw: " <> ")
                    query.appendInterpolation(bind: value)
                }
            }
        }
        return try await sql.raw(query).first()?.decode(column: "rowCount", as: Int.self) ?? 0
    }

    private func metadataCounts(tableName: String, hubID: String, on sql: SQLDatabase) async throws -> TableDropMetadataCounts {
        let views = try await countMetadata(TableView.schema, tableName: tableName, hubID: hubID, on: sql)
        let columns = try await countDependentViewMetadata(ViewColumnConfiguration.schema, tableName: tableName, hubID: hubID, on: sql)
        let queries = try await countDependentViewMetadata(ViewQueryConfiguration.schema, tableName: tableName, hubID: hubID, on: sql)
        return TableDropMetadataCounts(
            tableViews: views,
            viewColumnConfigurations: columns,
            viewQueryConfigurations: queries,
            tablePropertyDefinitions: try await countMetadata(TablePropertyDefinition.schema, tableName: tableName, hubID: hubID, on: sql),
            tableColumnDefinitions: try await countMetadata(TableColumnDefinition.schema, tableName: tableName, hubID: hubID, on: sql),
            recordPresentations: try await countMetadata(RecordPresentation.schema, tableName: tableName, hubID: hubID, on: sql),
            recordBodies: try await countMetadata(RecordBody.schema, tableName: tableName, hubID: hubID, on: sql),
            trashEntries: try await countMetadata(TrashEntry.schema, tableName: tableName, hubID: hubID, on: sql),
            attachmentReferences: try await attachmentReferenceCount(tableName: tableName, hubID: hubID, on: sql)
        )
    }

    private func countMetadata(_ tableName: String, tableName target: String, hubID: String, on sql: SQLDatabase) async throws -> Int {
        guard try await tableExists(tableName, on: sql) else { return 0 }
        return try await countRows(from: tableName, where: [("HubID", .text(hubID)), ("TableName", .text(target))], on: sql)
    }

    private func countDependentViewMetadata(_ metadataTable: String, tableName: String, hubID: String, on sql: SQLDatabase) async throws -> Int {
        guard try await tableExists(metadataTable, on: sql), try await tableExists(TableView.schema, on: sql) else { return 0 }
        var query = SQLQueryString("SELECT COUNT(*) AS \(ident: "rowCount") FROM \(ident: metadataTable) WHERE \(ident: "ViewID") IN (SELECT \(ident: "ViewID") FROM \(ident: TableView.schema) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
        query.appendInterpolation(bind: tableName)
        query.appendInterpolation(unsafeRaw: ")")
        return try await sql.raw(query).first()?.decode(column: "rowCount", as: Int.self) ?? 0
    }

    private func attachmentReferenceCount(tableName: String, hubID: String, on sql: SQLDatabase) async throws -> Int {
        guard try await tableExists(FileMetadata.schema, on: sql) else { return 0 }
        var query = SQLQueryString("SELECT COUNT(*) AS \(ident: "rowCount") FROM \(ident: FileMetadata.schema) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerType\" = ")
        query.appendInterpolation(bind: tableName)
        return try await sql.raw(query).first()?.decode(column: "rowCount", as: Int.self) ?? 0
    }

    private func staleAttachmentReferenceCount(tableName: String, primaryKey: String, hubID: String, on sql: SQLDatabase) async throws -> Int {
        guard try await tableExists(FileMetadata.schema, on: sql) else { return 0 }
        var query = SQLQueryString("SELECT COUNT(*) AS \(ident: "rowCount") FROM \(ident: FileMetadata.schema) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerType\" = ")
        query.appendInterpolation(bind: tableName)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerID\" NOT IN (SELECT CAST(")
        query.appendInterpolation(ident: primaryKey)
        query.appendInterpolation(unsafeRaw: " AS TEXT) FROM ")
        query.appendInterpolation(ident: tableName)
        query.appendInterpolation(unsafeRaw: " WHERE \"HubID\" = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: ")")
        return try await sql.raw(query).first()?.decode(column: "rowCount", as: Int.self) ?? 0
    }

    private func attachmentFiles(tableName: String, hubID: String, primaryKey: String, on sql: SQLDatabase) async throws -> [TableDropFileReference] {
        guard try await tableExists(FileMetadata.schema, on: sql) else { return [] }
        var query = SQLQueryString("SELECT \(ident: "FileMetadataID"), \(ident: "RelativePath") FROM \(ident: FileMetadata.schema) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerType\" = ")
        query.appendInterpolation(bind: tableName)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerID\" IN (SELECT CAST(")
        query.appendInterpolation(ident: primaryKey)
        query.appendInterpolation(unsafeRaw: " AS TEXT) FROM ")
        query.appendInterpolation(ident: tableName)
        query.appendInterpolation(unsafeRaw: " WHERE \"HubID\" = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: ") AND NOT EXISTS (SELECT 1 FROM \"FileMetadata\" AS \"other\" WHERE \"other\".\"RelativePath\" = \"FileMetadata\".\"RelativePath\" AND (\"other\".\"HubID\" IS NOT ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " OR \"other\".\"OwnerType\" IS NOT ")
        query.appendInterpolation(bind: tableName)
        query.appendInterpolation(unsafeRaw: " OR \"other\".\"OwnerID\" IS NULL OR \"other\".\"OwnerID\" NOT IN (SELECT CAST(")
        query.appendInterpolation(ident: primaryKey)
        query.appendInterpolation(unsafeRaw: " AS TEXT) FROM ")
        query.appendInterpolation(ident: tableName)
        query.appendInterpolation(unsafeRaw: " WHERE \"HubID\" = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: "))) ORDER BY \"FileMetadataID\"")
        return try await sql.raw(query).all().map {
            TableDropFileReference(
                fileMetadataID: try $0.decode(column: "FileMetadataID", as: String.self),
                relativePath: try $0.decode(column: "RelativePath", as: String.self)
            )
        }
    }

    private func tableDataFingerprint(table: LiveSchemaTableResponse, primaryKey: String, on sql: SQLDatabase) async throws -> String {
        var query = SQLQueryString("SELECT ")
        for (index, column) in table.columns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            query.appendInterpolation(unsafeRaw: "quote(")
            query.appendInterpolation(ident: column.name)
            query.appendInterpolation(unsafeRaw: ") AS ")
            query.appendInterpolation(ident: "value\(index)")
        }
        query.appendInterpolation(unsafeRaw: " FROM ")
        query.appendInterpolation(ident: table.name)
        query.appendInterpolation(unsafeRaw: " ORDER BY ")
        query.appendInterpolation(ident: primaryKey)
        let rows = try await sql.raw(query).all()
        var contents = Data()
        for row in rows {
            for index in table.columns.indices {
                let value = try row.decode(column: "value\(index)", as: String.self)
                contents.append(contentsOf: value.utf8)
                contents.append(0)
            }
            contents.append(10)
        }
        return SHA256.hash(data: contents).map { String(format: "%02x", $0) }.joined()
    }

    private func deleteHubTableMetadata(_ tableName: String, tableName target: String, hubID: String, on sql: SQLDatabase) async throws {
        guard try await tableExists(tableName, on: sql) else { return }
        var query = SQLQueryString("DELETE FROM \(ident: tableName) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
        query.appendInterpolation(bind: target)
        try await sql.raw(query).run()
    }

    private func deleteAttachmentReferences(tableName: String, primaryKey: String, hubID: String, on sql: SQLDatabase) async throws {
        guard try await tableExists(FileMetadata.schema, on: sql) else { return }
        var query = SQLQueryString("DELETE FROM \(ident: FileMetadata.schema) WHERE \(ident: "HubID") = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerType\" = ")
        query.appendInterpolation(bind: tableName)
        query.appendInterpolation(unsafeRaw: " AND \"OwnerID\" IN (SELECT CAST(")
        query.appendInterpolation(ident: primaryKey)
        query.appendInterpolation(unsafeRaw: " AS TEXT) FROM ")
        query.appendInterpolation(ident: tableName)
        query.appendInterpolation(unsafeRaw: " WHERE \"HubID\" = ")
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: ")")
        try await sql.raw(query).run()
    }

    private func tableExists(_ tableName: String, on sql: SQLDatabase) async throws -> Bool {
        let row = try await sql.raw(SQLQueryString(
            "SELECT 1 AS \(ident: "present") FROM sqlite_master WHERE type = 'table' AND name = \(bind: tableName) LIMIT 1"
        )).first()
        return row != nil
    }

    private func auditName(tableName: String, snapshot: Snapshot) -> String {
        let counts = snapshot.metadata
        return "drop-table:\(tableName):rows=\(snapshot.totalRowCount):metadata=views:\(counts.tableViews),viewColumns:\(counts.viewColumnConfigurations),viewQueries:\(counts.viewQueryConfigurations),properties:\(counts.tablePropertyDefinitions),columns:\(counts.tableColumnDefinitions),presentations:\(counts.recordPresentations),bodies:\(counts.recordBodies),trash:\(counts.trashEntries),attachments:\(counts.attachmentReferences)"
    }
}
