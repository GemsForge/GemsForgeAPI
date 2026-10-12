import Foundation

/// Validates schema-builder input before any preview or migration code can use it.
///
/// This service is deliberately separate from table creation. It establishes the
/// contract first; a later issue can use the validated result to build a preview,
/// backup the database, and apply the change transactionally.
struct TableBuilderContractService: Sendable {
    static let maximumColumns = 50
    static let minimumUserColumns = 1
    static let maximumIdentifierLength = 128

    enum ValidationError: Error, CustomStringConvertible, Equatable {
        case emptyTableName
        case invalidIdentifier(String)
        case noColumns
        case tooManyColumns
        case duplicateColumn(String)
        case reservedColumn(String)
        case clientManagedPrimaryKey(String)
        case invalidDefault(String)

        var description: String {
            switch self {
            case .emptyTableName: return "A table name is required."
            case .invalidIdentifier(let value): return "The identifier is invalid: \(value)."
            case .noColumns: return "At least one property column is required."
            case .tooManyColumns: return "A table may contain at most \(TableBuilderContractService.maximumColumns - 1) property columns; the API adds ID automatically."
            case .duplicateColumn(let name): return "The table contains duplicate column names: \(name)."
            case .reservedColumn(let name): return "The column name is reserved by the API: \(name)."
            case .clientManagedPrimaryKey(let name): return "The API manages the table ID; \(name) cannot be submitted as a primary key."
            case .invalidDefault(let value): return "The default value is not an approved SQLite literal: \(value)."
            }
        }
    }

    func validate(_ request: TableBuilderRequest) throws -> ValidatedTableDefinition {
        let tableName = try normalizedTableName(request.tableName)
        guard request.columns.count >= Self.minimumUserColumns else { throw ValidationError.noColumns }
        guard request.columns.count <= Self.maximumColumns - 1 else { throw ValidationError.tooManyColumns }

        var seenNames: Set<String> = []
        var validatedColumns: [ValidatedTableColumn] = [
            ValidatedTableColumn(name: "ID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: true, unique: true)
        ]

        for column in request.columns {
            let name = try normalizedIdentifier(column.name)
            let comparisonName = name.lowercased()
            guard comparisonName != "id" else { throw ValidationError.reservedColumn(name) }
            guard seenNames.insert(comparisonName).inserted else {
                throw ValidationError.duplicateColumn(name)
            }

            guard !column.primaryKey else { throw ValidationError.clientManagedPrimaryKey(name) }

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
                primaryKey: false,
                unique: column.unique
            ))
        }

        return ValidatedTableDefinition(tableName: tableName, columns: validatedColumns)
    }

    private func normalizedTableName(_ value: String) throws -> String {
        let tableName = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard tableName.range(of: #"^[A-Z][A-Za-z0-9]*$"#, options: .regularExpression) != nil else {
            throw ValidationError.invalidIdentifier(value)
        }
        return try normalizedIdentifier(tableName)
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
