import Fluent
import FluentSQLiteDriver
import SQLKit
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class NotionImportReferenceMigrationTests: XCTestCase {
    func testReferenceTableEnforcesOneRecordPerNotionPageAndHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateNotionImportReferences())
            try await app.autoMigrate()
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            try await NotionImportReference(
                hubID: "hub-a", notionPageID: "notion-a", tableName: "Services", recordID: "service-1"
            ).save(on: app.db)

            do {
                try await NotionImportReference(
                    hubID: "hub-a", notionPageID: "notion-a", tableName: "Services", recordID: "service-2"
                ).save(on: app.db)
                XCTFail("A Notion page must not produce a duplicate record in the same Hub.")
            } catch {
                XCTAssertTrue(String(describing: error).localizedCaseInsensitiveContains("constraint"))
            }

            let count = try await NotionImportReference.query(on: app.db)
                .filter(\.$hubID == "hub-a")
                .count()
            XCTAssertEqual(count, 1)

            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            let schema = try await LiveSchemaService(database: app.db).inspect()
            let table = try XCTUnwrap(schema.tables.first { $0.name == NotionImportReference.schema })
            XCTAssertEqual(
                table.indexes.first { $0.name == "uq_NotionImportReferences_Hub_Page" }?.columns,
                ["HubID", "NotionPageID"]
            )
            try await CreateNotionImportReferences().revert(on: app.db)
            let remaining = try await sql.raw(SQLQueryString(stringLiteral: """
                SELECT COUNT(*) AS count FROM sqlite_master
                WHERE type = 'table' AND name = 'NotionImportReferences'
                """)).first()
            XCTAssertEqual(try remaining?.decode(column: "count", as: Int.self), 0)
        }
    }
}
