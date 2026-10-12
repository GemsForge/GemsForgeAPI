import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryAttachmentRouteTests: XCTestCase {
    func testHomeInventoryImageCanBeAttachedReplacedAndRemoved() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            try await app.autoMigrate()
            registerHomeInventoryRoutes(app)
            registerAttachmentReferenceRoutes(app)
        }) { app in
            let inventory = HomeInventory(id: "INV-0001", itemName: "Desk lamp")
            try await inventory.create(on: app.db)

            let first = FileMetadata(
                id: "FILE-0001", relativePath: "images/lamp-a.png", fileName: "lamp-a.png",
                fileKind: "image", mimeType: "image/png", byteSize: 10,
                checksum: "first", ownerType: nil, ownerID: nil
            )
            let second = FileMetadata(
                id: "FILE-0002", relativePath: "images/lamp-b.png", fileName: "lamp-b.png",
                fileKind: "image", mimeType: "image/png", byteSize: 12,
                checksum: "second", ownerType: nil, ownerID: nil
            )
            try await first.create(on: app.db)
            try await second.create(on: app.db)

            for request in [
                AttachmentReferenceRequest(fileMetadataID: "FILE-0001"),
                AttachmentReferenceRequest(fileMetadataID: "FILE-0002"),
                AttachmentReferenceRequest(fileMetadataID: nil)
            ] {
                try await app.test(.PATCH, "home-inventory/INV-0001/attachment", beforeRequest: { httpRequest in
                    try httpRequest.content.encode(request)
                }) { response in
                    XCTAssertEqual(response.status, .ok)
                }
            }

            let firstOwner = try await FileMetadata.find("FILE-0001", on: app.db)?.ownerID
            let secondOwner = try await FileMetadata.find("FILE-0002", on: app.db)?.ownerID
            let inventoryImage = try await HomeInventory.find("INV-0001", on: app.db)?.imageFileMetadataID
            XCTAssertNil(firstOwner)
            XCTAssertNil(secondOwner)
            XCTAssertNil(inventoryImage)
        }
    }
}
