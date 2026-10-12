import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class AttachmentReferenceRouteTests: XCTestCase {
    func testAddressAttachmentCanAttachReplaceAndRemove() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerAddressRoutes(app)
            registerAttachmentReferenceRoutes(app)

            try await Address(id: "ADDR-0001", addressStatus: "Current").save(on: app.db)
            try await FileMetadata(id: "FILE-1", relativePath: "uploads/one.png", fileKind: "image", mimeType: "image/png").save(on: app.db)
            try await FileMetadata(id: "FILE-2", relativePath: "uploads/two.png", fileKind: "image", mimeType: "image/png").save(on: app.db)
        }) { app in
            func payload(_ id: String?) -> AttachmentReferenceRequest { .init(fileMetadataID: id) }

            try await app.test(.PATCH, "addresses/ADDR-0001/attachment", beforeRequest: { request in
                try request.content.encode(payload("FILE-1"))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(AddressDetailResponse.self).imageFileMetadataID, "FILE-1")
            }

            try await app.test(.PATCH, "addresses/ADDR-0001/attachment", beforeRequest: { request in
                try request.content.encode(payload("FILE-2"))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(AddressDetailResponse.self).imageFileMetadataID, "FILE-2")
            }

            let old = try await FileMetadata.find("FILE-1", on: app.db)
            XCTAssertNil(old?.ownerID)

            try await app.test(.PATCH, "addresses/ADDR-0001/attachment", beforeRequest: { request in
                try request.content.encode(payload(nil))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertNil(try response.content.decode(AddressDetailResponse.self).imageFileMetadataID)
            }
        }
    }
}
