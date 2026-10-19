import Fluent
import SQLKit

/// Converts legacy text values into SQLite integer booleans after the column
/// type migration. SQLite otherwise preserves values such as "FALSE" as text.
struct NormalizeServiceAccountEmailUpdatedValues: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        try await sql.raw(SQLQueryString(stringLiteral: """
            UPDATE "Services"
            SET "EmailUpdated" = CASE
                WHEN lower(trim("EmailUpdated")) IN ('true', '1') THEN 1
                WHEN lower(trim("EmailUpdated")) IN ('false', '0') THEN 0
                ELSE NULL
            END
            WHERE "EmailUpdated" IS NOT NULL
            """)).run()
    }

    func revert(on database: any Database) async throws {}
}
