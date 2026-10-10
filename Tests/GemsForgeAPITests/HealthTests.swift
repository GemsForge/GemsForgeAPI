import XCTest
import VaporTesting

final class HealthTests: XCTestCase {
    func testHealthEndpoint() async throws {
        try await withApp(configure: { app in
            app.get("health") { _ async in
                "ok"
            }
        }) { app in
            try await app.test(.GET, "health") { response async in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.body.string, "ok")
            }
        }
    }
}
