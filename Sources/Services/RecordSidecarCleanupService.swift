import Fluent
import SQLKit

/// Deletes Hub-scoped sidecars for a table in one transaction.
enum RecordSidecarCleanupService {
    static func deleteTableSidecars(
        tableName: String,
        hubID: String,
        on database: any Database
    ) async throws {
        try await database.transaction { transaction in
            try await RecordBody.query(on: transaction)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .delete()
            try await RecordPresentation.query(on: transaction)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .delete()

            guard let sql = transaction as? SQLDatabase else { return }
            let definitionTable = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT 1 AS present FROM sqlite_master
                WHERE type = 'table' AND name = 'TableColumnDefinitions'
                LIMIT 1
                """)).first()
            guard definitionTable != nil else { return }

            let columns = try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA table_info(\"TableColumnDefinitions\")")).all()
            let columnNames = try columns.map { try $0.decode(column: "name", as: String.self) }
            guard columnNames.contains("HubID"), columnNames.contains("TableName") else { return }
            var delete = SQLQueryString("DELETE FROM \(ident: "TableColumnDefinitions") WHERE \(ident: "HubID") = ")
            delete.appendInterpolation(bind: hubID)
            delete.appendInterpolation(unsafeRaw: " AND \"TableName\" = ")
            delete.appendInterpolation(bind: tableName)
            try await sql.raw(delete).run()
        }
    }
}
