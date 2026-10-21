import Fluent
import Foundation

extension TableViewSchemaDriftPolicy: Equatable {}

/// Optional identity used to make a stale logical reference actionable to a
/// caller without coupling the validator to the TableView model.
struct TableViewReferenceContext: Sendable, Equatable, CustomStringConvertible {
    let viewID: String?
    let viewName: String?

    init(viewID: String? = nil, viewName: String? = nil) {
        self.viewID = viewID
        self.viewName = viewName
    }

    var description: String {
        var parts: [String] = []
        if let viewName, !viewName.isEmpty { parts.append("\"\(viewName)\"") }
        if let viewID, !viewID.isEmpty { parts.append("ID \"\(viewID)\"") }
        return parts.isEmpty ? "" : " for View \(parts.joined(separator: ", "))"
    }
}
/// A reference error is also the drift report. The saved metadata is not
/// changed, and callers can expose `driftPolicy` to make that behavior
/// explicit in an API response or audit record.
enum SQLiteSchemaReferenceValidationError: Error, CustomStringConvertible, Equatable, Sendable {
    case invalidIdentifier(kind: String, value: String, context: TableViewReferenceContext?)
    case missingTable(tableName: String, context: TableViewReferenceContext?, driftPolicy: TableViewSchemaDriftPolicy)
    case missingColumn(tableName: String, columnName: String, context: TableViewReferenceContext?, driftPolicy: TableViewSchemaDriftPolicy)

    var isSchemaDrift: Bool {
        switch self {
        case .missingTable, .missingColumn: return true
        case .invalidIdentifier: return false
        }
    }

    var driftPolicy: TableViewSchemaDriftPolicy? {
        switch self {
        case .missingTable(_, _, let policy), .missingColumn(_, _, _, let policy): return policy
        case .invalidIdentifier: return nil
        }
    }

    var description: String {
        switch self {
        case .invalidIdentifier(let kind, let value, let context):
            return "The SQLite \(kind) reference must be a non-empty exact logical identifier; received \"\(value)\"\(contextDescription(context))."
        case .missingTable(let tableName, let context, let policy):
            return "The exact SQLite table \"\(tableName)\" is unavailable\(contextDescription(context)). Saved metadata is preserved and reported as stale under the \(policy.rawValue) policy; no similar name is substituted."
        case .missingColumn(let tableName, let columnName, let context, let policy):
            return "The exact SQLite column \"\(columnName)\" is unavailable in table \"\(tableName)\"\(contextDescription(context)). Saved metadata is preserved and reported as stale under the \(policy.rawValue) policy; no similar name is substituted."
        }
    }

    private func contextDescription(_ context: TableViewReferenceContext?) -> String {
        context.map(\.description) ?? ""
    }
}
/// Validates references against an already captured live SQLite schema.
/// Matching is intentionally exact and case-sensitive at the logical metadata
/// boundary; SQLite name guessing and case-folding are not performed.
struct SQLiteSchemaReferenceValidator: Sendable {
    let schema: LiveSchemaResponse
    let driftPolicy: TableViewSchemaDriftPolicy

    init(schema: LiveSchemaResponse, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.schema = schema
        self.driftPolicy = driftPolicy
    }

    func validateTable(
        named tableName: String,
        context: TableViewReferenceContext? = nil
    ) throws -> LiveSchemaTableResponse {
        guard Self.isLogicalIdentifier(tableName) else {
            throw SQLiteSchemaReferenceValidationError.invalidIdentifier(kind: "table", value: tableName, context: context)
        }
        guard let table = schema.tables.first(where: { $0.name == tableName }) else {
            throw SQLiteSchemaReferenceValidationError.missingTable(
                tableName: tableName,
                context: context,
                driftPolicy: driftPolicy
            )
        }
        return table
    }

    func validateColumn(
        named columnName: String,
        inTable tableName: String,
        context: TableViewReferenceContext? = nil
    ) throws -> LiveSchemaColumnResponse {
        guard Self.isLogicalIdentifier(columnName) else {
            throw SQLiteSchemaReferenceValidationError.invalidIdentifier(kind: "column", value: columnName, context: context)
        }
        let table = try validateTable(named: tableName, context: context)
        guard let column = table.columns.first(where: { $0.name == columnName }) else {
            throw SQLiteSchemaReferenceValidationError.missingColumn(
                tableName: tableName,
                columnName: columnName,
                context: context,
                driftPolicy: driftPolicy
            )
        }
        return column
    }

    func validateReference(
        tableName: String,
        columnName: String? = nil,
        context: TableViewReferenceContext? = nil
    ) throws -> LiveSchemaColumnResponse? {
        if let columnName {
            return try validateColumn(named: columnName, inTable: tableName, context: context)
        }
        _ = try validateTable(named: tableName, context: context)
        return nil
    }

    private static func isLogicalIdentifier(_ value: String) -> Bool {
        guard !value.isEmpty,
              value.count <= 128,
              let first = value.first,
              first.isLetter || first == "_",
              value.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }),
              !value.hasPrefix("sqlite_"),
              !value.hasPrefix("_fluent_") else {
            return false
        }
        return true
    }
}
/// Live facade used by persistence or route boundaries. It always obtains the
/// reference set through LiveSchemaService.inspect() before validating.
struct LiveSchemaReferenceValidator: Sendable {
    let database: Database
    let driftPolicy: TableViewSchemaDriftPolicy

    init(database: Database, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.database = database
        self.driftPolicy = driftPolicy
    }

    func inspect() async throws -> LiveSchemaResponse {
        try await LiveSchemaService(database: database).inspect()
    }

    func validateTable(
        named tableName: String,
        context: TableViewReferenceContext? = nil
    ) async throws -> LiveSchemaTableResponse {
        let validator = SQLiteSchemaReferenceValidator(schema: try await inspect(), driftPolicy: driftPolicy)
        return try validator.validateTable(named: tableName, context: context)
    }

    func validateColumn(
        named columnName: String,
        inTable tableName: String,
        context: TableViewReferenceContext? = nil
    ) async throws -> LiveSchemaColumnResponse {
        let validator = SQLiteSchemaReferenceValidator(schema: try await inspect(), driftPolicy: driftPolicy)
        return try validator.validateColumn(named: columnName, inTable: tableName, context: context)
    }
}
