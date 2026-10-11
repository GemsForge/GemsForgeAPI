import Fluent
import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ForgeKeeperRouteTests: XCTestCase {
    func testForgeKeeperRoutesReadPagesAndFilterByDomain() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerForgeKeeperRoutes(app)
        }) { app in
            let life = Domain(
                id: "LIFE",
                title: "Life",
                description: "Everyday responsibilities and operations."
            )
            let knowledge = Domain(
                id: "KNOWLEDGE",
                title: "Knowledge",
                description: "Learning and reference information."
            )
            try await life.create(on: app.db)
            try await knowledge.create(on: app.db)

            let service = ForgeKeeperService(database: app.db)
            let household = ForgeKeeper(
                domainID: "LIFE",
                title: "Household",
                description: "Household pages."
            )
            let reading = ForgeKeeper(
                domainID: "KNOWLEDGE",
                title: "Reading",
                description: "Reading pages."
            )
            try await service.save(household)
            try await service.save(reading)

            try await app.test(.GET, "forgekeeper") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let pages = try response.content.decode([ForgeKeeper].self)
                XCTAssertEqual(pages.map(\.title), ["Household", "Reading"])
            }

            try await app.test(.GET, "forgekeeper/\(try XCTUnwrap(household.id))") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let page = try response.content.decode(ForgeKeeper.self)
                XCTAssertEqual(page.title, "Household")
            }

            try await app.test(.GET, "domains/LIFE/forgekeeper") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let pages = try response.content.decode([ForgeKeeper].self)
                XCTAssertEqual(pages.map(\.title), ["Household"])
            }
        }
    }

    func testForgeKeeperRouteReturnsNotFoundForMissingPage() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerForgeKeeperRoutes(app)
        }) { app in
            try await app.test(.GET, "forgekeeper/999") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
