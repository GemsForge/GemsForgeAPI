import Fluent
import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ForgeKeeperServiceTests: XCTestCase {
    func testForgeKeeperServicePersistsAndListsPages() async throws {
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

            let service = ForgeKeeperService(database: app.db)
            let page = ForgeKeeper(
                domainID: "LIFE",
                title: "Household",
                description: "Household pages."
            )

            try await service.save(page)
            XCTAssertNotNil(page.id)

            let found = try await service.find(id: try XCTUnwrap(page.id))
            XCTAssertEqual(found?.title, "Household")
            XCTAssertEqual(found?.$domain.id, "LIFE")

            let pages = try await service.list()
            XCTAssertEqual(pages.map(\.title), ["Household"])
        }
    }

    func testForgeKeeperServiceDeletesOnlyTheRequestedPage() async throws {
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

            let service = ForgeKeeperService(database: app.db)
            let first = ForgeKeeper(
                domainID: "LIFE",
                title: "First",
                description: "First page."
            )
            let second = ForgeKeeper(
                domainID: "LIFE",
                title: "Second",
                description: "Second page."
            )
            try await service.save(first)
            try await service.save(second)

            try await service.delete(id: try XCTUnwrap(first.id))

            let deletedPage = try await service.find(id: try XCTUnwrap(first.id))
            let remainingPage = try await service.find(id: try XCTUnwrap(second.id))
            XCTAssertNil(deletedPage)
            XCTAssertNotNil(remainingPage)
        }
    }
}
