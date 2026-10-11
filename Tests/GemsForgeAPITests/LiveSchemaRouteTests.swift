import Fluent
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LiveSchemaRouteTests: XCTestCase {
    func testLiveSchemaReturnsTablesColumnsRelationshipsAndIndexes() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerLiveSchemaRoutes(app)
        }) { app in
            try await app.test(.GET, "live-database/schema") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let schema = try response.content.decode(LiveSchemaResponse.self)

                XCTAssertEqual(schema.databaseName, "configured Gem Life database")
                XCTAssertEqual(schema.tableCount, 2)
                XCTAssertEqual(schema.tables.map(\.name), ["Domains", "ForgeKeeper"])

                let domains = try XCTUnwrap(schema.tables.first { $0.name == "Domains" })
                XCTAssertTrue(domains.columns.contains { $0.name == "DomainID" && $0.primaryKey })
                XCTAssertTrue(domains.columns.contains { $0.name == "Title" && !$0.nullable })

                let forgeKeeper = try XCTUnwrap(schema.tables.first { $0.name == "ForgeKeeper" })
                XCTAssertTrue(forgeKeeper.foreignKeys.contains {
                    $0.column == "DomainID" && $0.referencedTable == "Domains"
                })
            }
        }
    }
}
