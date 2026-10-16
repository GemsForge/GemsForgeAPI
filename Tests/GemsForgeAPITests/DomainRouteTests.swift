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
            let payload = DomainCreateRequest(
                id: "LIFE",
                title: "Life",
                description: "Everyday responsibilities and resources.",
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
            )

            try await app.test(.PUT, "domains/LIFE", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domain = try response.content.decode(Domain.self)
                XCTAssertEqual(domain.title, "Life & Wellness")
            }

            try await app.test(.PATCH, "domains/LIFE", beforeRequest: { request in
                try request.content.encode(["title": "Patched Life"])
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let domain = try response.content.decode(Domain.self)
                XCTAssertEqual(domain.title, "Patched Life")
                XCTAssertEqual(domain.description, "Updated domain description.")
            }

            try await app.test(.PATCH, "domains/LIFE", beforeRequest: { request in
                try request.content.encode(["id": "OTHER"])
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.DELETE, "domains/LIFE") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "domains/LIFE") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testDomainRejectsInvalidPayloadAndDuplicateID() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerDomainRoutes(app)
        }) { app in
            let invalidPayload = DomainCreateRequest(
                id: "LIFE",
                title: "",
                description: "",
            )

            try await app.test(.POST, "domains", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .badRequest)
            }

            let validPayload = DomainCreateRequest(
                id: "LIFE",
                title: "Life",
                description: "Everyday responsibilities."
            )

            try await app.test(.POST, "domains", beforeRequest: { request in
                try request.content.encode(validPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
            }

            let duplicateTitle = DomainCreateRequest(
                id: "LIFE-2",
                title: "life",
                description: "Duplicate natural key."
            )
            try await app.test(.POST, "domains", beforeRequest: { request in
                try request.content.encode(duplicateTitle)
            }) { response async throws in
                XCTAssertEqual(response.status, .conflict)
                let domains = try await DomainService(database: app.db).list()
                XCTAssertEqual(domains.count, 1)
            }

            try await app.test(.POST, "domains", beforeRequest: { request in
                try request.content.encode(validPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .conflict)
            }
        }
    }

    func testDomainMissingRecordsReturnNotFound() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateForgeKeeper())
            try await app.autoMigrate()
            registerDomainRoutes(app)
        }) { app in
            try await app.test(.GET, "domains/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            let payload = DomainRequest(
                id: "MISSING",
                title: "Missing",
                description: "This record does not exist yet."
            )

            try await app.test(.PUT, "domains/MISSING", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "domains/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
