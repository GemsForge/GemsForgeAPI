import Fluent
import Foundation
import SQLKit
import Vapor

struct ImportableSQLColumn: Content, Sendable, Equatable {
    let name: String
    let dataType: String
    let nullable: Bool
    let primaryKey: Bool
    let defaultValue: String?
}

struct ImportableSQLTable: Content, Sendable {
    let name: String
    let columns: [ImportableSQLColumn]
}

struct ImportableSQLTablesResponse: Content, Sendable {
    let tables: [ImportableSQLTable]
}

struct TableCSVImportPreviewRequest: Content, Sendable {
    let table: String
    let csv: String
    /// CSV header to database column mapping. HubID is always server-assigned.
    let mapping: [String: String]
}

struct TableCSVImportPreviewRow: Content, Sendable {
    let rowNumber: Int
    let values: [String: String]
    let errors: [String]
}

struct TableCSVImportPreviewResponse: Content, Sendable {
    let table: String
    let columns: [ImportableSQLColumn]
    let headers: [String]
    let rows: [TableCSVImportPreviewRow]
    let confirmationToken: String?
    let expiresAt: Date?
    let readyToImport: Bool
}

struct TableCSVImportCommitRequest: Content, Sendable {
    let confirmationToken: String
}

struct TableCSVImportCommitResponse: Content, Sendable {
    let table: String
    let importedCount: Int
    let status: String
}

enum TableCSVImportError: Error, CustomStringConvertible {
    case unavailableDatabase
    case unknownOrProtectedTable
    case invalidCSV(String)
    case invalidMapping(String)
    case previewExpired
    case staleSchema
    case invalidPreview
    case writeConflict
    case tooManyPreviews

    var description: String {
        switch self {
        case .unavailableDatabase: return "Table import requires the configured SQLite database."
        case .unknownOrProtectedTable: return "This table is not available for CSV import."
        case .invalidCSV(let message), .invalidMapping(let message): return message
        case .previewExpired:
            return "This import preview expired. Create a new preview before confirming."
        case .staleSchema:
            return "The table schema changed after preview. Create a new preview before confirming."
        case .invalidPreview: return "The preview contains invalid rows and cannot be imported."
        case .writeConflict:
            return
                "The database rejected one or more rows because of a uniqueness or relationship constraint. No rows were imported; review the data and create a fresh preview."
        case .tooManyPreviews:
            return "There are too many active import previews. Wait a few minutes and try again."
        }
    }
}

/// Dynamic imports are restricted to existing Hub-owned tables and always bind values.
actor TableCSVImportApprovals {
    private struct Approval: Sendable {
        let hubID: String
        let table: String
        let schemaFingerprint: String
        let columns: [String]
        let rows: [[String: String]]
        let expiresAt: Date
    }

    static let lifetime: TimeInterval = 5 * 60
    static let maxCSVBytes = 1_000_000
    static let maxRows = 500
    static let maxActiveApprovals = 20
    static let maxActiveApprovalsPerHub = 5
    private var approvals: [String: Approval] = [:]

    func listTables(database: Database) async throws -> ImportableSQLTablesResponse {
        let schema = try await LiveSchemaService(database: database).inspect()
        let tables = schema.tables.compactMap { table -> ImportableSQLTable? in
            guard HubOwnedCustomTablePolicy.isEligible(table) else { return nil }
            return ImportableSQLTable(name: table.name, columns: Self.importColumns(table.columns))
        }
        return ImportableSQLTablesResponse(tables: tables)
    }

    func preview(_ request: TableCSVImportPreviewRequest, database: Database, hubID: String)
        async throws -> TableCSVImportPreviewResponse
    {
        let now = Date()
        approvals = approvals.filter { $0.value.expiresAt > now }
        let activeHubApprovals = approvals.values.lazy.filter { $0.hubID == hubID }.count
        guard approvals.count < Self.maxActiveApprovals,
            activeHubApprovals < Self.maxActiveApprovalsPerHub
        else {
            throw TableCSVImportError.tooManyPreviews
        }
        guard request.csv.utf8.count <= Self.maxCSVBytes else {
            throw TableCSVImportError.invalidCSV("CSV files must be 1 MB or smaller.")
        }
        guard let resolved = try await importableTable(named: request.table, database: database)
        else {
            throw TableCSVImportError.unknownOrProtectedTable
        }
        let table = resolved.table
        let parsed = try parseCSV(request.csv)
        guard let headers = parsed.first, !headers.isEmpty else {
            throw TableCSVImportError.invalidCSV(
                "CSV must include a header row and at least one data row.")
        }
        guard parsed.count > 1, parsed.count - 1 <= Self.maxRows else {
            throw TableCSVImportError.invalidCSV(
                "CSV must contain between 1 and \(Self.maxRows) data rows.")
        }
        guard Set(headers).count == headers.count,
            headers.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
        else {
            throw TableCSVImportError.invalidCSV("CSV headers must be non-empty and unique.")
        }
        let map = request.mapping
        guard map.keys.allSatisfy(headers.contains) else {
            throw TableCSVImportError.invalidMapping("Mappings must refer to headers in this CSV.")
        }
        let targets = Array(map.values)
        guard Set(targets).count == targets.count else {
            throw TableCSVImportError.invalidMapping("Each table property can be mapped only once.")
        }
        let primaryKeyCount = table.columns.filter(\.primaryKey).count
        guard !targets.isEmpty,
            targets.allSatisfy({ target in
                table.columns.contains(where: {
                    $0.name == target && !Self.isServerManaged($0, primaryKeyCount: primaryKeyCount)
                })
            })
        else {
            throw TableCSVImportError.invalidMapping(
                "Choose valid table properties. HubID is assigned automatically.")
        }

        let insertColumns = targets + ["HubID"]
        let requiredColumns = table.columns.filter { column in
            return (column.primaryKey || !column.nullable) && column.defaultValue == nil
                && !Self.isServerManaged(column, primaryKeyCount: primaryKeyCount)
        }
        let missing = requiredColumns.filter { !insertColumns.contains($0.name) }
        var previews: [TableCSVImportPreviewRow] = []
        var validRows: [[String: String]] = []
        for (index, cells) in parsed.dropFirst().enumerated() {
            let rowNumber = index + 2
            var errors: [String] = []
            if cells.count != headers.count {
                errors.append("Expected \(headers.count) values but found \(cells.count).")
            }
            var values: [String: String] = [:]
            for (header, target) in map {
                guard let offset = headers.firstIndex(of: header), offset < cells.count else {
                    continue
                }
                let value = cells[offset]
                values[target] = value
                if let column = table.columns.first(where: { $0.name == target }) {
                    if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        && !column.nullable && column.defaultValue == nil
                    {
                        errors.append("\(target) is required.")
                    } else if !value.isEmpty && !Self.matchesSQLType(value, type: column.dataType) {
                        errors.append("\(target) must be a valid \(column.dataType) value.")
                    }
                }
            }
            for column in missing {
                errors.append("\(column.name) is required and must be mapped.")
            }
            previews.append(.init(rowNumber: rowNumber, values: values, errors: errors))
            if errors.isEmpty { validRows.append(values) }
        }

        let ready = !previews.isEmpty && previews.allSatisfy { $0.errors.isEmpty }
        var token: String?
        var expiresAt: Date?
        if ready {
            let value = UUID().uuidString
            let expiration = now.addingTimeInterval(Self.lifetime)
            approvals[value] = Approval(
                hubID: hubID, table: table.name, schemaFingerprint: resolved.schemaFingerprint,
                columns: targets, rows: validRows, expiresAt: expiration)
            token = value
            expiresAt = expiration
        }
        return .init(
            table: table.name, columns: table.columns, headers: headers, rows: previews,
            confirmationToken: token, expiresAt: expiresAt, readyToImport: ready)
    }

    func commit(token: String, database: Database, hubID: String) async throws
        -> TableCSVImportCommitResponse
    {
        guard let approval = approvals[token], approval.hubID == hubID else {
            throw TableCSVImportError.previewExpired
        }
        guard approval.expiresAt > Date() else {
            approvals.removeValue(forKey: token)
            throw TableCSVImportError.previewExpired
        }
        approvals.removeValue(forKey: token)
        guard let current = try await importableTable(named: approval.table, database: database),
            current.schemaFingerprint == approval.schemaFingerprint
        else {
            throw TableCSVImportError.staleSchema
        }
        guard database is SQLDatabase else { throw TableCSVImportError.unavailableDatabase }
        do {
            try await database.transaction { transaction in
                guard let sql = transaction as? SQLDatabase else {
                    throw TableCSVImportError.unavailableDatabase
                }
                for row in approval.rows {
                    var values = row
                    let generatedTextPrimaryKey = Self.serverGeneratedPrimaryKey(in: current.table.columns)
                        .flatMap { $0.dataType.uppercased().trimmingCharacters(in: .whitespacesAndNewlines) == "INTEGER" ? nil : $0.name }
                    if let generatedTextPrimaryKey { values[generatedTextPrimaryKey] = UUID().uuidString }
                    let columns = approval.columns + (generatedTextPrimaryKey.map { [$0] } ?? [])
                    var query = SQLQueryString("INSERT INTO \(ident: approval.table) (")
                    for (index, column) in columns.enumerated() {
                        if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
                        query.appendInterpolation(ident: column)
                    }
                    query.appendInterpolation(unsafeRaw: ", \"HubID\") VALUES (")
                    for (index, column) in columns.enumerated() {
                        if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
                        query.appendInterpolation(bind: values[column] ?? "")
                    }
                    query.appendInterpolation(unsafeRaw: ", ")
                    query.appendInterpolation(bind: hubID)
                    query.appendInterpolation(unsafeRaw: ")")
                    try await sql.raw(query).run()
                }
            }
        } catch let error as TableCSVImportError {
            throw error
        } catch {
            throw TableCSVImportError.writeConflict
        }
        return .init(table: approval.table, importedCount: approval.rows.count, status: "imported")
    }

    private func importableTable(named name: String, database: Database) async throws -> (
        table: ImportableSQLTable, schemaFingerprint: String
    )? {
        guard
            let table = try await LiveSchemaService(database: database).inspect().tables.first(
                where: { $0.name == name }),
            HubOwnedCustomTablePolicy.isEligible(table)
        else { return nil }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let fingerprint = try encoder.encode(table).base64EncodedString()
        return (
            ImportableSQLTable(name: table.name, columns: Self.importColumns(table.columns)),
            fingerprint
        )
    }

    private static func importColumns(_ columns: [LiveSchemaColumnResponse])
        -> [ImportableSQLColumn]
    {
        columns.map {
            ImportableSQLColumn(
                name: $0.name, dataType: $0.dataType, nullable: $0.nullable,
                primaryKey: $0.primaryKey, defaultValue: $0.defaultValue)
        }
    }

    private static func isServerManaged(_ column: ImportableSQLColumn, primaryKeyCount: Int) -> Bool {
        column.name == "HubID" || (primaryKeyCount == 1 && column.primaryKey)
    }

    private static func serverGeneratedPrimaryKey(in columns: [ImportableSQLColumn]) -> ImportableSQLColumn? {
        let primaryKeys = columns.filter(\.primaryKey)
        guard primaryKeys.count == 1, let primaryKey = primaryKeys.first else { return nil }
        let type = primaryKey.dataType.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if type == "INTEGER" || type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB") {
            return primaryKey
        }
        return nil
    }

    private static func matchesSQLType(_ value: String, type: String) -> Bool {
        let type = type.uppercased()
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if type.contains("INT") { return Int64(normalized) != nil }
        if ["REAL", "FLOAT", "DOUBLE", "NUMERIC", "DECIMAL"].contains(where: type.contains) {
            return Double(normalized) != nil
        }
        if type.contains("BOOL") {
            return ["0", "1", "true", "false"].contains(normalized.lowercased())
        }
        return true
    }

    private func parseCSV(_ csv: String) throws -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var quoted = false
        var afterQuote = false
        let normalizedCSV = csv.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(
            of: "\r", with: "\n")
        let characters = Array(normalizedCSV)
        var index = 0
        func finishField() {
            row.append(field)
            field = ""
            afterQuote = false
        }
        func finishRow() {
            finishField()
            rows.append(row)
            row = []
        }
        while index < characters.count {
            let character = characters[index]
            if quoted {
                if character == "\"" {
                    if index + 1 < characters.count && characters[index + 1] == "\"" {
                        field.append("\"")
                        index += 1
                    } else {
                        quoted = false
                        afterQuote = true
                    }
                } else {
                    field.append(character)
                }
            } else if afterQuote && character != "," && character != "\n" && !character.isWhitespace
            {
                throw TableCSVImportError.invalidCSV(
                    "Unexpected character after a closing quote near row \(rows.count + 1).")
            } else if character == "\"" {
                guard field.isEmpty else {
                    throw TableCSVImportError.invalidCSV(
                        "Unexpected quote in an unquoted field near row \(rows.count + 1).")
                }
                quoted = true
            } else if character == "," {
                finishField()
            } else if character == "\n" {
                finishRow()
            } else {
                field.append(character)
            }
            index += 1
        }
        guard !quoted else {
            throw TableCSVImportError.invalidCSV("CSV has an unclosed quoted field.")
        }
        if !row.isEmpty || !field.isEmpty || afterQuote { finishRow() }
        return rows
    }
}
