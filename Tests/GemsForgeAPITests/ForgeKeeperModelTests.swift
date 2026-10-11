import Fluent
import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ForgeKeeperModelTests: XCTestCase {
    func testForgeKeeperMapsDomainAndParentRelationships() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
        }) { app in
            let domain = Domain(
                id: "LIFE",
                title: "Life",
                description: "Everyday responsibilities and operations."
            )
            try await domain.create(on: app.db)

            let rootPage = ForgeKeeper(
                domainID: "LIFE",
                title: "Household",
                description: "Household pages."
            )
            try await rootPage.create(on: app.db)

            let childPage = ForgeKeeper(
                parentID: rootPage.id,
                domainID: "LIFE",
                title: "Utilities",
                description: "Utility information."
            )
            try await childPage.create(on: app.db)

            let savedChild = try await ForgeKeeper.find(childPage.id, on: app.db)
            XCTAssertEqual(savedChild?.id, childPage.id)
            XCTAssertEqual(savedChild?.$parent.id, rootPage.id)
            XCTAssertEqual(savedChild?.$domain.id, "LIFE")
            XCTAssertEqual(savedChild?.title, "Utilities")
            XCTAssertNotNil(savedChild?.createdAt)
            XCTAssertNotNil(savedChild?.updatedAt)
        }
    }
}
