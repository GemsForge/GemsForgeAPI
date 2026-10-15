import Fluent
import FluentSQLiteDriver
import Vapor
import XCTest
@testable import GemsForgeAPI

final class HomeInventoryMigrationTests: XCTestCase {
    func testMigrationCreatesThePilotSchema() async throws {
        let app = try await Application.make(.testing)
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateHomeInventory())
        app.migrations.add(CreateFileMetadata())
        app.migrations.add(AddHomeInventoryAttachmentReference())

        try await app.autoMigrate()

        let rows = try await HomeInventory.query(on: app.db(.sqlite)).all()
        XCTAssertTrue(rows.isEmpty)
        try await app.asyncShutdown()
    }
}
