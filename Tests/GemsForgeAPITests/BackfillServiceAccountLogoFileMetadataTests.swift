import FluentSQLiteDriver
import SQLKit
import Vapor
import XCTest
@testable import GemsForgeAPI

final class BackfillServiceAccountLogoFileMetadataTests: XCTestCase {
    func testCopiesCatalogFileReferencesToServicesAndPreservesExistingValues() async throws {
        let app = try await Application.make(.testing)
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateAuthenticationSchema())
        app.migrations.add(CreateHubs())
        app.migrations.add(MakeAuthenticationProviderAgnostic())
        try await app.autoMigrate()
        try await AuthenticationAccount(id: "account-a").save(on: app.db)
        try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
        let sql = try XCTUnwrap(app.db(.sqlite) as? SQLDatabase)
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE TABLE "Services" (
                "ServiceID" INTEGER PRIMARY KEY,
                "HubID" TEXT,
                "LogoKey" TEXT,
                "LogoFileMetadataID" TEXT
            )
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            CREATE TABLE "ServiceLogoAssets" (
                "LogoAssetID" INTEGER PRIMARY KEY,
                "HubID" TEXT,
                "LogoKey" TEXT UNIQUE,
                "FileMetadataID" TEXT
            )
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            INSERT INTO "ServiceLogoAssets" ("LogoAssetID", "HubID", "LogoKey", "FileMetadataID")
            VALUES (1, 'hub-a', 'INTERNET', 'file-internet'), (2, 'hub-a', 'EMPTY', NULL)
            """)).run()
        try await sql.raw(SQLQueryString(stringLiteral: """
            INSERT INTO "Services" ("ServiceID", "HubID", "LogoKey", "LogoFileMetadataID")
            VALUES
                (10, 'hub-a', 'INTERNET', NULL),
                (11, 'hub-a', 'INTERNET', 'file-custom'),
                (12, 'hub-b', 'INTERNET', NULL),
                (13, 'hub-a', 'EMPTY', NULL),
                (14, 'hub-a', NULL, NULL),
                (15, NULL, 'INTERNET', NULL)
            """)).run()

        let migration = BackfillServiceAccountLogoFileMetadata()
        try await migration.prepare(on: app.db(.sqlite))
        try await migration.prepare(on: app.db(.sqlite))

        let rows = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT "ServiceID", "LogoFileMetadataID" FROM "Services" ORDER BY "ServiceID"
            """)).all()
        XCTAssertEqual(try rows.map { try $0.decode(column: "LogoFileMetadataID", as: String?.self) }, [
            "file-internet", "file-custom", nil, nil, nil, nil,
        ])

        let ownershipService = HubOwnershipMigrationService(
            database: app.db(.sqlite),
            tables: [ServiceAccount.schema, ServiceLogoAsset.schema]
        )
        let ownershipPreview = try await ownershipService.preview(hubID: "hub-a")
        XCTAssertEqual(ownershipPreview.unownedCounts[ServiceAccount.schema], 1)
        _ = try await ownershipService.assignUnowned(
            hubID: "hub-a",
            request: HubOwnershipAssignmentRequest(
                confirmation: HubOwnershipMigrationService.confirmationPhrase,
                expectedUnownedCounts: ownershipPreview.unownedCounts
            )
        )
        let assignedHubRow = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT "LogoFileMetadataID" FROM "Services" WHERE "ServiceID" = 15
            """)).first()
        XCTAssertEqual(try assignedHubRow?.decode(column: "LogoFileMetadataID", as: String.self), "file-internet")
        try await app.asyncShutdown()
    }
}
