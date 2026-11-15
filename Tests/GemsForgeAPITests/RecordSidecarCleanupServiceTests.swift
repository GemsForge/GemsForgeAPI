import Crypto
import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class RecordSidecarCleanupServiceTests: XCTestCase {
    func testCleanupDeletesOnlyRequestedHubAndTableSidecars() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateRecordPresentations())
            app.migrations.add(CreateRecordBodies())
            try await app.autoMigrate()
        }) { app in
            _ = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            _ = try await self.seedSession(on: app.db, accountID: "account-b", hubID: "hub-b")

            let bodies = [
                RecordBody(hubID: "hub-a", tableName: "Addresses", recordID: "A1", markdown: "remove"),
                RecordBody(hubID: "hub-a", tableName: "Addresses", recordID: "A2", markdown: "remove"),
                RecordBody(hubID: "hub-b", tableName: "Addresses", recordID: "B1", markdown: "keep hub"),
                RecordBody(hubID: "hub-a", tableName: "Services", recordID: "S1", markdown: "keep table"),
            ]
            for body in bodies { try await body.save(on: app.db) }
            let presentations = [
                RecordPresentation(hubID: "hub-a", tableName: "Addresses", recordID: "A1", presentation: "{}"),
                RecordPresentation(hubID: "hub-b", tableName: "Addresses", recordID: "B1", presentation: "{}"),
                RecordPresentation(hubID: "hub-a", tableName: "Services", recordID: "S1", presentation: "{}"),
            ]
            for presentation in presentations { try await presentation.save(on: app.db) }

            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await app.db.schema("TableColumnDefinitions")
                .field("DefinitionID", .string, .identifier(auto: false))
                .field("HubID", .string, .required)
                .field("TableName", .string, .required)
                .field("ColumnName", .string, .required)
                .create()
            try await sql.raw(SQLQueryString(stringLiteral: """
                INSERT INTO "TableColumnDefinitions" ("DefinitionID", "HubID", "TableName", "ColumnName") VALUES
                ('D1', 'hub-a', 'Addresses', 'City'),
                ('D2', 'hub-b', 'Addresses', 'City'),
                ('D3', 'hub-a', 'Services', 'Service')
                """)).run()

            try await RecordSidecarCleanupService.deleteTableSidecars(
                tableName: "Addresses",
                hubID: "hub-a",
                on: app.db
            )

            let remainingBodies = try await RecordBody.query(on: app.db).all()
            XCTAssertEqual(Set(remainingBodies.compactMap(\.id)), Set([bodies[2].id, bodies[3].id]))
            let remainingPresentations = try await RecordPresentation.query(on: app.db).all()
            XCTAssertEqual(Set(remainingPresentations.compactMap(\.id)), Set([presentations[1].id, presentations[2].id]))
            let remainingDefinitions = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT "DefinitionID" FROM "TableColumnDefinitions" ORDER BY "DefinitionID"
                """)).all().map { try $0.decode(column: "DefinitionID", as: String.self) }
            XCTAssertEqual(remainingDefinitions, ["D2", "D3"])
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "sidecar-cleanup-\(accountID)"
        let digest = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: digest,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
