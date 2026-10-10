import Fluent
import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class DomainRouteTests: XCTestCase {
    func testDomainCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerDomainRoutes(app)
        }) { app in
            let payload = DomainRequest(
                id: "LIFE",
                title: "Life",
                description: "Everyday responsibilities and resources.",
                notes: "Initial domain"
            )

            try await app.test(.POST, "domains", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domain = try response.content.decode(Domain.self)
                XCTAssertEqual(domain.id, "LIFE")
                XCTAssertEqual(domain.title, "Life")
            }

            try await app.test(.GET, "domains") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domains = try response.content.decode([Domain].self)
                XCTAssertEqual(domains.count, 1)
            }

            try await app.test(.GET, "domains/LIFE") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domain = try response.content.decode(Domain.self)
                XCTAssertEqual(domain.description, "Everyday responsibilities and resources.")
            }

            let updatedPayload = DomainRequest(
                id: "LIFE",
                title: "Life & Wellness",
                description: "Updated domain description.",
                notes: nil
            )

            try await app.test(.PUT, "domains/LIFE", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domain = try response.content.decode(Domain.self)
                XCTAssertEqual(domain.title, "Life & Wellness")
            }

            try await app.test(.DELETE, "domains/LIFE") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "domains/LIFE") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
