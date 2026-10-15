import XCTest
@testable import GemsForgeAPI

final class DatabaseConfigurationTests: XCTestCase {
    func testEnvironmentValuesAreCaseInsensitive() throws {
        XCTAssertEqual(try DatabaseEnvironment.fromEnvironment("FIT"), .fit)
        XCTAssertEqual(try DatabaseEnvironment.fromEnvironment(" prod "), .prod)
    }

    func testMissingEnvironmentUsesSafeDevelopmentDefault() throws {
        XCTAssertEqual(try DatabaseEnvironment.fromEnvironment(nil), .dev)
    }

    func testUnknownEnvironmentIsRejected() {
        XCTAssertThrowsError(try DatabaseEnvironment.fromEnvironment("staging")) { error in
            XCTAssertEqual(
                error as? DatabaseConfigurationError,
                .invalidEnvironment("staging")
            )
        }
    }
}
