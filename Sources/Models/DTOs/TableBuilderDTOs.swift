import Vapor

/// SQLite's supported declared type names for tables created by the schema builder.
///
/// The UI sends one of these values from a controlled selection. Keeping this as
/// an enum prevents a request from smuggling arbitrary SQL into a column definition.
enum SQLiteColumnType: String, CaseIterable, Codable, Content, Sendable {
    case any = "ANY"
    case blob = "BLOB"
    case integer = "INTEGER"
    case numeric = "NUMERIC"
    case real = "REAL"
    case text = "TEXT"

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        guard let type = Self(rawValue: value.uppercased()) else {
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Unsupported SQLite column type: \(value)"
            )
        }
        self = type
    }
}

/// A column requested by the schema builder. This describes a column; it does
/// not contain SQL and cannot execute a schema change by itself.
struct TableBuilderColumnRequest: Content, Sendable {
    let name: String
    let dataType: SQLiteColumnType
    let nullable: Bool
    let defaultValue: String?
    let primaryKey: Bool
    let unique: Bool
}

/// The complete user-defined table definition submitted for validation.
struct TableBuilderRequest: Content, Sendable {
    let tableName: String
    let columns: [TableBuilderColumnRequest]
}

/// A normalized definition that later migration code can safely translate into
/// SQLite statements after preview and explicit confirmation.
struct ValidatedTableDefinition: Sendable, Equatable {
    let tableName: String
    let columns: [ValidatedTableColumn]
}

struct ValidatedTableColumn: Sendable, Equatable {
    let name: String
    let dataType: SQLiteColumnType
    let nullable: Bool
    let defaultValue: String?
    let primaryKey: Bool
    let unique: Bool
}
