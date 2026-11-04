import Fluent
import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

struct CreateCustomImportFixture: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("CustomImportFixture")
            .field("FixtureID", .int, .identifier(auto: true))
            .field("Name", .string, .required)
            .field("Quantity", .int, .required)
            .field("HubID", .string, .required)
            .unique(on: "Name")
            .create()
    }
    func revert(on database: Database) async throws { try await database.schema("CustomImportFixture").delete() }
}

private final class CustomImportFixtureModel: Model, @unchecked Sendable {
    static let schema = "CustomImportFixture"
    @ID(custom: "FixtureID", generatedBy: .database) var id: Int?
    @Field(key: "Name") var name: String
    @Field(key: "Quantity") var quantity: Int
    @Field(key: "HubID") var hubID: String
    init() {}
}

final class TableCSVImportTests: XCTestCase {
    private func withFixture(_ test: (Application, TableCSVImportApprovals) async throws -> Void) async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(CreateCustomImportFixture())
            try await app.autoMigrate()
        }) { app in
            try await test(app, TableCSVImportApprovals())
        }
    }

    func testPreviewParsesAndValidatesWithoutWritingThenCommitPersistsWholeBatch() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(.init(
                table: "CustomImportFixture",
                csv: "Name,Quantity,Ignored\r\n\"Oak, dining\",2,x\r\nDesk,1,y",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            ), database: app.db, hubID: "hub-a")
            XCTAssertTrue(preview.readyToImport)
            XCTAssertEqual(preview.rows.count, 2)
            XCTAssertEqual(preview.rows[0].values["Name"], "Oak, dining")
            let countAfterPreview = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterPreview, 0, "Preview must not write records.")

            let result = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
            XCTAssertEqual(result.importedCount, 2)
            let importedCount = try await fixtureCount(app.db)
            XCTAssertEqual(importedCount, 2)
        }
    }

    func testConstraintFailureRollsBackWholeBatch() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(.init(
                table: "CustomImportFixture",
                csv: "Name,Quantity\nSame,1\nSame,2",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            ), database: app.db, hubID: "hub-a")
            XCTAssertTrue(preview.readyToImport)
            do {
                _ = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
                XCTFail("The unique constraint should reject the batch.")
            } catch {
                let countAfterFailure = try await fixtureCount(app.db)
                XCTAssertEqual(countAfterFailure, 0)
            }
        }
    }

    func testPreviewTokenCannotBeCommittedForAnotherHub() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(.init(
                table: "CustomImportFixture", csv: "Name,Quantity\nDesk,1",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            ), database: app.db, hubID: "hub-a")
            do {
                _ = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-b")
                XCTFail("A preview token must be bound to its Hub.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.previewExpired.description)
            }
            let result = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
            XCTAssertEqual(result.importedCount, 1)
            let countAfterValidHubCommit = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterValidHubCommit, 1)
        }
    }

    func testSchemaChangeInvalidatesPreviewToken() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(.init(
                table: "CustomImportFixture", csv: "Name,Quantity\nDesk,1",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            ), database: app.db, hubID: "hub-a")
            try await app.db.schema("CustomImportFixture").field("NewRequired", .string, .required).update()
            do {
                _ = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
                XCTFail("A changed schema must invalidate the preview.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.staleSchema.description)
            }
            let countAfterSchemaChange = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterSchemaChange, 0)
        }
    }

    func testOnlyHubOwnedCustomTablesAreOfferedAndInvalidTypedRowsAreRejected() async throws {
        try await withFixture { app, service in
            let available = try await service.listTables(database: app.db)
            XCTAssertEqual(available.tables.map(\.name), ["CustomImportFixture"])

            let invalid = try await service.preview(.init(
                table: "CustomImportFixture", csv: "Name,Quantity\nDesk,not-a-number",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            ), database: app.db, hubID: "hub-a")
            XCTAssertFalse(invalid.readyToImport)
            XCTAssertNil(invalid.confirmationToken)
            XCTAssertTrue(invalid.rows[0].errors.contains { $0.contains("Quantity") })
            let countAfterInvalidPreview = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterInvalidPreview, 0)

            do {
                _ = try await service.preview(.init(
                    table: "HomeInventory", csv: "ItemName,Quantity\nDesk,1",
                    mapping: ["ItemName": "ItemName", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
                XCTFail("Feature-owned tables must remain behind their dedicated routes.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.unknownOrProtectedTable.description)
            }
        }
    }

    private func fixtureCount(_ database: Database) async throws -> Int {
        try await CustomImportFixtureModel.query(on: database).count()
    }
}
