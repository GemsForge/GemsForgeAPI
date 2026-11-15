import Crypto
import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class RecordBodyRouteTests: XCTestCase {
    func testRecordBodyRoutesValidateHubScopeSaveWithRevisionsAndListExcerpts() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateAddresses())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateRecordBodies())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerRecordBodyRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            let tokenB = try await self.seedSession(on: app.db, accountID: "account-b", hubID: "hub-b")
            try await AddressService(database: app.db, hubID: "hub-a").save(
                Address(id: "ADDR-A", city: "Boston", addressStatus: "Current")
            )
            try await AddressService(database: app.db, hubID: "hub-b").save(
                Address(id: "ADDR-B", city: "Salem", addressStatus: "Current")
            )

            try await app.test(.GET, "record-bodies/Addresses/ADDR-A", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let body = try response.content.decode(RecordBodyResponse.self)
                XCTAssertEqual(body.recordID, "ADDR-A")
                XCTAssertEqual(body.markdown, "")
                XCTAssertEqual(body.revision, 0)
                XCTAssertNil(body.updatedAt)
            }

            for (token, path) in [
                (tokenA, "record-bodies/Addresses/MISSING"),
                (tokenA, "record-bodies/Addresses/ADDR-B"),
                (tokenB, "record-bodies/Addresses/ADDR-A"),
            ] {
                try await app.test(.GET, path, beforeRequest: {
                    $0.headers.bearerAuthorization = .init(token: token)
                }) { response async throws in
                    XCTAssertEqual(response.status, .notFound)
                }
            }

            let markdown = "# Heading\r\n\r\n**Bold** and [link](https://example.com)\r- [ ] todo"
            try await app.test(.PUT, "record-bodies/Addresses/ADDR-A", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(RecordBodyRequest(markdown: markdown, baseRevision: 0))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let body = try response.content.decode(RecordBodyResponse.self)
                XCTAssertEqual(body.markdown, "# Heading\n\n**Bold** and [link](https://example.com)\n- [ ] todo")
                XCTAssertEqual(body.revision, 1)
                XCTAssertNotNil(body.updatedAt)
            }

            try await app.test(.PUT, "record-bodies/Addresses/ADDR-A", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(RecordBodyRequest(markdown: "stale", baseRevision: 0))
            }) { response async throws in
                XCTAssertEqual(response.status, .conflict)
                let current = try response.content.decode(RecordBodyResponse.self)
                XCTAssertEqual(current.markdown, "# Heading\n\n**Bold** and [link](https://example.com)\n- [ ] todo")
                XCTAssertEqual(current.revision, 1)
            }

            for (token, recordID) in [(tokenA, "MISSING"), (tokenA, "ADDR-B")] {
                try await app.test(.PUT, "record-bodies/Addresses/\(recordID)", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: token)
                    try request.content.encode(RecordBodyRequest(markdown: "not saved", baseRevision: 0))
                }) { response async throws in
                    XCTAssertEqual(response.status, .notFound)
                }
            }

            let oversized = String(repeating: "x", count: 1_000_001)
            try await app.test(.PUT, "record-bodies/Addresses/ADDR-A", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(RecordBodyRequest(markdown: oversized, baseRevision: 1))
            }) { response async throws in
                XCTAssertEqual(response.status, .payloadTooLarge)
            }

            try await RecordBody(
                hubID: "hub-a",
                tableName: "Addresses",
                recordID: "ADDR-EXCERPT",
                markdown: "# Heading\n**Bold** and [link](https://example.com)\n- [ ] todo " + String(repeating: "x", count: 210)
            ).save(on: app.db)
            try await RecordBody(
                hubID: "hub-b",
                tableName: "Addresses",
                recordID: "ADDR-B",
                markdown: "foreign excerpt"
            ).save(on: app.db)
            try await RecordBody(
                hubID: "hub-a",
                tableName: "Addresses",
                recordID: "STALE-RECORD",
                markdown: "stale page"
            ).save(on: app.db)

            try await app.test(.GET, "record-bodies/Addresses", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let excerpts = try response.content.decode([RecordBodyExcerptResponse].self)
                XCTAssertEqual(Set(excerpts.map(\.recordID)), Set(["ADDR-A", "ADDR-EXCERPT"]))
                let excerpt = try XCTUnwrap(excerpts.first { $0.recordID == "ADDR-EXCERPT" })
                XCTAssertEqual(excerpt.excerpt.prefix(200).count, 200)
                XCTAssertTrue(excerpt.excerpt.hasPrefix("Heading Bold and link todo"))
            }
        }
    }

    func testRecordBodiesSupportForgeKeeperServiceAccountsAndUserTables() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            app.migrations.add(CreateServiceAccounts())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateRecordBodies())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerRecordBodyRoutes(app)
        }) { app in
            let token = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await sql.raw(SQLQueryString(stringLiteral: """
                INSERT INTO "Domains" ("DomainID", "Title", "DateCreated", "DateUpdated")
                VALUES ('LIFE', 'Life', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)).run()
            try await sql.raw(SQLQueryString(stringLiteral: """
                INSERT INTO "ForgeKeeper" ("HubID", "DomainID", "Title", "DateCreated", "DateUpdated")
                VALUES ('hub-a', 'LIFE', 'Journal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)).run()
            let pageIDRow = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT "ForgeKeeperID" FROM "ForgeKeeper" WHERE "Title" = 'Journal'
                """)).first()
            let pageID = try XCTUnwrap(try pageIDRow?.decode(column: "ForgeKeeperID", as: Int.self))

            let account = ServiceAccount(service: "Internet")
            try await ServiceAccountService(database: app.db, hubID: "hub-a").save(account)
            let serviceID = try XCTUnwrap(account.id)

            try await app.db.schema("PlannerWeeks")
                .field("ID", .string, .identifier(auto: false))
                .field("HubID", .string, .required)
                .field("Title", .string, .required)
                .create()
            try await sql.raw(SQLQueryString(stringLiteral: """
                INSERT INTO "PlannerWeeks" ("ID", "HubID", "Title")
                VALUES ('WEEK-2026-01', 'hub-a', 'Week 1')
                """)).run()
            try await TableView(hubID: "hub-a", tableName: "PlannerWeeks", name: "Table", viewType: .table)
                .save(on: app.db)

            let recordKeys = [
                ("ForgeKeeper", String(pageID)),
                ("Services", String(serviceID)),
                ("PlannerWeeks", "WEEK-2026-01"),
            ]
            for (tableName, recordID) in recordKeys {
                try await app.test(.PUT, "record-bodies/\(tableName)/\(recordID)", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: token)
                    try request.content.encode(RecordBodyRequest(markdown: "body for \(tableName)", baseRevision: 0))
                }) { response async throws in
                    XCTAssertEqual(response.status, .ok)
                    let body = try response.content.decode(RecordBodyResponse.self)
                    XCTAssertEqual(body.markdown, "body for \(tableName)")
                    XCTAssertEqual(body.revision, 1)
                }
            }
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "record-body-session-\(accountID)"
        let digest = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: digest,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
