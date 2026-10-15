import Fluent
import SQLKit

/// Adds missing FileMetadata foreign keys to legacy SQLite tables.
///
/// SQLite requires a table rebuild to add a foreign key to an existing table.
/// This migration validates references first, preserves auxiliary indexes and
/// triggers, and performs each rebuild inside a transaction.
struct AddFileMetadataForeignKeys: AsyncMigration {
    private struct Relationship {
        let table: String
        let column: String
    }

    private let relationships = [
        Relationship(table: "Addresses", column: "ImageFileMetadataID"),
        Relationship(table: "Education", column: "DocumentFileMetadataID"),
        Relationship(table: "HomeInventory", column: "ImageFileMetadataID"),
        Relationship(table: "Services", column: "LogoFileMetadataID"),
        Relationship(table: "Transactions", column: "Image"),
        Relationship(table: "GemHueImages", column: "FileMetadataID"),
        Relationship(table: "ServiceLogoAssets", column: "FileMetadataID")
    ]

    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = OFF")).run()
        do {
            try await database.transaction { transaction in
                guard let sql = transaction as? SQLDatabase else { return }
                for relationship in relationships {
                    try await rebuildIfNeeded(relationship, using: sql)
                }
            }
        } catch {
            try? await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = ON")).run()
            throw error
        }
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = ON")).run()
    }

    func revert(on database: any Database) async throws {}

    private func rebuildIfNeeded(_ relationship: Relationship, using sql: SQLDatabase) async throws {
        let table = quote(relationship.table)
        let column = quote(relationship.column)
        let foreignKeys = try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_key_list(\(table))")).all()
        let present = foreignKeys.contains {
            (try? $0.decode(column: "from", as: String.self)) == relationship.column &&
            (try? $0.decode(column: "table", as: String.self)) == FileMetadata.schema &&
            (try? $0.decode(column: "to", as: String.self)) == "FileMetadataID"
        }
        guard !present else { return }

        let orphans = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT COUNT(*) AS count FROM \(table) AS owner
            LEFT JOIN "\(FileMetadata.schema)" AS metadata
              ON owner.\(column) = metadata."FileMetadataID"
            WHERE owner.\(column) IS NOT NULL
              AND metadata."FileMetadataID" IS NULL
            """)).all()
        let orphanCount = try orphans.first?.decode(column: "count", as: Int.self) ?? 0
        guard orphanCount == 0 else {
            throw MigrationError.orphanedReferences(table: relationship.table, column: relationship.column, count: orphanCount)
        }

        let definitions = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '\(relationship.table)'
            """)).all()
        guard let definition = try definitions.first?.decode(column: "sql", as: String.self) else { return }
        let shadowName = "\(relationship.table)__file_metadata_fk"
        let shadow = quote(shadowName)
        let rewritten = definition
            .replacingOccurrences(of: "CREATE TABLE \(table)", with: "CREATE TABLE \(shadow)")
            .replacingOccurrences(of: "CREATE TABLE \(relationship.table)", with: "CREATE TABLE \(shadow)")
        guard let closing = rewritten.lastIndex(of: ")") else { return }
        let constraint = ", FOREIGN KEY (\(column)) REFERENCES \"\(FileMetadata.schema)\" (\"FileMetadataID\") ON DELETE SET NULL ON UPDATE CASCADE"
        var shadowDefinition = rewritten
        shadowDefinition.insert(contentsOf: constraint, at: closing)

        let auxiliary = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT sql FROM sqlite_master
            WHERE tbl_name = '\(relationship.table)'
              AND type IN ('index', 'trigger') AND sql IS NOT NULL
            """)).all().map { try $0.decode(column: "sql", as: String.self) }

        try await sql.raw(SQLQueryString(stringLiteral: shadowDefinition)).run()
        try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO \(shadow) SELECT * FROM \(table)")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP TABLE \(table)")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "ALTER TABLE \(shadow) RENAME TO \(table)")).run()
        for statement in auxiliary {
            try await sql.raw(SQLQueryString(stringLiteral: statement)).run()
        }
    }

    private func quote(_ identifier: String) -> String {
        "\"\(identifier.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}

private enum MigrationError: Error, CustomStringConvertible {
    case orphanedReferences(table: String, column: String, count: Int)

    var description: String {
        switch self {
        case let .orphanedReferences(table, column, count):
            return "\(table).\(column) contains \(count) orphaned FileMetadata reference(s)"
        }
    }
}
