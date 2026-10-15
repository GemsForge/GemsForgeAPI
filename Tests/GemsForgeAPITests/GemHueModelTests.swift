import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class GemHueModelTests: XCTestCase {
    func testGemHueMapsExistingColumnsAndImageRelationship() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateGemHues())
            app.migrations.add(CreateGemHueImages())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddGemHueImageFileMetadataReference())
            try await app.autoMigrate()
        }) { app in
            let hue = GemHue(
                id: "HUE-0001",
                colorName: "Muted Sage",
                colorFamily: "Green",
                hexCode: "#9CAF88",
                mood: "Elegant, Grounding",
                palette: "Earthy Elegance",
                description: "A grounded green.",
                createdDate: "2026-10-08",
                notes: "Foundation palette."
            )
            try await hue.create(on: app.db)

            let image = GemHueImage()
            image.$hue.id = hue.id!
            image.image = Data([0x89, 0x50, 0x4E, 0x47])
            image.mimeType = "image/png"
            image.fileName = "muted-sage.png"
            image.fileSizeBytes = image.image.count
            try await image.create(on: app.db)

            let savedHue = try await GemHue.find("HUE-0001", on: app.db)
            let savedImage = try await GemHueImage.query(on: app.db)
                .filter(\.$hue.$id == "HUE-0001")
                .first()

            XCTAssertEqual(savedHue?.colorName, "Muted Sage")
            XCTAssertEqual(savedHue?.hexCode, "#9CAF88")
            XCTAssertEqual(savedHue?.createdDate, "2026-10-08")
            XCTAssertEqual(savedImage?.$hue.id, "HUE-0001")
            XCTAssertEqual(savedImage?.image, Data([0x89, 0x50, 0x4E, 0x47]))
            XCTAssertEqual(savedImage?.mimeType, "image/png")
            XCTAssertEqual(savedImage?.fileSizeBytes, 4)
        }
    }
}
