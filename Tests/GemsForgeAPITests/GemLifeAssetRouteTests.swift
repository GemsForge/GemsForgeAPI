import Foundation
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class GemLifeAssetRouteTests: XCTestCase {
    func testMissingBundleHasActionableFallback() async throws {
        try await withApp(configure: { app in registerGemLifeAssetRoutes(app, directory: nil) }) { app in
            try await app.test(.GET, "app/") { response in
                XCTAssertEqual(response.status, .serviceUnavailable)
                XCTAssertTrue(response.body.string.contains("build-gem-life.mjs"))
                XCTAssertEqual(response.headers.first(name: "Cache-Control"), "no-store")
            }
        }
    }

    func testHTMLRoutesAssetsAndTraversal() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("gemlife-assets-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory.appendingPathComponent("assets"), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        try Data("<html>Gem Life</html>".utf8).write(to: directory.appendingPathComponent("index.html"))
        try Data("console.log('bundle')".utf8).write(to: directory.appendingPathComponent("assets/index-test.js"))
        let outside = FileManager.default.temporaryDirectory.appendingPathComponent("gemlife-outside-\(UUID().uuidString).js")
        try Data("not a packaged asset".utf8).write(to: outside)
        defer { try? FileManager.default.removeItem(at: outside) }
        try FileManager.default.createSymbolicLink(at: directory.appendingPathComponent("assets/escape.js"), withDestinationURL: outside)
        try await withApp(configure: { app in registerGemLifeAssetRoutes(app, directory: directory.path, supabaseURL: "https://gemlife.supabase.co") }) { app in
            try await app.test(.GET, "app/education", beforeRequest: { request in request.headers.replaceOrAdd(name: "Accept", value: "text/html") }) { response in
                XCTAssertEqual(response.status, .ok)
                XCTAssertTrue(response.body.string.contains("Gem Life"))
                XCTAssertEqual(response.headers.first(name: "Cache-Control"), "no-cache")
                let policy = try XCTUnwrap(response.headers.first(name: "Content-Security-Policy"))
                XCTAssertTrue(policy.contains("connect-src 'self' https://gemlife.supabase.co"))
                XCTAssertFalse(policy.contains("*"))
            }
            try await app.test(.GET, "app/assets/index-test.js") { response in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.headers.first(name: "Cache-Control"), "public, max-age=31536000, immutable")
                XCTAssertEqual(response.headers.first(name: "X-Content-Type-Options"), "nosniff")
            }
            for path in ["app/assets/missing.js", "app/assets/%2e%2e/%2e%2e/private.txt", "app/assets/escape.js", "app/private.txt"] {
                try await app.test(.GET, path) { response in XCTAssertEqual(response.status, .notFound) }
            }
        }
    }
}
