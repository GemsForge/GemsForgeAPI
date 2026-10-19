import Fluent
import SQLKit

/// Changes the legacy EmailUpdated text column to a nullable boolean.
struct MakeServiceAccountEmailUpdatedBoolean: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = OFF")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "ALTER TABLE \"Services\" RENAME TO \"Services_EmailUpdatedLegacy\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE TABLE "Services" (
                "ServiceID" INTEGER PRIMARY KEY,
                "Service" TEXT NOT NULL UNIQUE,
                "LogoKey" TEXT,
                "Type" TEXT,
                "ExpenseGroup" TEXT,
                "MonthlyAmount" NUMERIC,
                "InterestRate" NUMERIC,
                "APR" NUMERIC,
                "Due" TEXT,
                "Occurrence" TEXT,
                "Status" TEXT,
                "Since" TEXT,
                "Website" TEXT,
                "Notes" TEXT,
                "NotionPage" TEXT,
                "PaymentMethod" TEXT,
                "AccountNumber" TEXT,
                "EmailUpdated" INTEGER,
                "AssociatedAddress" TEXT,
                "DateCreated" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "DateUpdated" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "ServiceKey" TEXT UNIQUE,
                "LogoFileMetadataID" TEXT,
                "HubID" TEXT,
                FOREIGN KEY ("LogoKey") REFERENCES "ServiceLogoAssets"("LogoKey") ON UPDATE CASCADE ON DELETE SET NULL,
                FOREIGN KEY ("LogoFileMetadataID") REFERENCES "FileMetadata"("FileMetadataID") ON DELETE SET NULL ON UPDATE CASCADE
            )
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            INSERT INTO "Services"
            SELECT "ServiceID", "Service", "LogoKey", "Type", "ExpenseGroup", "MonthlyAmount",
                "InterestRate", "APR", "Due", "Occurrence", "Status", "Since", "Website", "Notes",
                "NotionPage", "PaymentMethod", "AccountNumber",
                CASE
                    WHEN lower(trim("EmailUpdated")) IN ('true', '1') THEN 1
                    WHEN lower(trim("EmailUpdated")) IN ('false', '0') THEN 0
                    ELSE NULL
                END,
                "AssociatedAddress", "DateCreated", "DateUpdated", "ServiceKey", "LogoFileMetadataID", "HubID"
            FROM "Services_EmailUpdatedLegacy"
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP TABLE \"Services_EmailUpdatedLegacy\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "CREATE INDEX idx_Services_LogoKey ON Services(LogoKey)")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = ON")).run()
    }

    func revert(on database: any Database) async throws {
        // The migration is intentionally one-way for the live development database.
    }
}
