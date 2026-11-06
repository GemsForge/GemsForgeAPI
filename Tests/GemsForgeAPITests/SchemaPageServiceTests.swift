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
        try await database.schema("IntegerSchemaPageFixture")
            .field("ID", .int, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .create()
        try await database.schema("Education")
            .field("EducationID", .string, .identifier(auto: false))
            .field("HubID", .string)
            .field("InstitutionName", .string, .required)
            .create()
        try await database.schema("Transactions")
            .field("TransactionID", .string, .identifier(auto: false))
            .field("HubID", .string)
            .field("Item", .string, .required)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("UnscopedFixture").delete()
        try await database.schema("Transactions").delete()
        try await database.schema("Education").delete()
        try await database.schema("IntegerSchemaPageFixture").delete()
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
            try await sql.raw("INSERT INTO Education (EducationID, HubID, InstitutionName) VALUES ('edu-a', 'hub-a', 'Community College'), ('edu-b', 'hub-b', 'Other Hub School')").run()
        }) { app in
            let service = SchemaPageService(database: app.db, hubID: "hub-a")
            let initialTables = try await service.listTables()
            XCTAssertEqual(initialTables.tables.map(\.name), ["Education"])
            XCTAssertEqual(initialTables.availableTables.map(\.name), ["IntegerSchemaPageFixture", "SchemaPageFixture"])
            XCTAssertFalse(initialTables.tables.contains(where: { $0.name == "Transactions" }))
            XCTAssertFalse(initialTables.availableTables.contains(where: { $0.name == "Transactions" }))
            do {
                _ = try await service.createPage(tableName: "Transactions")
                XCTFail("The existing Expense Tracker collection must not get a duplicate schema page.")
            } catch let error as SchemaPageError {
                XCTAssertEqual(error, .tableUnavailable)
            }
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            let tables = try await service.listTables()
            XCTAssertEqual(tables.tables.map(\.name), ["Education", "SchemaPageFixture"])
            XCTAssertEqual(tables.availableTables.map(\.name), ["IntegerSchemaPageFixture"])
            let otherHubTables = try await SchemaPageService(database: app.db, hubID: "hub-b").listTables()
            XCTAssertEqual(otherHubTables.tables.map(\.name), ["Education"])
            XCTAssertFalse(otherHubTables.availableTables.contains(where: { $0.name == "Education" }))
            let registeredViews = try await TableView.query(on: app.db).filter(\.$hubID == "hub-a").count()
            XCTAssertEqual(registeredViews, 2)

            let firstPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 0)
            XCTAssertEqual(firstPage.totalCount, 2)
            XCTAssertEqual(firstPage.rows.count, 1)
            XCTAssertEqual(firstPage.rows[0]["Name"]!, "Desk")

            let secondPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 1)
            XCTAssertEqual(secondPage.rows[0]["Name"]!, "Chair")

            let educationPage = try await service.records(tableName: "Education", limit: 10, offset: 0)
            XCTAssertEqual(educationPage.totalCount, 1)
            XCTAssertEqual(educationPage.rows[0]["InstitutionName"]!, "Community College")

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
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records") { response in
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
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerSchemaPageRoutes(app)
            registerTableViewRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO SchemaPageFixture (ID, HubID, Name, Quantity) VALUES ('fixture-a', 'hub-a', 'Saved goal', 1), ('fixture-b', 'hub-b', 'Other Hub goal', 2)").run()
            try await sql.raw("INSERT INTO IntegerSchemaPageFixture (ID, HubID, Name) VALUES (12, 'hub-a', 'Integer keyed record'), (13, 'hub-b', 'Other Hub record')").run()

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
                XCTAssertEqual(pages.tables.map(\.name), ["Education", "SchemaPageFixture"])
                XCTAssertEqual(pages.availableTables.map(\.name), ["IntegerSchemaPageFixture"])
            }
            try await app.test(.GET, "schema-builder/tables/IntegerSchemaPageFixture/records/12", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(SchemaPageRecordResponse.self)
                XCTAssertEqual(result.row["Name"]!, "Integer keyed record")
            }
            try await app.test(.GET, "schema-builder/tables/IntegerSchemaPageFixture/records/13", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            let workspaceState = #"{"activeViewId":"gallery","selectedRecordId":"fixture-a","search":"goal"}"#
            try await app.test(.PUT, "table-views/SchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(
                    workspaceState: #"{"activeViewId":"gallery","selectedRecordId":"fixture-b"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            try await app.test(.PUT, "table-views/SchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(workspaceState: workspaceState))
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.GET, "table-views/SchemaPageFixture/Gallery", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let saved = try response.content.decode(SavedTableViewResponse.self)
                XCTAssertEqual(saved.view.workspaceState, workspaceState)
            }

            var createdID = ""
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"New goal","Quantity":4}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                createdID = try response.content.decode(SchemaPageRecordCreationResponse.self).recordID
                XCTAssertFalse(createdID.isEmpty)
            }
            let visibleToCreator = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .containsRecord(createdID, in: "SchemaPageFixture")
            let visibleToOtherHub = try await SchemaPageService(database: app.db, hubID: "hub-b")
                .containsRecord(createdID, in: "SchemaPageFixture")
            XCTAssertTrue(visibleToCreator)
            XCTAssertFalse(visibleToOtherHub)

            var generatedEducationID = ""
            try await app.test(.POST, "schema-builder/tables/Education/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"InstitutionName":"New campus"}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                generatedEducationID = try response.content.decode(SchemaPageRecordCreationResponse.self).recordID
            }
            let educationRecordIsHubScoped = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .containsRecord(generatedEducationID, in: "Education")
            XCTAssertTrue(educationRecordIsHubScoped)

            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"ID":4242,"Name":"Client supplied key"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Generated integer key"}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let created = try response.content.decode(SchemaPageRecordCreationResponse.self)
                XCTAssertEqual(created.table, "IntegerSchemaPageFixture")
                guard let integerID = Int64(created.recordID), let sql = app.db as? SQLDatabase,
                      let row = try await sql.raw(SQLQueryString(
                          "SELECT \(ident: "Name") FROM \(ident: "IntegerSchemaPageFixture") WHERE \(ident: "ID") = \(bind: integerID) AND \(ident: "HubID") = \(bind: "hub-a")"
                      )).first()
                else { return XCTFail("The response ID must identify the row created for this Hub.") }
                XCTAssertEqual(try row.decode(column: "Name", as: String.self), "Generated integer key")
            }

            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Attempted ownership","Quantity":1,"HubID":"hub-b"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Missing quantity"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.PUT, "table-views/IntegerSchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(
                    workspaceState: #"{"activeViewId":"gallery","selectedRecordId":"12"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.POST, "schema-builder/tables/UnscopedFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/Transactions/page", beforeRequest: {
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
