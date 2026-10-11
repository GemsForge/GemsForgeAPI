import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class ServiceLogoRouteTests: XCTestCase {
    func testServiceLogoRoutesReturnMetadataAndExplicitImage() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateServiceLogoAssets())
            try await app.autoMigrate()

            let asset = ServiceLogoAsset()
            asset.logo = Data("logo-bytes".utf8)
            asset.mimeType = "image/png"
            asset.fileName = "example.png"
            asset.fileSizeBytes = 10
            asset.logoKey = "EXAMPLE_LOGO"
            try await asset.create(on: app.db)

            registerServiceLogoRoutes(app)
        }) { app in
            try await app.test(.GET, "service-logos") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let logos = try response.content.decode([ServiceLogoAssetSummary].self)
                XCTAssertEqual(logos.count, 1)
                XCTAssertEqual(logos[0].logoKey, "EXAMPLE_LOGO")
                XCTAssertEqual(logos[0].fileName, "example.png")
                XCTAssertEqual(logos[0].imagePath, "/service-logos/1/image")
            }

            try await app.test(.GET, "service-logos/1") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let logo = try response.content.decode(ServiceLogoAssetSummary.self)
                XCTAssertEqual(logo.mimeType, "image/png")
            }

            try await app.test(.GET, "service-logos/1/image") { response in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.headers.contentType, .png)
                XCTAssertEqual(response.body, .init(data: Data("logo-bytes".utf8)))
            }
        }
    }

    func testServiceLogoRoutesReturnNotFoundForMissingAssets() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateServiceLogoAssets())
            try await app.autoMigrate()
            registerServiceLogoRoutes(app)
        }) { app in
            try await app.test(.GET, "service-logos/999") { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.GET, "service-logos/999/image") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
