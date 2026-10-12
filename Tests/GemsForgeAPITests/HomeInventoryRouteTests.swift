import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryRouteTests: XCTestCase {
    func testManualEntryCanBeReadBackByTheTestingConsole() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            try await app.autoMigrate()
            registerHomeInventoryRoutes(app)
        }) { app in
            let input = HomeInventoryRequest(
                id: "INV-0001",
                itemName: "Desk lamp",
                category: "Lighting",
                itemDescription: "Adjustable reading lamp",
                quantity: 1,
                purchaseDate: "2026-10-11",
                purchasePrice: 29.99,
                currentValue: 20.00,
                condition: "Good",
                location: "Office",
                notes: nil
            )

            try await app.test(.POST, "home-inventory", beforeRequest: { request in
                try request.content.encode(input)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(HomeInventory.self)
                XCTAssertEqual(record.id, "INV-0001")
                XCTAssertEqual(record.itemName, "Desk lamp")
            }

            try await app.test(.GET, "home-inventory/INV-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(HomeInventory.self)
                XCTAssertEqual(record.location, "Office")
            }
        }
    }

    func testManualEntryRejectsInvalidIdentifiersAndDuplicateRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            try await app.autoMigrate()
            registerHomeInventoryRoutes(app)
        }) { app in
            let invalid = HomeInventoryRequest(
                id: "HOME-1", itemName: "Chair", category: nil, itemDescription: nil,
                quantity: 1, purchaseDate: nil, purchasePrice: nil, currentValue: nil,
                condition: nil, location: nil, notes: nil
            )
            try await app.test(.POST, "home-inventory", beforeRequest: { request in
                try request.content.encode(invalid)
            }) { response in XCTAssertEqual(response.status, .badRequest) }

            let valid = HomeInventoryRequest(
                id: "INV-0001", itemName: "Chair", category: nil, itemDescription: nil,
                quantity: 1, purchaseDate: nil, purchasePrice: nil, currentValue: nil,
                condition: nil, location: nil, notes: nil
            )
            for expectedStatus in [HTTPResponseStatus.ok, .conflict] {
                try await app.test(.POST, "home-inventory", beforeRequest: { request in
                    try request.content.encode(valid)
                }) { response in
                    XCTAssertEqual(response.status, expectedStatus)
                }
            }
        }
    }
}
