import Crypto
import Fluent
import FluentSQLiteDriver
import SQLKit
import Vapor
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
        try await database.schema("CompositeImportFixture")
            .field("PartA", .string, .required)
            .field("PartB", .int, .required)
            .field("Name", .string, .required)
            .field("HubID", .string, .required)
            .compositeIdentifier(over: "PartA", "PartB")
            .create()
    }
    func revert(on database: Database) async throws {
        try await database.schema("CompositeImportFixture").delete()
        try await database.schema("CustomImportFixture").delete()
    }
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
    private func withFixture(_ test: (Application, TableCSVImportApprovals) async throws -> Void)
        async throws
    {
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
            let csv = [
                "Name,Quantity,Ignored",
                "\"Oak, dining\",2,x",
                "\"He said \"\"hello\"\"\nand left\",3,y",
            ].joined(separator: "\r\n")
            let preview = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: csv,
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            XCTAssertTrue(preview.readyToImport)
            XCTAssertEqual(preview.rows.count, 2)
            XCTAssertEqual(preview.rows[0].values["Name"], "Oak, dining")
            XCTAssertEqual(preview.rows[1].values["Name"], "He said \"hello\"\nand left")
            let countAfterPreview = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterPreview, 0, "Preview must not write records.")

            let result = try await service.commit(
                token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
            XCTAssertEqual(result.importedCount, 2)
            let importedCount = try await fixtureCount(app.db)
            XCTAssertEqual(importedCount, 2)
        }
    }

    func testConstraintFailureRollsBackWholeBatch() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(
                .init(
                    table: "CustomImportFixture",
                    csv: "Name,Quantity\nSame,1\nSame,2",
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            XCTAssertTrue(preview.readyToImport)
            do {
                _ = try await service.commit(
                    token: try XCTUnwrap(preview.confirmationToken), database: app.db,
                    hubID: "hub-a")
                XCTFail("The unique constraint should reject the batch.")
            } catch {
                let countAfterFailure = try await fixtureCount(app.db)
                XCTAssertEqual(countAfterFailure, 0)
            }
        }
    }

    func testImportAssignsTextIDAndHubIDForNewSchemaTables() async throws {
        try await withFixture { app, service in
            try await app.db.schema("SchemaImportFixture")
                .field("ID", .string, .identifier(auto: false))
                .field("HubID", .string, .required)
                .field("Title", .string, .required)
                .create()
            let preview = try await service.preview(
                .init(table: "SchemaImportFixture", csv: "Title\nDining table", mapping: ["Title": "Title"]),
                database: app.db,
                hubID: "hub-a"
            )
            XCTAssertTrue(preview.readyToImport)
            XCTAssertNil(preview.rows[0].values["HubID"])
            _ = try await service.commit(token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
            guard let sql = app.db as? SQLDatabase,
                  let row = try await sql.raw("SELECT ID, HubID, Title FROM SchemaImportFixture").first()
            else { return XCTFail("Expected the imported record to exist.") }
            XCTAssertFalse(try row.decode(column: "ID", as: String.self).isEmpty)
            XCTAssertEqual(try row.decode(column: "HubID", as: String.self), "hub-a")
            XCTAssertEqual(try row.decode(column: "Title", as: String.self), "Dining table")
        }
    }

    func testCompositePrimaryKeyColumnsRemainRequiredAndMustBeMapped() async throws {
        try await withFixture { app, service in
            let missingKeys = try await service.preview(
                .init(table: "CompositeImportFixture", csv: "Name\nDining table", mapping: ["Name": "Name"]),
                database: app.db,
                hubID: "hub-a"
            )
            XCTAssertFalse(missingKeys.readyToImport)
            XCTAssertTrue(missingKeys.rows[0].errors.contains("PartA is required and must be mapped."))
            XCTAssertTrue(missingKeys.rows[0].errors.contains("PartB is required and must be mapped."))

            let preview = try await service.preview(
                .init(
                    table: "CompositeImportFixture",
                    csv: "PartA,PartB,Name\nDining,1,Table",
                    mapping: ["PartA": "PartA", "PartB": "PartB", "Name": "Name"]
                ),
                database: app.db,
                hubID: "hub-a"
            )
            XCTAssertTrue(preview.readyToImport)
            _ = try await service.commit(
                token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a"
            )
            guard let sql = app.db as? SQLDatabase,
                  let row = try await sql.raw("SELECT \(ident: "Name") FROM \(ident: "CompositeImportFixture") WHERE \(ident: "HubID") = \(bind: "hub-a")").first()
            else { return XCTFail("Expected the composite-key row to be imported.") }
            XCTAssertEqual(try row.decode(column: "Name", as: String.self), "Table")
        }
    }

    func testPreviewTokenCannotBeCommittedForAnotherHub() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: "Name,Quantity\nDesk,1",
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            do {
                _ = try await service.commit(
                    token: try XCTUnwrap(preview.confirmationToken), database: app.db,
                    hubID: "hub-b")
                XCTFail("A preview token must be bound to its Hub.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.previewExpired.description)
            }
            let result = try await service.commit(
                token: try XCTUnwrap(preview.confirmationToken), database: app.db, hubID: "hub-a")
            XCTAssertEqual(result.importedCount, 1)
            let countAfterValidHubCommit = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterValidHubCommit, 1)
        }
    }

    func testPreviewCapacityIsBoundedPerHub() async throws {
        try await withFixture { app, service in
            let request = TableCSVImportPreviewRequest(
                table: "CustomImportFixture",
                csv: "Name,Quantity\nDesk,1",
                mapping: ["Name": "Name", "Quantity": "Quantity"]
            )
            for _ in 0..<TableCSVImportApprovals.maxActiveApprovalsPerHub {
                _ = try await service.preview(request, database: app.db, hubID: "hub-a")
            }
            do {
                _ = try await service.preview(request, database: app.db, hubID: "hub-a")
                XCTFail("A Hub must not exceed its active preview limit.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.tooManyPreviews.description)
            }

            let otherHubPreview = try await service.preview(
                request, database: app.db, hubID: "hub-b")
            XCTAssertTrue(
                otherHubPreview.readyToImport,
                "One Hub must not consume another Hub's preview allowance.")
        }
    }

    func testSchemaChangeInvalidatesPreviewToken() async throws {
        try await withFixture { app, service in
            let preview = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: "Name,Quantity\nDesk,1",
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            try await app.db.schema("CustomImportFixture").field("NewRequired", .string, .required)
                .update()
            do {
                _ = try await service.commit(
                    token: try XCTUnwrap(preview.confirmationToken), database: app.db,
                    hubID: "hub-a")
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
            XCTAssertEqual(available.tables.map(\.name), ["CompositeImportFixture", "CustomImportFixture", "HomeInventory"])

            let invalid = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: "Name,Quantity\nDesk,not-a-number",
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            XCTAssertFalse(invalid.readyToImport)
            XCTAssertNil(invalid.confirmationToken)
            XCTAssertTrue(invalid.rows[0].errors.contains { $0.contains("Quantity") })
            let countAfterInvalidPreview = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterInvalidPreview, 0)

            do {
                _ = try await service.preview(
                    .init(table: "MissingImportFixture", csv: "Name\nDesk", mapping: ["Name": "Name"]),
                    database: app.db,
                    hubID: "hub-a"
                )
                XCTFail("Unknown tables must not be importable.")
            } catch let error as TableCSVImportError {
                XCTAssertEqual(error.description, TableCSVImportError.unknownOrProtectedTable.description)
            }
        }
    }

    func testMalformedRowsKeepSourceNumbersAndMissingRequiredFieldsBlockPreview() async throws {
        try await withFixture { app, service in
            let malformed = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: "Name,Quantity\nDesk,1\nChair",
                    mapping: ["Name": "Name", "Quantity": "Quantity"]
                ), database: app.db, hubID: "hub-a")
            XCTAssertFalse(malformed.readyToImport)
            XCTAssertNil(malformed.confirmationToken)
            XCTAssertEqual(malformed.rows[1].rowNumber, 3)
            XCTAssertTrue(malformed.rows[1].errors.contains("Expected 2 values but found 1."))

            let missing = try await service.preview(
                .init(
                    table: "CustomImportFixture", csv: "Name\nDesk", mapping: ["Name": "Name"]
                ), database: app.db, hubID: "hub-a")
            XCTAssertFalse(missing.readyToImport)
            XCTAssertNil(missing.confirmationToken)
            XCTAssertTrue(
                missing.rows[0].errors.contains("Quantity is required and must be mapped."))
            let countAfterMissing = try await fixtureCount(app.db)
            XCTAssertEqual(countAfterMissing, 0)
        }
    }

    func testDuplicateHeadersAndHubIDMappingsAreRejected() async throws {
        try await withFixture { app, service in
            do {
                _ = try await service.preview(
                    .init(
                        table: "CustomImportFixture", csv: "Name,Name\nDesk,Chair",
                        mapping: ["Name": "Name"]
                    ), database: app.db, hubID: "hub-a")
                XCTFail("Duplicate CSV headers must be rejected.")
            } catch let error as TableCSVImportError {
                guard case .invalidCSV = error else {
                    return XCTFail("Unexpected error: \(error)")
                }
            }

            do {
                _ = try await service.preview(
                    .init(
                        table: "CustomImportFixture", csv: "Name\nDesk",
                        mapping: ["Name": "HubID"]
                    ), database: app.db, hubID: "hub-a")
                XCTFail("HubID is server-owned and cannot be mapped from CSV.")
            } catch let error as TableCSVImportError {
                guard case .invalidMapping = error else {
                    return XCTFail("Unexpected error: \(error)")
                }
            }
        }
    }

    func testPreviewRouteAcceptsCSVNearTheAdvertisedSizeLimit() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateCustomImportFixture())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware())
            registerTableCSVImportRoutes(app)
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            let token = "csv-import-large-preview"
            let tokenHash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }
                .joined()
            try await AuthenticationSession(
                accountID: "account-a",
                tokenHash: tokenHash,
                expiresAt: Date().addingTimeInterval(3_600)
            ).save(on: app.db)

            try await app.test(.GET, "table-import/tables") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }

            let csv = "Name,Quantity\n\(String(repeating: "x", count: 900_000)),1"
            try await app.test(
                .POST, "table-import/preview",
                beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: token)
                    try request.content.encode(
                        TableCSVImportPreviewRequest(
                            table: "CustomImportFixture",
                            csv: csv,
                            mapping: ["Name": "Name", "Quantity": "Quantity"]
                        ))
                }
            ) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(TableCSVImportPreviewResponse.self)
                XCTAssertTrue(preview.readyToImport)
                XCTAssertEqual(preview.rows.count, 1)
            }
        }
    }

    private func fixtureCount(_ database: Database) async throws -> Int {
        try await CustomImportFixtureModel.query(on: database).count()
    }
}
