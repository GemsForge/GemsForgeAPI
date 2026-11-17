import Fluent
import SQLKit

/// Rewrites SQLite TEXT timestamp columns used by Fluent models into the
/// canonical date-time text format that FluentSQLiteDriver decodes.
struct NormalizeLegacyTextTimestamps: AsyncMigration {
    private let columns: [String: [String]] = [
        "Domains": ["DateCreated", "DateUpdated"],
        "ForgeKeeper": ["DateCreated", "DateUpdated"],
        "ServiceLogoAssets": ["DateCreated", "DateUpdated"],
        "GemHueImages": ["DateCreated", "DateUpdated"],
        "Addresses": ["DateUpdated"],
        "Education": ["DateUpdated"],
        "Employment": ["DateUpdated"],
    ]

    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        let tables = try await LiveSchemaService(database: database).inspect().tables
        for (table, names) in columns where tables.contains(where: { $0.name == table }) {
            for name in names {
                guard let column = tables.first(where: { $0.name == table })?.columns.first(where: { $0.name == name }),
                      column.dataType.uppercased() == "TEXT" else { continue }
                let quotedTable = "\"\(table)\""
                let quotedColumn = "\"\(name)\""
                try await sql.raw(SQLQueryString(stringLiteral: """
                    UPDATE \(quotedTable)
                    SET \(quotedColumn) = datetime(CAST(\(quotedColumn) AS REAL), 'unixepoch')
                    WHERE \(quotedColumn) IS NOT NULL
                      AND trim(CAST(\(quotedColumn) AS TEXT)) != ''
                      AND trim(CAST(\(quotedColumn) AS TEXT)) GLOB '[0-9]*'
                    """)).run()
            }
        }
    }

    func revert(on database: any Database) async throws {}
}
