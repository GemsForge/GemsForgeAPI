import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

/// Verifies the Milestone 2 API workflow against an isolated SQLite database.
/// This intentionally never opens or modifies the user's personal database.
final class MilestoneTwoWorkflowTests: XCTestCase {
    func testSchemaAndImportWorkflowRunsEndToEndAgainstControlledDatabase() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryRoutes(app)
            registerHomeInventoryCSVRoutes(app)
            registerAttachmentReferenceRoutes(app)
        }) { app in
            let manualEntry = HomeInventoryRequest(
                id: "INV-0001", itemName: "Desk lamp", category: "Lighting", itemDescription: nil,
                quantity: 1, purchaseDate: "2026-10-11", purchasePrice: 29.99,
                currentValue: 20, condition: "Good", location: "Office", notes: nil
            )
            try await app.test(.POST, "home-inventory", beforeRequest: { request in
                try request.content.encode(manualEntry)
            }) { response in XCTAssertEqual(response.status, .ok) }

            let csv = "InventoryID,ItemName,Category,Description,Quantity\nINV-0002,Chair,Furniture,Desk chair,1"
            try await app.test(.POST, "home-inventory/import/preview", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVPreviewRequest(csv: csv))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertTrue(try response.content.decode(HomeInventoryCSVPreviewResponse.self).readyToImport)
            }

            try await app.test(.POST, "home-inventory/import", beforeRequest: { request in
                try request.content.encode(HomeInventoryCSVImportRequest(csv: csv, confirmImport: true))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(HomeInventoryCSVImportResponse.self).importedCount, 1)
            }

            let metadata = FileMetadata(
                id: "FILE-0001", relativePath: "images/lamp.png", fileName: "lamp.png",
                fileKind: "image", mimeType: "image/png", byteSize: 12,
                checksum: "checksum", ownerType: nil, ownerID: nil
            )
            try await metadata.create(on: app.db)
            try await app.test(.PATCH, "home-inventory/INV-0001/attachment", beforeRequest: { request in
                try request.content.encode(AttachmentReferenceRequest(fileMetadataID: "FILE-0001"))
            }) { response in XCTAssertEqual(response.status, .ok) }

            try await app.test(.GET, "home-inventory") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let records = try response.content.decode([HomeInventory].self)
                XCTAssertEqual(records.count, 2)
                XCTAssertEqual(records.first { $0.id == "INV-0001" }?.imageFileMetadataID, "FILE-0001")
            }
        }
    }
}
