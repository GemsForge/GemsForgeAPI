import Fluent
import SQLKit

/// Copies catalog logo references onto Service rows so runtime logo lookup no longer needs LogoKey.
struct ServiceAccountLogoFileMetadataBackfill {
    func run(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }

        try await sql.raw(SQLQueryString(stringLiteral: """
            UPDATE "Services"
            SET "LogoFileMetadataID" = (
                SELECT asset."FileMetadataID"
                FROM "ServiceLogoAssets" AS asset
                WHERE asset."LogoKey" = "Services"."LogoKey"
                  AND "Services"."HubID" IS NOT NULL
                  AND asset."HubID" = "Services"."HubID"
                  AND asset."FileMetadataID" IS NOT NULL
            )
            WHERE "Services"."LogoFileMetadataID" IS NULL
              AND "Services"."LogoKey" IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM "ServiceLogoAssets" AS asset
                  WHERE asset."LogoKey" = "Services"."LogoKey"
                    AND "Services"."HubID" IS NOT NULL
                    AND asset."HubID" = "Services"."HubID"
                    AND asset."FileMetadataID" IS NOT NULL
              )
            """)).run()
    }

}

struct BackfillServiceAccountLogoFileMetadata: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await ServiceAccountLogoFileMetadataBackfill().run(on: database)
    }

    /// This data-only copy is intentionally not reversed; later user edits may replace the copied reference.
    func revert(on database: any Database) async throws {}
}
