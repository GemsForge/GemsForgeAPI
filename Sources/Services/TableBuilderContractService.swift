import Foundation

/// Validates schema-builder input before any preview or migration code can use it.
///
/// This service is deliberately separate from table creation. It establishes the
/// contract first; a later issue can use the validated result to build a preview,
/// backup the database, and apply the change transactionally.
struct TableBuilderContractService: Sendable {
    static let maximumColumns = 50
    static let maximumIdentifierLength = 128

    enum ValidationError: Error, CustomStringConvertible, Equatable {
        case emptyTableName
        case invalidIdentifier(String)
        case noColumns
        case tooManyColumns
        case duplicateColumn(String)
        case missingPrimaryKey
        case multiplePrimaryKeys
        case invalidPrimaryKey(String)
        case invalidDefault(String)

        var description: String {
            switch self {
            case .emptyTableName: return "A table name is required."
            case .invalidIdentifier(let value): return "The identifier is invalid: \(value)."
            case .noColumns: return "At least one column is required."
            case .tooManyColumns: return "A table may contain at most \(TableBuilderContractService.maximumColumns) columns."
            case .duplicateColumn(let name): return "The table contains duplicate column names: \(name)."
            case .missingPrimaryKey: return "Exactly one primary-key column is required."
            case .multiplePrimaryKeys: return "Only one primary-key column is allowed."
            case .invalidPrimaryKey(let name): return "The primary-key column is invalid: \(name)."
            case .invalidDefault(let value): return "The default value is not an approved SQLite literal: \(value)."
            }
        }
    }

    func validate(_ request: TableBuilderRequest) throws -> ValidatedTableDefinition {
        let tableName = try normalizedIdentifier(request.tableName)
        guard !request.columns.isEmpty else { throw ValidationError.noColumns }
        guard request.columns.count <= Self.maximumColumns else { throw ValidationError.tooManyColumns }

        var seenNames: Set<String> = []
        var validatedColumns: [ValidatedTableColumn] = []
        var primaryKeyCount = 0

        for column in request.columns {
            let name = try normalizedIdentifier(column.name)
            let comparisonName = name.lowercased()
            guard seenNames.insert(comparisonName).inserted else {
                throw ValidationError.duplicateColumn(name)
            }

            if column.primaryKey {
                primaryKeyCount += 1
                guard column.dataType == .integer || column.dataType == .text,
                      !column.nullable,
                      column.defaultValue == nil else {
                    throw ValidationError.invalidPrimaryKey(name)
                }
            }

            if let defaultValue = column.defaultValue {
                guard Self.isApprovedDefault(defaultValue) else {
                    throw ValidationError.invalidDefault(defaultValue)
                }
            }

            validatedColumns.append(ValidatedTableColumn(
                name: name,
                dataType: column.dataType,
                nullable: column.nullable,
                defaultValue: column.defaultValue,
                primaryKey: column.primaryKey,
                unique: column.unique || column.primaryKey
            ))
        }

        switch primaryKeyCount {
        case 0: throw ValidationError.missingPrimaryKey
        case 1: break
        default: throw ValidationError.multiplePrimaryKeys
        }

        return ValidatedTableDefinition(tableName: tableName, columns: validatedColumns)
    }

    private func normalizedIdentifier(_ value: String) throws -> String {
        let identifier = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !identifier.isEmpty,
              identifier.count <= Self.maximumIdentifierLength,
              let first = identifier.first,
              first.isLetter || first == "_",
              identifier.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }),
              !identifier.hasPrefix("sqlite_"),
              !identifier.hasPrefix("_fluent_") else {
            throw ValidationError.invalidIdentifier(value)
        }
        return identifier
    }

    private static func isApprovedDefault(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        if ["NULL", "CURRENT_TIME", "CURRENT_DATE", "CURRENT_TIMESTAMP"].contains(trimmed.uppercased()) {
            return true
        }

        if trimmed.range(of: #"^-?(0|[1-9][0-9]*)(\.[0-9]+)?$"#, options: .regularExpression) != nil {
            return true
        }

        // SQLite string literals escape a quote by doubling it. No other
        // expression syntax is accepted as a default value.
        guard trimmed.first == "'", trimmed.last == "'", trimmed.count >= 2 else { return false }
        let body = trimmed.dropFirst().dropLast()
        var index = body.startIndex
        while index < body.endIndex {
            if body[index] == "'" {
                let next = body.index(after: index)
                guard next < body.endIndex, body[next] == "'" else { return false }
                index = body.index(after: next)
            } else {
                index = body.index(after: index)
            }
        }
        return true
    }
}
