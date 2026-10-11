import FluentSQLiteDriver
import NIOCore
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class LocalImageUploadRouteTests: XCTestCase {
    func testImageUploadStoresFileAndMetadataOnly() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("gemsforge-upload-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerLocalImageUploadRoutes(
                app,
                configuration: .init(directory: directory.path, maxBytes: 1024)
            )
        }) { app in
            let boundary = "gemsforge-boundary"
            let body = """
            --\(boundary)\r
            Content-Disposition: form-data; name="file"; filename="receipt.png"\r
            Content-Type: image/png\r
            \r
            image-bytes\r
            --\(boundary)\r
            Content-Disposition: form-data; name="fileKind"\r
            \r
            receipt\r
            --\(boundary)\r
            Content-Disposition: form-data; name="ownerType"\r
            \r
            ExpenseTransaction\r
            --\(boundary)\r
            Content-Disposition: form-data; name="ownerID"\r
            \r
            TRX-0001\r
            --\(boundary)--\r
            """

            try await app.test(
                .POST,
                "file-uploads",
                headers: ["Content-Type": "multipart/form-data; boundary=\(boundary)"],
                body: .init(string: body)
            ) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let metadata = try response.content.decode(FileMetadata.self)
                XCTAssertEqual(metadata.fileName, "receipt.png")
                XCTAssertEqual(metadata.fileKind, "receipt")
                XCTAssertEqual(metadata.mimeType, "image/png")
                XCTAssertEqual(metadata.ownerType, "ExpenseTransaction")
                XCTAssertEqual(metadata.ownerID, "TRX-0001")
                XCTAssertEqual(metadata.relativePath.split(separator: "/").first, "uploads")

                let saved = try await FileMetadata.find(metadata.id, on: app.db)
                XCTAssertNotNil(saved)
                XCTAssertTrue(
                    FileManager.default.fileExists(
                        atPath: directory.appendingPathComponent(metadata.relativePath).path
                    )
                )
            }
        }
    }

    func testImageUploadRejectsNonImagesAndOversizedFiles() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("gemsforge-upload-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerLocalImageUploadRoutes(
                app,
                configuration: .init(directory: directory.path, maxBytes: 4)
            )
        }) { app in
            func multipart(filename: String, contentType: String, contents: String) -> (ByteBuffer, HTTPHeaders) {
                let boundary = "test-boundary"
                let body = """
                --\(boundary)\r
                Content-Disposition: form-data; name="file"; filename="\(filename)"\r
                Content-Type: \(contentType)\r
                \r
                \(contents)\r
                --\(boundary)--\r
                """
                return (
                    ByteBufferAllocator().buffer(string: body),
                    ["Content-Type": "multipart/form-data; boundary=\(boundary)"]
                )
            }

            let nonImage = multipart(filename: "notes.txt", contentType: "text/plain", contents: "ok")
            try await app.test(.POST, "file-uploads", headers: nonImage.1, body: nonImage.0) { response async in
                XCTAssertEqual(response.status, .unsupportedMediaType)
            }

            let oversized = multipart(filename: "large.png", contentType: "image/png", contents: "12345")
            try await app.test(.POST, "file-uploads", headers: oversized.1, body: oversized.0) { response async in
                XCTAssertEqual(response.status, .payloadTooLarge)
            }
        }
    }
}
