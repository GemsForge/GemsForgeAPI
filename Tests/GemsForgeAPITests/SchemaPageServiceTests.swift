import Crypto
import Fluent
import SQLKit
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

struct CreateSchemaPageFixtures: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("SchemaPageFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .field("Quantity", .int, .required)
            .field("CategoryID", .int)
            .field("Photo", .string)
            .create()
        try await database.schema("UnscopedFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("Name", .string, .required)
            .create()
        try await database.schema("IntegerSchemaPageFixture")
            .field("ID", .int, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .create()
        try await database.schema("Education")
            .field("EducationID", .string, .identifier(auto: false))
            .field("HubID", .string)
            .field("InstitutionName", .string, .required)
            .create()
        try await database.schema("Transactions")
            .field("TransactionID", .string, .identifier(auto: false))
            .field("HubID", .string)
            .field("Item", .string, .required)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("UnscopedFixture").delete()
        try await database.schema("Transactions").delete()
        try await database.schema("Education").delete()
        try await database.schema("IntegerSchemaPageFixture").delete()
        try await database.schema("SchemaPageFixture").delete()
    }
}

final class SchemaPageServiceTests: XCTestCase {
    func testListsScopedSchemaPagesAndReadsOnlyTheAuthenticatedHubsRows() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a'), ('account-b', 'subject-b')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A'), ('hub-b', 'account-b', 'B')").run()
            try await sql.raw("""
                INSERT INTO "SchemaPageFixture" ("ID", "HubID", "Name", "Quantity") VALUES
                ('a1', 'hub-a', 'Desk', 1), ('a2', 'hub-a', 'Chair', 2), ('b1', 'hub-b', 'Lamp', 3)
                """).run()
            try await sql.raw("INSERT INTO Education (EducationID, HubID, InstitutionName) VALUES ('edu-a', 'hub-a', 'Community College'), ('edu-b', 'hub-b', 'Other Hub School')").run()
        }) { app in
            let service = SchemaPageService(database: app.db, hubID: "hub-a")
            let initialTables = try await service.listTables()
            XCTAssertEqual(initialTables.tables.map(\.name), ["Education"])
            XCTAssertEqual(initialTables.availableTables.map(\.name), ["IntegerSchemaPageFixture", "SchemaPageFixture"])
            XCTAssertFalse(initialTables.tables.contains(where: { $0.name == "Transactions" }))
            XCTAssertFalse(initialTables.availableTables.contains(where: { $0.name == "Transactions" }))
            do {
                _ = try await service.createPage(tableName: "Transactions")
                XCTFail("The existing Expense Tracker collection must not get a duplicate schema page.")
            } catch let error as SchemaPageError {
                XCTAssertEqual(error, .tableUnavailable)
            }
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            _ = try await service.createPage(tableName: "SchemaPageFixture")
            let tables = try await service.listTables()
            XCTAssertEqual(tables.tables.map(\.name), ["Education", "SchemaPageFixture"])
            XCTAssertEqual(tables.availableTables.map(\.name), ["IntegerSchemaPageFixture"])
            let otherHubTables = try await SchemaPageService(database: app.db, hubID: "hub-b").listTables()
            XCTAssertEqual(otherHubTables.tables.map(\.name), ["Education"])
            XCTAssertFalse(otherHubTables.availableTables.contains(where: { $0.name == "Education" }))
            let registeredViews = try await TableView.query(on: app.db).filter(\.$hubID == "hub-a").count()
            XCTAssertEqual(registeredViews, 2)

            let firstPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 0)
            XCTAssertEqual(firstPage.totalCount, 2)
            XCTAssertEqual(firstPage.rows.count, 1)
            XCTAssertEqual(firstPage.rows[0]["Name"]!, "Desk")

            let secondPage = try await service.records(tableName: "SchemaPageFixture", limit: 1, offset: 1)
            XCTAssertEqual(secondPage.rows[0]["Name"]!, "Chair")

            let educationPage = try await service.records(tableName: "Education", limit: 10, offset: 0)
            XCTAssertEqual(educationPage.totalCount, 1)
            XCTAssertEqual(educationPage.rows[0]["InstitutionName"]!, "Community College")

            do {
                _ = try await service.records(tableName: "UnscopedFixture", limit: 10, offset: 0)
                XCTFail("Tables without required HubID ownership must not become pages.")
            } catch let error as SchemaPageError {
                XCTAssertEqual(error, .tableUnavailable)
            }
        }
    }

    func testSchemaPageRoutesRequireAnAuthenticatedHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerSchemaPageRoutes(app)
        }) { app in
            try await app.test(.GET, "schema-builder/tables") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.GET, "schema-builder/tables/SchemaPageFixture/records") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/a1") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testAuthenticatedHubCanRegisterAndListOnlyItsSchemaPages() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerSchemaPageRoutes(app)
            registerTableViewRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            let firstPhoto = FileMetadata(id: "PHOTO-A", relativePath: "uploads/a.png", fileName: "a.png", fileKind: "image", mimeType: "image/png")
            firstPhoto.hubID = "hub-a"
            try await firstPhoto.create(on: app.db)
            let secondPhoto = FileMetadata(id: "PHOTO-B", relativePath: "uploads/b.png", fileName: "b.png", fileKind: "image", mimeType: "image/jpeg")
            secondPhoto.hubID = "hub-a"
            try await secondPhoto.create(on: app.db)
            let otherHubPhoto = FileMetadata(id: "PHOTO-OTHER", relativePath: "uploads/other.png", fileName: "other.png", fileKind: "image", mimeType: "image/png")
            otherHubPhoto.hubID = "hub-b"
            try await otherHubPhoto.create(on: app.db)
            try await sql.raw("INSERT INTO SchemaPageFixture (ID, HubID, Name, Quantity) VALUES ('fixture-a', 'hub-a', 'Saved goal', 1), ('fixture-b', 'hub-b', 'Other Hub goal', 2)").run()
            try await sql.raw("INSERT INTO IntegerSchemaPageFixture (ID, HubID, Name) VALUES (12, 'hub-a', 'Integer keyed record'), (13, 'hub-b', 'Other Hub record')").run()
            try await sql.raw("CREATE TABLE NonRowidIntegerFixture (ID INT NOT NULL PRIMARY KEY, HubID TEXT NOT NULL, Name TEXT NOT NULL)").run()
            try await sql.raw("INSERT INTO NonRowidIntegerFixture (ID, HubID, Name) VALUES (40, 'hub-a', 'Existing record')").run()

            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(SchemaPageTableResponse.self).name, "SchemaPageFixture")
            }
            try await app.test(.GET, "schema-builder/tables", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                let pages = try response.content.decode(SchemaPageTablesResponse.self)
                XCTAssertEqual(pages.tables.map(\.name), ["Education", "SchemaPageFixture"])
                XCTAssertEqual(pages.availableTables.map(\.name), ["IntegerSchemaPageFixture", "NonRowidIntegerFixture"])
            }
            try await app.test(.GET, "schema-builder/tables/IntegerSchemaPageFixture/records/12", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let result = try response.content.decode(SchemaPageRecordResponse.self)
                XCTAssertEqual(result.row["Name"]!, "Integer keyed record")
            }
            try await app.test(.GET, "schema-builder/tables/IntegerSchemaPageFixture/records/13", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            let workspaceState = #"{"activeViewId":"gallery","selectedRecordId":"fixture-a","search":"goal"}"#
            try await app.test(.PUT, "table-views/SchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(
                    workspaceState: #"{"activeViewId":"gallery","selectedRecordId":"fixture-b"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            try await app.test(.PUT, "table-views/SchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(workspaceState: workspaceState))
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.GET, "table-views/SchemaPageFixture/Gallery", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let saved = try response.content.decode(SavedTableViewResponse.self)
                XCTAssertEqual(saved.view.workspaceState, workspaceState)
            }

            try await sql.raw("CREATE TABLE BudgetCategories (ID INTEGER PRIMARY KEY, HubID TEXT NOT NULL, Category TEXT NOT NULL)").run()
            try await sql.raw("INSERT INTO BudgetCategories (ID, HubID, Category) VALUES (5, 'hub-a', 'Food'), (6, 'hub-b', 'Private')").run()
            try await TableView(hubID: "hub-a", tableName: "BudgetCategories", name: "Budget Categories", viewType: .table).save(on: app.db)
            try await TablePropertyDefinition(
                hubID: "hub-a",
                tableName: "SchemaPageFixture",
                definition: TablePropertyDefinitionRequest(
                    id: "category-relation", name: "Category", kind: .relation,
                    sourceColumnName: "CategoryID", targetTableName: "BudgetCategories",
                    targetKeyColumnName: "ID", targetDisplayColumnName: "Category",
                    relationDefinitionID: nil, targetColumnName: nil,
                    filterByDefinitionID: nil, targetFilterColumnName: nil
                ),
                id: "category-relation",
                sortOrder: 0
            ).save(on: app.db)

            var createdID = ""
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"New goal","Quantity":4}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                createdID = try response.content.decode(SchemaPageRecordCreationResponse.self).recordID
                XCTAssertFalse(createdID.isEmpty)
            }
            let visibleToCreator = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .containsRecord(createdID, in: "SchemaPageFixture")
            let visibleToOtherHub = try await SchemaPageService(database: app.db, hubID: "hub-b")
                .containsRecord(createdID, in: "SchemaPageFixture")
            XCTAssertTrue(visibleToCreator)
            XCTAssertFalse(visibleToOtherHub)

            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Updated goal","Quantity":9}"#)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let updatedRecord = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .record(tableName: "SchemaPageFixture", recordID: createdID)
            XCTAssertEqual(updatedRecord.row["Name"]!, "Updated goal")
            XCTAssertEqual(updatedRecord.row["Quantity"]!, "9")

            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"CategoryID":5}"#)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            for invalidCategoryID in [6, 999] {
                try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: tokenA)
                    request.headers.contentType = .json
                    request.body = ByteBuffer(string: #"{"CategoryID":\#(invalidCategoryID)}"#)
                }) { response in
                    XCTAssertEqual(response.status, .unprocessableEntity)
                }
            }

            for fileMetadataID in ["PHOTO-A", "PHOTO-B"] {
                try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)/attachments/Photo", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: tokenA)
                    try request.content.encode(AttachmentReferenceRequest(fileMetadataID: fileMetadataID))
                }) { response in
                    XCTAssertEqual(response.status, .noContent)
                }
                let attached = try await FileMetadata.find(fileMetadataID, on: app.db)
                XCTAssertEqual(attached?.ownerType, "SchemaPageFixture")
                XCTAssertEqual(attached?.ownerID, createdID)
                if fileMetadataID == "PHOTO-B" {
                    let replacedPhotoOwner = try await FileMetadata.find("PHOTO-A", on: app.db)?.ownerID
                    XCTAssertNil(replacedPhotoOwner)
                }
            }
            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)/attachments/Photo", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(AttachmentReferenceRequest(fileMetadataID: "PHOTO-OTHER"))
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)/attachments/Photo", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(AttachmentReferenceRequest(fileMetadataID: nil))
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let firstPhotoOwner = try await FileMetadata.find("PHOTO-A", on: app.db)?.ownerID
            let secondPhotoOwner = try await FileMetadata.find("PHOTO-B", on: app.db)?.ownerID
            let clearedPhoto = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .record(tableName: "SchemaPageFixture", recordID: createdID).row["Photo"]!
            XCTAssertNil(firstPhotoOwner)
            XCTAssertNil(secondPhotoOwner)
            XCTAssertNil(clearedPhoto)

            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/fixture-b", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Cross-Hub edit"}"#)
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"HubID":"hub-b"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.PATCH, "schema-builder/tables/SchemaPageFixture/records/\(createdID)", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Unknown":"value"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            var generatedEducationID = ""
            try await app.test(.POST, "schema-builder/tables/Education/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"InstitutionName":"New campus"}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                generatedEducationID = try response.content.decode(SchemaPageRecordCreationResponse.self).recordID
            }
            let educationRecordIsHubScoped = try await SchemaPageService(database: app.db, hubID: "hub-a")
                .containsRecord(generatedEducationID, in: "Education")
            XCTAssertTrue(educationRecordIsHubScoped)

            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"ID":4242,"Name":"Client supplied key"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Generated integer key"}"#)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let created = try response.content.decode(SchemaPageRecordCreationResponse.self)
                XCTAssertEqual(created.table, "IntegerSchemaPageFixture")
                guard let integerID = Int64(created.recordID), let sql = app.db as? SQLDatabase,
                      let row = try await sql.raw(SQLQueryString(
                          "SELECT \(ident: "Name") FROM \(ident: "IntegerSchemaPageFixture") WHERE \(ident: "ID") = \(bind: integerID) AND \(ident: "HubID") = \(bind: "hub-a")"
                      )).first()
                else { return XCTFail("The response ID must identify the row created for this Hub.") }
                XCTAssertEqual(try row.decode(column: "Name", as: String.self), "Generated integer key")
            }

            let service = SchemaPageService(database: app.db, hubID: "hub-a")
            let concurrentIDs = try await withThrowingTaskGroup(of: String.self) { group in
                for index in 0..<8 {
                    group.addTask {
                        let created = try await service.createRecord(
                            tableName: "IntegerSchemaPageFixture",
                            values: ["Name": .string("Concurrent record \(index)")]
                        )
                        return created.recordID
                    }
                }
                var identifiers: [String] = []
                for try await identifier in group { identifiers.append(identifier) }
                return identifiers
            }
            XCTAssertEqual(concurrentIDs.count, 8)
            XCTAssertEqual(Set(concurrentIDs).count, 8, "SQLite must assign distinct IDs to concurrent inserts.")

            try await app.test(.POST, "schema-builder/tables/NonRowidIntegerFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Generated non-rowid key"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
                XCTAssertTrue(response.body.string.contains("INTEGER PRIMARY KEY"))
            }

            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Attempted ownership","Quantity":1,"HubID":"hub-b"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/SchemaPageFixture/records", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"Name":"Missing quantity"}"#)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/IntegerSchemaPageFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.PUT, "table-views/IntegerSchemaPageFixture/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(
                    workspaceState: #"{"activeViewId":"gallery","selectedRecordId":"12"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.POST, "schema-builder/tables/UnscopedFixture/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
            try await app.test(.POST, "schema-builder/tables/Transactions/page", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "schema-page-session-\(accountID)"
        let tokenHash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: tokenHash,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
