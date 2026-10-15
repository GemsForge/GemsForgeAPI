import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryCSVPreviewTests: XCTestCase {
    func testCSVPreviewConvertsValidRowsWithoutWriting() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryCSVRoutes(app)
        }) { app in
            let csv = "ItemName,Category,Description,Quantity,PurchaseDate,PurchasePrice,CurrentValue,Condition,Location,Notes\nDesk lamp,Lighting,Reading lamp,1,2026-10-11,29.99,20.00,Good,Office,"
            try await app.test(.POST, "home-inventory/import/preview", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVPreviewRequest(csv: csv))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(HomeInventoryCSVPreviewResponse.self)
                XCTAssertTrue(preview.readyToImport)
                XCTAssertEqual(preview.validRows.count, 1)
                XCTAssertTrue(preview.invalidRows.isEmpty)
                XCTAssertTrue(HomeInventoryIdentifier.isValid(try XCTUnwrap(preview.validRows[0].values["InventoryID"])))
            }

            let storedRows = try await HomeInventory.query(on: app.db).all()
            XCTAssertTrue(storedRows.isEmpty)
        }
    }

    func testCSVPreviewReportsDuplicateAndInvalidRows() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryCSVRoutes(app)
        }) { app in
            let csv = "InventoryID,ItemName,Quantity\n550E8400-E29B-41D4-A716-446655440000,Chair,1\n550E8400-E29B-41D4-A716-446655440000,Duplicate chair,1\nnot-a-uuid,Missing valid ID,0"
            try await app.test(.POST, "home-inventory/import/preview", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVPreviewRequest(csv: csv))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(HomeInventoryCSVPreviewResponse.self)
                XCTAssertFalse(preview.readyToImport)
                XCTAssertEqual(preview.validRows.count, 1)
                XCTAssertEqual(preview.invalidRows.count, 2)
                XCTAssertTrue(preview.invalidRows[0].errors.contains { $0.contains("duplicated") })
            }
        }
    }
}
