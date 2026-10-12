import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class SchemaBuilderGuidanceRouteTests: XCTestCase {
    func testGuidanceEndpointReturnsVersionedReadOnlyCatalog() async throws {
        try await withApp(configure: { app in
            registerSchemaBuilderGuidanceRoutes(app)
        }) { app in
            try await app.test(.GET, "schema-builder/metadata") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let guidance = try response.content.decode(SchemaBuilderGuidance.self)

                XCTAssertEqual(guidance.version, "1")
                XCTAssertEqual(guidance.supportedTypes.count, SQLiteColumnType.allCases.count)
                XCTAssertFalse(guidance.rules.isEmpty)
            }

            try await app.test(.POST, "schema-builder/metadata") { response async in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
