import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class FileMetadataRouteTests: XCTestCase {
    func testFileMetadataCRUDDoesNotTouchFiles() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerFileMetadataRoutes(app)
        }) { app in
            let payload = FileMetadataRequest(
                id: "FILE-0001",
                relativePath: "images/receipts/receipt-0001.jpg",
                fileName: "receipt-0001.jpg",
                fileKind: "receipt-image",
                mimeType: "image/jpeg",
                byteSize: 2048,
                checksum: "sha256:example",
                ownerType: "ExpenseTransaction",
                ownerID: "TRX-0001"
            )

            try await app.test(.POST, "file-metadata", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let metadata = try response.content.decode(FileMetadata.self)
                XCTAssertEqual(metadata.id, "FILE-0001")
                XCTAssertEqual(metadata.relativePath, "images/receipts/receipt-0001.jpg")
                XCTAssertEqual(metadata.ownerID, "TRX-0001")
            }

            try await app.test(.GET, "file-metadata") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let records = try response.content.decode([FileMetadata].self)
                XCTAssertEqual(records.count, 1)
            }

            try await app.test(.GET, "file-metadata/FILE-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let metadata = try response.content.decode(FileMetadata.self)
                XCTAssertEqual(metadata.mimeType, "image/jpeg")
            }

            let updatedPayload = FileMetadataRequest(
                id: "FILE-0001",
                relativePath: "images/receipts/receipt-0001-updated.jpg",
                fileName: "receipt-0001-updated.jpg",
                fileKind: "receipt-image",
                mimeType: "image/jpeg",
                byteSize: 4096,
                checksum: "sha256:updated",
                ownerType: "ExpenseTransaction",
                ownerID: "TRX-0001"
            )

            try await app.test(.PUT, "file-metadata/FILE-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let metadata = try response.content.decode(FileMetadata.self)
                XCTAssertEqual(metadata.relativePath, "images/receipts/receipt-0001-updated.jpg")
                XCTAssertEqual(metadata.byteSize, 4096)
            }

            try await app.test(.DELETE, "file-metadata/FILE-0001") { response in
                XCTAssertEqual(response.status, .noContent)
            }
        }
    }

    func testFileMetadataRejectsUnsafePathsAndInvalidOwnership() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerFileMetadataRoutes(app)
        }) { app in
            let invalidPayload = FileMetadataRequest(
                id: nil,
                relativePath: "../private/secret.png",
                fileName: "secret.png",
                fileKind: "image",
                mimeType: "image/png",
                byteSize: 1,
                checksum: nil,
                ownerType: "ExpenseTransaction",
                ownerID: nil
            )

            try await app.test(.POST, "file-metadata", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "file-metadata/MISSING") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
