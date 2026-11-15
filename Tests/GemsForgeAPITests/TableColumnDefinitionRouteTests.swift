import Crypto
import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class TableColumnDefinitionRouteTests: XCTestCase {
    func testDefinitionsValidateOptionsAndTextColumnsAndScopeByHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateTableColumnDefinitions())
            app.migrations.add(CreateTablePropertyDefinitions())
            try await app.autoMigrate()
            try await app.db.schema("TagRecords")
                .field("ID", .string, .identifier(auto: false))
                .field("HubID", .string, .required)
                .field("Tags", .string)
                .field("Choice", .string)
                .field("LegacyTags", .string)
                .field("Number", .int)
                .create()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerTableColumnDefinitionRoutes(app)
            registerSchemaPageRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            let tokenB = try await self.seedSession(on: app.db, accountID: "account-b", hubID: "hub-b")
            try await TableView(
                hubID: "hub-a", tableName: "TagRecords", name: "Legacy", viewType: .table,
                workspaceState: #"{"propertyTypes":{"Choice":"Select","LegacyTags":"Multi-select","Conflict":"Select"},"propertySelectOptions":{"Choice":["One","Two"],"LegacyTags":["Rare" ]}}"#
            ).save(on: app.db)
            try await TableView(
                hubID: "hub-a", tableName: "TagRecords", name: "Legacy conflict", viewType: .gallery,
                workspaceState: #"{"propertyTypes":{"Conflict":"Status"},"propertySelectOptions":{}}"#
            ).save(on: app.db)
            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await sql.raw("INSERT INTO TagRecords (ID, HubID, Tags, Choice, LegacyTags, Number) VALUES ('r1', 'hub-a', 'Home;Homework', NULL, 'Rare;StoredTag', 1)").run()

            try await app.test(.GET, "table-column-definitions/TagRecords") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await put("TagRecords/Tags", type: "MultiSelect", options: ["Home", "Credit"], token: tokenA, on: app, expected: .ok)
            try await app.test(.GET, "table-column-definitions/TagRecords", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                let items = try response.content.decode([TableColumnDefinitionResponse].self)
                XCTAssertEqual(items.map(\.columnName), ["Tags"])
                XCTAssertEqual(items.first?.options.map(\.value), ["Home", "Credit"])
            }
            try await app.test(.GET, "table-column-definitions/TagRecords", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenB)
            }) { response async throws in
                XCTAssertTrue(try response.content.decode([TableColumnDefinitionResponse].self).isEmpty)
            }

            for invalidOptions in [["bad;tag"], ["Home", "home"]] {
                try await put("TagRecords/Tags", type: "MultiSelect", options: invalidOptions, token: tokenA, on: app, expected: .badRequest)
            }
            try await put("TagRecords/Number", type: "Select", options: ["one"], token: tokenA, on: app, expected: .badRequest)
            try await put("TagRecords/DoesNotExist", type: "Select", options: [], token: tokenA, on: app, expected: .badRequest)
            try await app.test(.PUT, "table-column-definitions/TagRecords/Choice", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"propertyType":"Select","options":[{"value":"One","color":"fuchsia"}]}"#)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let patchUnknown = #"{"Tags":["Home","Other"]}"#
            try await app.test(.PATCH, "schema-builder/tables/TagRecords/records/r1", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: patchUnknown)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
            let patchCreate = #"{"Tags":["Credit","Home","Credit"],"createMissingOptions":true}"#
            try await app.test(.PATCH, "schema-builder/tables/TagRecords/records/r1", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: patchCreate)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let stored = try await sql.raw("SELECT Tags FROM TagRecords WHERE ID = 'r1'").first()
            XCTAssertEqual(try stored?.decode(column: "Tags", as: String.self), "Home;Credit")
            let generated = try await TableColumnDefinitionService(database: app.db, hubID: "hub-a")
                .definition(tableName: "TagRecords", columnName: "Tags")
            XCTAssertEqual(try generated?.options().map(\.value), ["Home", "Credit"])

            try await app.test(.GET, "table-column-definitions/TagRecords/backfill/preview", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                let result = try response.content.decode(TableColumnDefinitionBackfillResponse.self)
                XCTAssertEqual(result.items.first(where: { $0.columnName == "Choice" })?.status, "pending")
                XCTAssertEqual(result.items.first(where: { $0.columnName == "LegacyTags" })?.options.map(\.value), ["Rare", "StoredTag"])
                XCTAssertTrue(result.conflicts.contains(where: { $0.contains("Conflict") }))
                XCTAssertFalse(result.items.contains(where: { $0.columnName == "Conflict" }))
            }
            for _ in 0..<2 {
                try await app.test(.POST, "table-column-definitions/TagRecords/backfill/apply", beforeRequest: {
                    $0.headers.bearerAuthorization = .init(token: tokenA)
                }) { response async throws in
                    let result = try response.content.decode(TableColumnDefinitionBackfillResponse.self)
                    XCTAssertEqual(result.items.first(where: { $0.columnName == "Choice" })?.status, "preserved")
                }
            }

            let renamePayload = #"{"propertyType":"MultiSelect","options":[{"value":"House"},{"value":"Homework"}],"renames":[{"from":"Home","to":"House"}]}"#
            try await app.test(.PUT, "table-column-definitions/TagRecords/Tags", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: renamePayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(TableColumnDefinitionWriteResponse.self).rowsChanged, 1)
            }
            let renamed = try await sql.raw("SELECT Tags FROM TagRecords WHERE ID = 'r1'").first()
            XCTAssertEqual(try renamed?.decode(column: "Tags", as: String.self), "House;Credit")

            try await app.test(.DELETE, "table-column-definitions/TagRecords/Tags", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let preserved = try await sql.raw("SELECT Tags FROM TagRecords WHERE ID = 'r1'").first()
            XCTAssertEqual(try preserved?.decode(column: "Tags", as: String.self), "House;Credit")
        }
    }

    private func put(
        _ path: String,
        type: String,
        options: [String],
        token: String,
        on app: Application,
        expected: HTTPResponseStatus
    ) async throws {
        try await app.test(.PUT, "table-column-definitions/\(path)", beforeRequest: { request in
            request.headers.bearerAuthorization = .init(token: token)
            request.headers.contentType = .json
            let optionValues = options.map { ["value": $0] }
            let data = try JSONSerialization.data(withJSONObject: ["propertyType": type, "options": optionValues])
            request.body = ByteBuffer(data: data)
        }) { response in
            XCTAssertEqual(response.status, expected)
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "table-column-session-\(accountID)"
        let digest = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(accountID: accountID, tokenHash: digest, expiresAt: Date().addingTimeInterval(3_600)).save(on: database)
        return token
    }
}
