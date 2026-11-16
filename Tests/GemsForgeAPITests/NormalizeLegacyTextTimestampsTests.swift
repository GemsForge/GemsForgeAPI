import XCTest
import Fluent
import FluentSQLiteDriver
import SQLKit
import FluentSQL
import VaporTesting

@testable import GemsForgeAPI

final class NormalizeLegacyTextTimestampsTests: XCTestCase {
    func testMigrationNormalizesLegacyAndNumericTextAndFluentDecodesBoth() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            guard let sql = app.db as? SQLDatabase else { throw LiveSchemaError.sqliteDatabaseRequired }
            try await sql.raw("CREATE TABLE Domains (DomainID TEXT PRIMARY KEY, Title TEXT NOT NULL, Description TEXT, DateCreated TEXT NOT NULL, DateUpdated TEXT NOT NULL)").run()
            try await sql.raw("INSERT INTO Domains VALUES ('legacy', 'Legacy', '', '2026-10-08 07:11:41', '2026-10-08 07:11:41'), ('numeric', 'Numeric', '', '1794864793.508033', '1794864793.508033')").run()
        }) { app in
            guard let sql = app.db as? SQLDatabase else { throw LiveSchemaError.sqliteDatabaseRequired }
            let before = try await sql.raw("SELECT DateCreated FROM Domains WHERE DomainID = 'numeric'").first()
            XCTAssertEqual(try before?.decode(column: "DateCreated", as: String.self), "1794864793.508033")

            try await NormalizeLegacyTextTimestamps().prepare(on: app.db)

            let legacy = try await Domain.find("legacy", on: app.db)
            let numeric = try await Domain.find("numeric", on: app.db)
            XCTAssertNotNil(legacy?.createdAt)
            XCTAssertNotNil(numeric?.createdAt)
            let numericText = try await sql.raw("SELECT DateCreated FROM Domains WHERE DomainID = 'numeric'").first()
            XCTAssertEqual(try numericText?.decode(column: "DateCreated", as: String.self), "2026-11-16 21:33:13")
        }
    }
}
