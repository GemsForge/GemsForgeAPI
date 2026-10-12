import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LocalDatabaseRouteTests: XCTestCase {
    func testLocalDatabaseCreationRequiresExplicitConfirmationAndCreatesProfile() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LocalDatabaseTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        let configuration = LocalDatabaseConfiguration(
            enabled: true,
            rootDirectory: rootDirectory,
            protectedDatabaseURL: rootDirectory.appendingPathComponent("personal.sqlite")
        )

        try await withApp(configure: { app in
            registerLocalDatabaseRoutes(app, configuration: configuration)
        }) { app in
            try await app.test(.GET, "local-databases/capabilities") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let capabilities = try response.content.decode(LocalDatabaseCapabilitiesResponse.self)
                XCTAssertTrue(capabilities.enabled)
                XCTAssertTrue(capabilities.ready)
                XCTAssertEqual(capabilities.profiles.count, 1)
                XCTAssertEqual(capabilities.profiles[0].id, "gem-life-development")
            }

            let unconfirmed = LocalDatabaseCreationRequest(
                databaseName: "test.sqlite",
                profile: "gem-life-development",
                confirmCreation: false
            )
            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(unconfirmed)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let confirmed = LocalDatabaseCreationRequest(
                databaseName: "test.sqlite",
                profile: "gem-life-development",
                confirmCreation: true
            )
            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(confirmed)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(LocalDatabaseCreationResponse.self)
                XCTAssertEqual(result.databaseName, "test.sqlite")
                XCTAssertEqual(result.migrationCount, 20)
                XCTAssertEqual(result.status, "created-and-migrated")
            }

            XCTAssertTrue(FileManager.default.fileExists(atPath: rootDirectory.appendingPathComponent("test.sqlite").path))

            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(confirmed)
            }) { response in
                XCTAssertEqual(response.status, .conflict)
            }
        }
    }

    func testLocalDatabaseCreationProtectsPathsAndCanBeDisabled() async throws {
        let rootDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GemsForgeAPI-LocalDatabaseSafetyTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: rootDirectory) }

        let protectedURL = rootDirectory.appendingPathComponent("personal.sqlite")
        FileManager.default.createFile(atPath: protectedURL.path, contents: nil)
        let configuration = LocalDatabaseConfiguration(
            enabled: true,
            rootDirectory: rootDirectory,
            protectedDatabaseURL: protectedURL
        )

        try await withApp(configure: { app in
            registerLocalDatabaseRoutes(app, configuration: configuration)
        }) { app in
            let protectedRequest = LocalDatabaseCreationRequest(
                databaseName: "personal.sqlite",
                profile: "gem-life-development",
                confirmCreation: true
            )
            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(protectedRequest)
            }) { response in
                XCTAssertEqual(response.status, .conflict)
            }

            let traversalRequest = LocalDatabaseCreationRequest(
                databaseName: "../unsafe.sqlite",
                profile: "gem-life-development",
                confirmCreation: true
            )
            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(traversalRequest)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
        }

        let disabledConfiguration = LocalDatabaseConfiguration(
            enabled: false,
            rootDirectory: rootDirectory,
            protectedDatabaseURL: protectedURL
        )
        try await withApp(configure: { app in
            registerLocalDatabaseRoutes(app, configuration: disabledConfiguration)
        }) { app in
            let payload = LocalDatabaseCreationRequest(
                databaseName: "disabled.sqlite",
                profile: "gem-life-development",
                confirmCreation: true
            )
            try await app.test(.POST, "local-databases", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response in
                XCTAssertEqual(response.status, .forbidden)
            }
        }
    }
}
