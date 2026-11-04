import Crypto
import Fluent
import SQLKit
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

struct CreateSchemaPageFixtures: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("SchemaPageFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .field("Quantity", .int, .required)
            .create()
        try await database.schema("UnscopedFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("Name", .string, .required)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("UnscopedFixture").delete()
        try await database.schema("SchemaPageFixture").delete()
    }
}

final class SchemaPageServiceTests: XCTestCase {
    func testListsScopedSchemaPagesAndReadsOnlyTheAuthenticatedHubsRows() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a'), ('account-b', 'subject-b')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A'), ('hub-b', 'account-b', 'B')").run()
            try await sql.raw("""
                INSERT INTO "SchemaPageFixture" ("ID", "HubID", "Name", "Quantity") VALUES
                ('a1', 'hub-a', 'Desk', 1), ('a2', 'hub-a', 'Chair', 2), ('b1', 'hub-b', 'Lamp', 3)
                """).run()
        }) { app in
            let service = SchemaPageService(database: app.db, hubID: "hub-a")
            let initialTables = try await service.listTables()
            XCTAssertTrue(initialTables.tables.isEmpty)
            XCTAssertEqual(initialTables.availableTables.map(\.name), ["SchemaPageFixture"])
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            let tables = try await service.listTables()
            XCTAssertEqual(tables.tables.map(\.name), ["SchemaPageFixture"])
            XCTAssertTrue(tables.availableTables.isEmpty)
            let otherHubTables = try await SchemaPageService(database: app.db, hubID: "hub-b").listTables()
            XCTAssertTrue(otherHubTables.tables.isEmpty)
            let registeredViews = try await TableView.query(on: app.db).filter(\.$hubID == "hub-a").count()
            XCTAssertEqual(registeredViews, 1)

            let firstPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 0)
            XCTAssertEqual(firstPage.totalCount, 2)
            XCTAssertEqual(firstPage.rows.count, 1)
            XCTAssertEqual(firstPage.rows[0]["Name"]!, "Desk")

            let secondPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 1)
            XCTAssertEqual(secondPage.rows[0]["Name"]!, "Chair")

            do {
                _ = try await service.records(tableName: "UnscopedFixture", limit: 10, offset: 0)
                XCTFail("Tables without required HubID ownership must not become pages.")
            } catch let error as SchemaPageError {
                XCTAssertEqual(error, .tableUnavailable)
            }
        }
    }

    func testSchemaPageRoutesRequireAnAuthenticatedHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerSchemaPageRoutes(app)
        }) { app in
            try await app.test(.GET, "schema-builder/tables") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.GET, "schema-builder/tables/SchemaPageFixture/records") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testAuthenticatedHubCanRegisterAndListOnlyItsSchemaPages() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerSchemaPageRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")

            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(SchemaPageTableResponse.self).name, "SchemaPageFixture")
            }
            try await app.test(.GET, "schema-builder/tables", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                let pages = try response.content.decode(SchemaPageTablesResponse.self)
                XCTAssertEqual(pages.tables.map(\.name), ["SchemaPageFixture"])
                XCTAssertTrue(pages.availableTables.isEmpty)
            }
            try await app.test(.POST, "schema-builder/tables/UnscopedFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "schema-page-session-\(accountID)"
        let tokenHash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: tokenHash,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
