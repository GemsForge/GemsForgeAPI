import XCTest
import Fluent
import FluentSQLiteDriver
import SQLKit
import VaporTesting

@testable import GemsForgeAPI

final class NormalizeLegacyTextTimestampsTests: XCTestCase {
    func testMigrationAndFluentWritesRemainReadableOnLegacyTextTables() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            guard let sql = app.db as? SQLDatabase else { throw LiveSchemaError.sqliteDatabaseRequired }
            try await sql.raw("CREATE TABLE Domains (DomainID TEXT PRIMARY KEY, Title TEXT NOT NULL, Description TEXT, DateCreated TEXT NOT NULL, DateUpdated TEXT NOT NULL)").run()
            try await sql.raw("CREATE TABLE ForgeKeeper (ForgeKeeperID INTEGER PRIMARY KEY AUTOINCREMENT, HubID TEXT, ParentID INTEGER, DomainID TEXT NOT NULL REFERENCES Domains(DomainID), Title TEXT NOT NULL, Description TEXT, DateCreated TEXT NOT NULL, DateUpdated TEXT NOT NULL)").run()
            try await sql.raw("INSERT INTO Domains VALUES ('legacy', 'Legacy', '', '2026-10-08 07:11:41', '2026-10-08 07:11:41')").run()
            try await sql.raw("INSERT INTO ForgeKeeper (DomainID, Title, Description, DateCreated, DateUpdated) VALUES ('legacy', 'Legacy page', '', '1794864793.508033', '1794864793.508033')").run()
            try await NormalizeLegacyTextTimestamps().prepare(on: app.db)
        }) { app in
            let domainService = DomainService(database: app.db)
            let domain = Domain(id: "created", title: "Created", description: "Created after migration")
            try await domainService.save(domain)
            domain.title = "Updated domain"
            try await domainService.save(domain)
            let listedDomains = try await domainService.list()
            XCTAssertTrue(listedDomains.contains { $0.id == "created" && $0.title == "Updated domain" && $0.createdAt != nil && $0.updatedAt != nil })

            let pageService = ForgeKeeperService(database: app.db)
            let page = ForgeKeeper(domainID: "created", title: "Created page", description: "Created after migration")
            try await pageService.save(page)
            page.title = "Updated page"
            try await pageService.save(page)
            let listedRoots = try await pageService.listRoots()
            XCTAssertTrue(listedRoots.contains { $0.title == "Updated page" && $0.createdAt != nil && $0.updatedAt != nil })

            guard let sql = app.db as? SQLDatabase else { throw LiveSchemaError.sqliteDatabaseRequired }
            let stored = try await sql.raw("SELECT DateCreated FROM Domains WHERE DomainID = 'created'").first()
            XCTAssertTrue(try XCTUnwrap(stored?.decode(column: "DateCreated", as: String.self)).contains("T"))
        }
    }

    func testFreshDatetimeTablesSupportCreateUpdateAndList() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
        }) { app in
            let domainService = DomainService(database: app.db)
            let domain = Domain(id: "fresh", title: "Fresh", description: "Fresh schema")
            try await domainService.save(domain)
            domain.title = "Fresh updated"
            try await domainService.save(domain)
            let domains = try await domainService.list()
            XCTAssertTrue(domains.contains { $0.title == "Fresh updated" && $0.createdAt != nil })

            let pageService = ForgeKeeperService(database: app.db)
            let page = ForgeKeeper(domainID: "fresh", title: "Fresh page", description: "Fresh schema")
            try await pageService.save(page)
            page.title = "Fresh page updated"
            try await pageService.save(page)
            let roots = try await pageService.listRoots()
            XCTAssertTrue(roots.contains { $0.title == "Fresh page updated" && $0.updatedAt != nil })
        }
    }

    func testServiceLogoAssetTimestampWritesRemainReadableOnLegacyTextTable() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            guard let sql = app.db as? SQLDatabase else { throw LiveSchemaError.sqliteDatabaseRequired }
            try await sql.raw("CREATE TABLE ServiceLogoAssets (LogoAssetID INTEGER PRIMARY KEY AUTOINCREMENT, HubID TEXT, Logo BLOB NOT NULL, MimeType TEXT NOT NULL, FileName TEXT, FileSizeBytes INTEGER, DateCreated TEXT NOT NULL, DateUpdated TEXT NOT NULL, LogoKey TEXT, FileMetadataID TEXT)").run()
            try await sql.raw("INSERT INTO ServiceLogoAssets (Logo, MimeType, DateCreated, DateUpdated) VALUES (X'00', 'image/png', '1794864793.508033', '1794864793.508033')").run()
            try await NormalizeLegacyTextTimestamps().prepare(on: app.db)
        }) { app in
            let created = ServiceLogoAsset()
            created.logo = Data([1, 2, 3])
            created.mimeType = "image/png"
            created.fileName = "created.png"
            created.fileSizeBytes = 3
            try await created.save(on: app.db)
            created.fileName = "updated.png"
            try await created.update(on: app.db)

            let listed = try await ServiceLogoAsset.query(on: app.db).all()
            XCTAssertTrue(listed.contains { $0.id == created.id && $0.fileName == "updated.png" && $0.createdAt != nil && $0.updatedAt != nil })
        }
    }
}
