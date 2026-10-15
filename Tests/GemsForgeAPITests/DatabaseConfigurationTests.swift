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

    func testDevelopmentUsesExistingConfigurationKeys() throws {
        let configuration = try DatabaseEnvironment.resolve(
            "dev",
            variables: [
                "DATABASE_PATH": "/data/GemLife_DB_dev.sqlite",
                "LIVE_DATABASE_BACKUP_DIRECTORY": "/backups/dev"
            ]
        )

        XCTAssertEqual(configuration.environment, .dev)
        XCTAssertEqual(configuration.databasePath, "/data/GemLife_DB_dev.sqlite")
        XCTAssertEqual(configuration.backupDirectory, "/backups/dev")
    }

    func testFitAndProductionUseEnvironmentSpecificPaths() throws {
        let configuration = try DatabaseEnvironment.resolve(
            "fit",
            variables: [
                "DATABASE_PATH_FIT": "/data/GemLife_DB_fit.sqlite",
                "LIVE_DATABASE_BACKUP_DIRECTORY_FIT": "/backups/fit"
            ]
        )

        XCTAssertEqual(configuration.environment, .fit)
        XCTAssertEqual(configuration.databasePath, "/data/GemLife_DB_fit.sqlite")
        XCTAssertEqual(configuration.backupDirectory, "/backups/fit")
    }

    func testMissingEnvironmentSpecificPathIsRejected() {
        XCTAssertThrowsError(try DatabaseEnvironment.resolve(
            "prod",
            variables: [
                "DATABASE_PATH": "/data/GemLife_DB_prod.sqlite",
                "LIVE_DATABASE_BACKUP_DIRECTORY": "/backups/prod"
            ]
        )) { error in
            XCTAssertEqual(error as? DatabaseConfigurationError, .missingConfiguration("DATABASE_PATH_PROD"))
        }
    }

    func testProductionDatabaseAndBackupLocationsCannotBeTheSame() {
        XCTAssertThrowsError(try DatabaseEnvironment.resolve(
            "prod",
            variables: [
                "DATABASE_PATH_PROD": "/data/GemLife_DB_prod.sqlite",
                "LIVE_DATABASE_BACKUP_DIRECTORY_PROD": "/data/GemLife_DB_prod.sqlite"
            ]
        )) { error in
            XCTAssertEqual(error as? DatabaseConfigurationError, .productionBackupCollision)
        }
    }

    func testNonProductionEnvironmentCannotUseProductionDatabasePath() {
        XCTAssertThrowsError(try DatabaseEnvironment.resolve(
            "dev",
            variables: [
                "DATABASE_PATH": "/data/GemLife_DB_prod.sqlite",
                "DATABASE_PATH_PROD": "/data/GemLife_DB_prod.sqlite",
                "LIVE_DATABASE_BACKUP_DIRECTORY": "/backups/dev"
            ]
        )) { error in
            XCTAssertEqual(error as? DatabaseConfigurationError, .nonProductionPathCollision)
        }
    }
}
