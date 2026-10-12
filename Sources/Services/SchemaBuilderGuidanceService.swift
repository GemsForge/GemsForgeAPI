import Vapor

/// Describes one SQLite type that the schema builder makes available to users.
struct SchemaBuilderTypeGuidance: Content, Sendable, Equatable {
    let value: SQLiteColumnType
    let label: String
    let description: String
}

/// A server-owned rule that the UI can explain before a table is created.
struct SchemaBuilderRuleGuidance: Content, Sendable, Equatable {
    let key: String
    let title: String
    let description: String
    let severity: String
}

/// The complete, versioned guidance catalog for the schema-builder workflow.
///
/// This is intentionally data, not executable SQL. The API can evolve the
/// explanations independently while the validator remains the authority that
/// accepts or rejects a table definition.
struct SchemaBuilderGuidance: Content, Sendable, Equatable {
    let version: String
    let supportedTypes: [SchemaBuilderTypeGuidance]
    let rules: [SchemaBuilderRuleGuidance]
}

/// Returns the authoritative SQLite rules used by the schema-builder UI.
struct SchemaBuilderGuidanceService: Sendable {
    func guidance() -> SchemaBuilderGuidance {
        SchemaBuilderGuidance(
            version: "1",
            supportedTypes: [
                .init(value: .any, label: "ANY", description: "Accepts any SQLite storage class."),
                .init(value: .blob, label: "BLOB", description: "Stores raw bytes; use FileMetadata for uploaded files."),
                .init(value: .integer, label: "INTEGER", description: "Stores whole numbers."),
                .init(value: .numeric, label: "NUMERIC", description: "Stores numeric values using SQLite affinity rules."),
                .init(value: .real, label: "REAL", description: "Stores floating-point numbers."),
                .init(value: .text, label: "TEXT", description: "Stores human-readable text, identifiers, and dates."),
            ],
            rules: [
                .init(key: "table-name", title: "Use UpperCamelCase", description: "Table names must use UpperCamelCase, begin with an uppercase letter, contain only letters and numbers, and stay within 128 characters.", severity: "error"),
                .init(key: "column-name", title: "Use safe column names", description: "Column names follow the same safe identifier rules as table names and must be unique without regard to case.", severity: "error"),
                .init(key: "primary-key", title: "The API supplies the ID", description: "The API adds a required, unique TEXT ID primary key to every new table. Define property columns only; do not submit an ID or primary key.", severity: "info"),
                .init(key: "columns", title: "Add at least one property", description: "A user-defined table must contain at least one property column. The API adds ID automatically, and up to 49 user properties are supported.", severity: "warning"),
                .init(key: "defaults", title: "Use literal defaults", description: "Defaults may be NULL, CURRENT_TIME, CURRENT_DATE, CURRENT_TIMESTAMP, a number, or a quoted SQLite string literal. Arbitrary expressions are rejected.", severity: "error"),
                .init(key: "nullable", title: "Use required fields intentionally", description: "Mark a column required only when every future record must provide a value. Primary keys are always required.", severity: "warning"),
                .init(key: "files", title: "Keep files outside SQLite", description: "Store uploaded images and documents in the local file store and keep their path, checksum, and metadata in FileMetadata instead of embedding large BLOB values in user tables.", severity: "info"),
                .init(key: "preview-first", title: "Preview before applying", description: "Review the generated definition and backup notice before execution. Preview does not change the database; execution requires explicit confirmation.", severity: "info"),
            ]
        )
    }
}
