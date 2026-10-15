import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class GemHueRouteTests: XCTestCase {
    func testGemHueRoutesReadRecordsWithoutEmbeddingImages() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateGemHues())
            app.migrations.add(CreateGemHueImages())
            app.migrations.add(AddGemHueImageFileMetadataReference())
            try await app.autoMigrate()
            registerGemHueRoutes(app)

            let hue = GemHue(
                id: "HUE-0001",
                colorName: "Muted Sage",
                colorFamily: "Green",
                hexCode: "#9CAF88"
            )
            try await hue.create(on: app.db)

            let image = GemHueImage()
            image.$hue.id = hue.id!
            image.image = Data([0x01, 0x02, 0x03])
            image.mimeType = "image/png"
            image.fileSizeBytes = 3
            try await image.create(on: app.db)
        }) { app in
            try await app.test(.GET, "gemhues") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let hues = try response.content.decode([GemHue].self)
                XCTAssertEqual(hues.map(\.id), ["HUE-0001"])
            }

            try await app.test(.GET, "gemhues/HUE-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let hue = try response.content.decode(GemHue.self)
                XCTAssertEqual(hue.colorName, "Muted Sage")
            }

            try await app.test(.GET, "gemhues/HUE-0001/image") { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.headers.contentType?.description, "image/png")
                XCTAssertEqual(response.body.readableBytes, 3)
            }
        }
    }

    func testGemHueRoutesReturnNotFoundForMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateGemHues())
            app.migrations.add(CreateGemHueImages())
            app.migrations.add(AddGemHueImageFileMetadataReference())
            try await app.autoMigrate()
            registerGemHueRoutes(app)
        }) { app in
            try await app.test(.GET, "gemhues/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.GET, "gemhues/MISSING/image") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
