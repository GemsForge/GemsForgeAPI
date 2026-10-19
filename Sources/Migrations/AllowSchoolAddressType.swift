import Fluent
import SQLKit

/// Rebuilds the legacy Addresses table so educational institutions are valid
/// address types in SQLite's CHECK constraint.
struct AllowSchoolAddressType: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = OFF")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "ALTER TABLE \"Addresses\" RENAME TO \"Addresses_AddressTypeLegacy\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE TABLE "Addresses" (
                "AddressID" TEXT PRIMARY KEY,
                "AddressType" TEXT NOT NULL DEFAULT 'Residence' CHECK ("AddressType" IN ('Residence', 'Storage', 'Work', 'School', 'Other')),
                "AddressLine1" TEXT, "AddressLine2" TEXT, "City" TEXT, "State" TEXT, "PostalCode" TEXT,
                "Country" TEXT NOT NULL DEFAULT 'US', "StartDate" TEXT, "EndDate" TEXT,
                "AddressStatus" TEXT NOT NULL CHECK ("AddressStatus" IN ('Active', 'Former', 'Unverified')),
                "Notes" TEXT, "ImageFileMetadataID" TEXT, "HubID" TEXT, "DateUpdated" TEXT,
                CHECK ("StartDate" IS NULL OR date("StartDate") IS NOT NULL),
                CHECK ("EndDate" IS NULL OR date("EndDate") IS NOT NULL),
                CHECK ("StartDate" IS NULL OR "EndDate" IS NULL OR date("StartDate") <= date("EndDate")),
                FOREIGN KEY ("ImageFileMetadataID") REFERENCES "FileMetadata" ("FileMetadataID") ON DELETE SET NULL ON UPDATE CASCADE
            )
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: "INSERT INTO \"Addresses\" SELECT * FROM \"Addresses_AddressTypeLegacy\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "DROP TABLE \"Addresses_AddressTypeLegacy\"")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "CREATE INDEX idx_Addresses_Status ON Addresses(AddressStatus)")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "CREATE INDEX idx_Addresses_CityState ON Addresses(City, State)")).run()
        try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA foreign_keys = ON")).run()
    }

    func revert(on database: any Database) async throws {}
}
