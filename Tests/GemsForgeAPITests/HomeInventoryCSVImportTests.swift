import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryCSVImportTests: XCTestCase {
    private let validCSV = "InventoryID,ItemName,Category,Description,Quantity,PurchaseDate,PurchasePrice,CurrentValue,Condition,Location,Notes\nINV-0001,Desk lamp,Lighting,Reading lamp,1,2026-10-11,29.99,20.00,Good,Office,\nINV-0002,Chair,Furniture,,2,,,,Fair,Dining room,"

    func testConfirmedCSVImportCreatesTheWholeBatch() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryCSVRoutes(app)
        }) { app in
            try await app.test(.POST, "home-inventory/import", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVImportRequest(csv: validCSV, confirmImport: true))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(HomeInventoryCSVImportResponse.self)
                XCTAssertEqual(result.importedCount, 2)
                XCTAssertEqual(result.status, "imported")
            }

            let records = try await HomeInventory.query(on: app.db).all()
            XCTAssertEqual(records.map { $0.id }.compactMap { $0 }.sorted(), ["INV-0001", "INV-0002"])
        }
    }

    func testInvalidBatchIsRejectedWithoutPartialWrites() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryCSVRoutes(app)
        }) { app in
            let invalidCSV = validCSV + "\nBAD-1,Invalid row,, ,0,,,,,,"
            try await app.test(.POST, "home-inventory/import", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVImportRequest(csv: invalidCSV, confirmImport: true))
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            let records = try await HomeInventory.query(on: app.db).all()
            XCTAssertTrue(records.isEmpty)
        }
    }

    func testImportRequiresExplicitConfirmation() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryCSVRoutes(app)
        }) { app in
            try await app.test(.POST, "home-inventory/import", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVImportRequest(csv: validCSV, confirmImport: false))
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
        }
    }
}
