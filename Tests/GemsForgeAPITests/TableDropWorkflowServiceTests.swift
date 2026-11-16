import Fluent
import SQLKit
import VaporTesting
import XCTest
@testable import GemsForgeAPI

struct CreateTableDropFixture: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("DropFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .create()
        try await database.schema("DropReferenceFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("TargetID", .string)
            .create()
        try await database.schema("RollbackFixture")
            .field("ID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Name", .string, .required)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("DropReferenceFixture").delete()
        try await database.schema("RollbackFixture").delete()
        try await database.schema("DropFixture").delete()
    }
}

final class TableDropWorkflowServiceTests: XCTestCase {
    func testPreviewIsReadOnlyAndChangedRowsRequireFreshPreview() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("TableDropPreview-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let databaseURL = root.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = root.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTableColumnDefinitions())
            app.migrations.add(CreateRecordPresentations())
            app.migrations.add(CreateRecordBodies())
            app.migrations.add(CreateTrashEntries())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateTableDropFixture())
            try await app.autoMigrate()
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await sql.raw("INSERT INTO DropFixture (ID, HubID, Name) VALUES ('one', 'hub-a', 'One')").run()
            let beforeSchema = try await LiveSchemaService(database: app.db).inspect()
            let beforeRows = try await sql.raw("SELECT COUNT(*) AS n FROM DropFixture").first()?.decode(column: "n", as: Int.self)
            let service = TableDropWorkflowService(backupConfiguration: LiveDatabaseBackupConfiguration(sourceURL: databaseURL, destinationDirectory: backupDirectory))
            let preview = try await service.preview(tableName: "DropFixture", hubID: "hub-a", using: app.db)
            let afterSchema = try await LiveSchemaService(database: app.db).inspect()
            let afterRows = try await sql.raw("SELECT COUNT(*) AS n FROM DropFixture").first()?.decode(column: "n", as: Int.self)
            XCTAssertEqual(preview.rowCount, 1)
            XCTAssertEqual(preview.totalDatabaseRowCount, 1)
            XCTAssertTrue(preview.blockingReferences.isEmpty)
            XCTAssertEqual(afterSchema.tableCount, beforeSchema.tableCount)
            XCTAssertEqual(afterRows, beforeRows)
            XCTAssertFalse(FileManager.default.fileExists(atPath: backupDirectory.appendingPathComponent("unused").path))

            let unavailableBackupDirectory = root.appendingPathComponent("missing-backups")
            let backupFailureService = TableDropWorkflowService(backupConfiguration: LiveDatabaseBackupConfiguration(
                sourceURL: databaseURL,
                destinationDirectory: unavailableBackupDirectory
            ))
            let backupFailurePreview = try await backupFailureService.preview(tableName: "DropFixture", hubID: "hub-a", using: app.db)
            do {
                _ = try await backupFailureService.confirm(
                    tableName: "DropFixture", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: backupFailurePreview.confirmationToken, typedTableName: "DropFixture"),
                    using: app.db
                )
                XCTFail("A failed backup must prevent deletion.")
            } catch let error as TableDropWorkflowError {
                guard case .backupFailed = error else { return XCTFail("Unexpected error: \(error)") }
            }
            let afterBackupFailure = try await sql.raw("SELECT COUNT(*) AS n FROM DropFixture").first()?.decode(column: "n", as: Int.self)
            XCTAssertEqual(afterBackupFailure, 1)

            try await sql.raw("INSERT INTO DropFixture (ID, HubID, Name) VALUES ('two', 'hub-a', 'Two')").run()
            do {
                _ = try await service.confirm(
                    tableName: "DropFixture", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: preview.confirmationToken, typedTableName: "DropFixture"),
                    using: app.db
                )
                XCTFail("Changed data must require a refreshed preview.")
            } catch let error as TableDropWorkflowError {
                guard case .previewChanged(let refreshed) = error else { return XCTFail("Unexpected error: \(error)") }
                XCTAssertEqual(refreshed.rowCount, 2)
            }
            let remainingRows = try await sql.raw("SELECT COUNT(*) AS n FROM DropFixture").first()?.decode(column: "n", as: Int.self)
            XCTAssertEqual(remainingRows, 2)
        }
    }

    func testConfirmationCreatesVerifiedBackupAndDropsOnlyEligibleTable() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("TableDropConfirm-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let databaseURL = root.appendingPathComponent("GemLife.sqlite")
        let backupDirectory = root.appendingPathComponent("backups")
        try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.file(databaseURL.path)), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTableColumnDefinitions())
            app.migrations.add(CreateRecordPresentations())
            app.migrations.add(CreateRecordBodies())
            app.migrations.add(CreateTrashEntries())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateSchemaMigrationAudits())
            app.migrations.add(CreateNotionImportReferences())
            app.migrations.add(CreateTableDropFixture())
            try await app.autoMigrate()
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            try await AuthenticationAccount(id: "account-b").save(on: app.db)
            try await Hub(id: "hub-b", accountID: "account-b").save(on: app.db)
            try await NotionImportReference(hubID: "hub-a", notionPageID: "source-a", tableName: "DropFixture", recordID: "__table__").save(on: app.db)
            try await NotionImportReference(hubID: "hub-a", notionPageID: "page-one", tableName: "DropFixture", recordID: "one").save(on: app.db)
            try await NotionImportReference(hubID: "hub-b", notionPageID: "page-other", tableName: "OtherTable", recordID: "other").save(on: app.db)
            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await sql.raw("INSERT INTO DropFixture (ID, HubID, Name) VALUES ('one', 'hub-a', 'One'), ('two', 'hub-a', 'Two')").run()
            try await sql.raw("INSERT INTO RollbackFixture (ID, HubID, Name) VALUES ('rollback-one', 'hub-a', 'Rollback')").run()
            try await sql.raw("""
                INSERT INTO "TableViews" ("ViewID", "HubID", "TableName", "Name", "ViewType", "IsDefault", "SortOrder", "ConfigurationVersion")
                VALUES ('ROLLBACK-VIEW', 'hub-a', 'RollbackFixture', 'Table', 'Table', 0, 0, 1)
                """).run()
            try await sql.raw("""
                INSERT INTO "ViewColumnConfigurations" ("ViewColumnID", "ViewID", "ColumnName", "IsVisible", "SortOrder")
                VALUES ('ROLLBACK-COLUMN', 'ROLLBACK-VIEW', 'Name', 1, 0)
                """).run()
            try await sql.raw("""
                INSERT INTO "TablePropertyDefinitions" ("DefinitionID", "HubID", "TableName", "Name", "Kind")
                VALUES ('ROLLBACK-PROPERTY', 'hub-a', 'RollbackFixture', 'Link', 'Relation')
                """).run()
            try await sql.raw("""
                CREATE TRIGGER "reject_rollback_property_delete"
                BEFORE DELETE ON "TablePropertyDefinitions"
                WHEN OLD."TableName" = 'RollbackFixture'
                BEGIN SELECT RAISE(ABORT, 'test rollback'); END
                """).run()
            let body = RecordBody(hubID: "hub-a", tableName: "DropFixture", recordID: "one", markdown: "body")
            try await body.save(on: app.db)
            let otherBody = RecordBody(hubID: "hub-b", tableName: "OtherTable", recordID: "other", markdown: "keep")
            try await otherBody.save(on: app.db)
            let path = root.appendingPathComponent("uploads/keep.txt")
            try FileManager.default.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data("retained file".utf8).write(to: path)
            let metadata = FileMetadata(id: "FILE-1", relativePath: path.path, fileName: "keep.txt", fileKind: "text", mimeType: "text/plain")
            metadata.hubID = "hub-a"
            metadata.ownerType = "DropFixture"
            metadata.ownerID = "one"
            try await metadata.save(on: app.db)
            let sharedPathMetadata = FileMetadata(id: "FILE-2", relativePath: path.path, fileName: "keep.txt", fileKind: "text", mimeType: "text/plain")
            sharedPathMetadata.hubID = "hub-a"
            sharedPathMetadata.ownerType = "DropFixture"
            sharedPathMetadata.ownerID = "two"
            try await sharedPathMetadata.save(on: app.db)

            let service = TableDropWorkflowService(backupConfiguration: LiveDatabaseBackupConfiguration(sourceURL: databaseURL, destinationDirectory: backupDirectory))
            let rollbackPreview = try await service.preview(tableName: "RollbackFixture", hubID: "hub-a", using: app.db)
            do {
                _ = try await service.confirm(
                    tableName: "RollbackFixture", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: rollbackPreview.confirmationToken, typedTableName: "RollbackFixture"),
                    using: app.db
                )
                XCTFail("A metadata failure midway through deletion must roll the transaction back.")
            } catch let error as TableDropWorkflowError {
                guard case .dropFailed = error else { return XCTFail("Unexpected error: \(error)") }
            }
            let rollbackTable = try await sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='RollbackFixture'").first()
            let rollbackViewCount = try await sql.raw("SELECT COUNT(*) AS n FROM TableViews WHERE TableName = 'RollbackFixture'").first()?.decode(column: "n", as: Int.self)
            let rollbackViewColumnCount = try await sql.raw("SELECT COUNT(*) AS n FROM ViewColumnConfigurations WHERE ViewID = 'ROLLBACK-VIEW'").first()?.decode(column: "n", as: Int.self)
            let rollbackPropertyCount = try await sql.raw("SELECT COUNT(*) AS n FROM TablePropertyDefinitions WHERE TableName = 'RollbackFixture'").first()?.decode(column: "n", as: Int.self)
            XCTAssertNotNil(rollbackTable)
            XCTAssertEqual(rollbackViewCount, 1)
            XCTAssertEqual(rollbackViewColumnCount, 1)
            XCTAssertEqual(rollbackPropertyCount, 1)

            let preview = try await service.preview(tableName: "DropFixture", hubID: "hub-a", using: app.db)
            XCTAssertEqual(preview.metadata.recordBodies, 1)
            XCTAssertEqual(preview.metadata.notionImportReferences, 2)
            XCTAssertEqual(preview.filesThatWouldBecomeUnreferenced.map(\.relativePath), [path.path, path.path])
            let result = try await service.confirm(
                tableName: "DropFixture", hubID: "hub-a",
                request: TableDropConfirmationRequest(confirmationToken: preview.confirmationToken, typedTableName: "DropFixture"),
                using: app.db
            )
            XCTAssertEqual(result.status, "dropped-and-verified")
            XCTAssertGreaterThan(result.backupSizeBytes, 0)
            XCTAssertTrue(FileManager.default.fileExists(atPath: backupDirectory.appendingPathComponent(result.backupFileName).path))
            XCTAssertTrue(FileManager.default.fileExists(atPath: path.path), "Table deletion must not delete file contents.")
            let remainingTable = try await sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='DropFixture'").first()
            let otherHubBodies = try await RecordBody.query(on: app.db).filter(\.$hubID == "hub-b").count()
            let audits = try await SchemaMigrationAudit.query(on: app.db).all()
            XCTAssertNil(remainingTable)
            XCTAssertEqual(otherHubBodies, 1)
            let droppedImportReferences = try await NotionImportReference.query(on: app.db).filter(\.$tableName == "DropFixture").count()
            let otherHubImportReferences = try await NotionImportReference.query(on: app.db).filter(\.$hubID == "hub-b").count()
            XCTAssertEqual(droppedImportReferences, 0, "Dropping a table must forget its Notion import mappings so a re-import does not reuse it.")
            XCTAssertEqual(otherHubImportReferences, 1)
            XCTAssertEqual(audits.count, 2)
            XCTAssertTrue(audits.contains { $0.migrationName.hasPrefix("drop-table:DropFixture:") && $0.result == "succeeded" && $0.backupFileName == result.backupFileName })
            XCTAssertTrue(audits.contains { $0.migrationName.hasPrefix("drop-table:RollbackFixture:") && $0.result == "failed" })
            do {
                _ = try await service.confirm(
                    tableName: "DropFixture", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: preview.confirmationToken, typedTableName: "DropFixture"),
                    using: app.db
                )
                XCTFail("A successful confirmation token must not be reusable.")
            } catch let error as TableDropWorkflowError {
                guard case .expiredOrUnknownToken = error else { return XCTFail("Unexpected error: \(error)") }
            }
        }
    }

    func testBuiltInTablesAndExpiredOrMismatchedApprovalsCannotBeConfirmed() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateSchemaPageFixtures())
            try await app.autoMigrate()
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            try await AuthenticationAccount(id: "account-b").save(on: app.db)
            try await Hub(id: "hub-b", accountID: "account-b").save(on: app.db)
            let service = TableDropWorkflowService(backupConfiguration: nil)
            let sql = try XCTUnwrap(app.db as? SQLDatabase)
            try await sql.raw("CREATE TABLE DropForeignReference (ID TEXT PRIMARY KEY, TargetID TEXT REFERENCES SchemaPageFixture(ID))").run()
            try await sql.raw("""
                INSERT INTO "TablePropertyDefinitions"
                    ("DefinitionID", "HubID", "TableName", "Name", "Kind", "TargetTableName")
                VALUES ('REL-1', 'hub-a', 'IntegerSchemaPageFixture', 'Garden reference', 'Relation', 'SchemaPageFixture')
                """).run()
            let protected = try await service.preview(tableName: "Hubs", hubID: "hub-a", using: app.db)
            XCTAssertFalse(protected.blockingReferences.isEmpty)
            XCTAssertTrue(protected.blockingReferences.contains { $0.kind == "eligibility" })
            do {
                _ = try await service.confirm(
                    tableName: "Hubs", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: protected.confirmationToken, typedTableName: "Hubs"),
                    using: app.db
                )
                XCTFail("Protected built-in tables must not be confirmed.")
            } catch let error as TableDropWorkflowError {
                guard case .blocked = error else { return XCTFail("Unexpected error: \(error)") }
            }

            let referenced = try await service.preview(tableName: "SchemaPageFixture", hubID: "hub-a", using: app.db)
            XCTAssertTrue(referenced.blockingReferences.contains { $0.kind == "property-definition" })
            XCTAssertTrue(referenced.blockingReferences.contains { $0.kind == "foreign-key" })
            do {
                _ = try await service.confirm(
                    tableName: "SchemaPageFixture", hubID: "hub-b",
                    request: TableDropConfirmationRequest(confirmationToken: referenced.confirmationToken, typedTableName: "SchemaPageFixture"),
                    using: app.db
                )
                XCTFail("A Hub-scoped preview token must not authorize another Hub.")
            } catch let error as TableDropWorkflowError {
                guard case .previewChanged = error else { return XCTFail("Unexpected error: \(error)") }
            }
            let referencedConfirmation = try await service.preview(tableName: "SchemaPageFixture", hubID: "hub-a", using: app.db)
            do {
                _ = try await service.confirm(
                    tableName: "SchemaPageFixture", hubID: "hub-a",
                    request: TableDropConfirmationRequest(confirmationToken: referencedConfirmation.confirmationToken, typedTableName: "SchemaPageFixture"),
                    using: app.db
                )
                XCTFail("Tables with relation references must not be confirmed.")
            } catch let error as TableDropWorkflowError {
                guard case .blocked = error else { return XCTFail("Unexpected error: \(error)") }
            }

            let now = Date()
            let preview = try await service.preview(tableName: "SchemaPageFixture", hubID: "hub-a", using: app.db, now: now)
            do {
                _ = try await service.confirm(tableName: "SchemaPageFixture", hubID: "hub-a", request: TableDropConfirmationRequest(confirmationToken: preview.confirmationToken, typedTableName: "OtherName"), using: app.db, now: now)
                XCTFail("Typed name must match exactly.")
            } catch let error as TableDropWorkflowError {
                guard case .typedNameMismatch = error else { return XCTFail("Unexpected error: \(error)") }
            }
            do {
                _ = try await service.confirm(tableName: "SchemaPageFixture", hubID: "hub-a", request: TableDropConfirmationRequest(confirmationToken: preview.confirmationToken, typedTableName: "SchemaPageFixture"), using: app.db, now: now.addingTimeInterval(301))
                XCTFail("Expired approval must be rejected.")
            } catch let error as TableDropWorkflowError {
                guard case .expiredOrUnknownToken = error else { return XCTFail("Unexpected error: \(error)") }
            }
        }
    }

    func testRegisteredMigrationTablesAreAllProtectedFromTableDrop() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            LocalDatabaseProfile.gemLifeDevelopment.registerMigrations(on: app)
            try await app.autoMigrate()
        }) { app in
            let schema = try await LiveSchemaService(database: app.db).inspect()
            let migrationTables = Set(schema.tables.map(\.name)).subtracting(["fluent_migrations"])
            let missingFromDenyList = migrationTables.subtracting(HubOwnedCustomTablePolicy.migrationOwnedTables)
            XCTAssertTrue(missingFromDenyList.isEmpty, "Migration tables missing from deny list: \(missingFromDenyList.sorted())")
            XCTAssertTrue(migrationTables.allSatisfy { name in
                guard let table = schema.tables.first(where: { $0.name == name }) else { return false }
                return !HubOwnedCustomTablePolicy.isDropEligible(table)
            })
        }
    }

    func testEveryModelWithTableNameIsInTheCentralMetadataInventory() throws {
        let repositoryRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let modelsDirectory = repositoryRoot.appendingPathComponent("Sources/Models")
        let enumerator = try XCTUnwrap(FileManager.default.enumerator(at: modelsDirectory, includingPropertiesForKeys: nil))
        let schemaPattern = try NSRegularExpression(pattern: #"static let schema = \"([^\"]+)\""#)
        var modelSchemas: Set<String> = []
        for case let fileURL as URL in enumerator where fileURL.pathExtension == "swift" {
            let source = try String(contentsOf: fileURL, encoding: .utf8)
            guard source.contains(#"@Field(key: "TableName")"#) || source.contains(#"@OptionalField(key: "TableName")"#) else { continue }
            let range = NSRange(source.startIndex..<source.endIndex, in: source)
            if let match = schemaPattern.firstMatch(in: source, range: range),
               let schemaRange = Range(match.range(at: 1), in: source) {
                modelSchemas.insert(String(source[schemaRange]))
            }
        }
        XCTAssertEqual(modelSchemas, TableDropWorkflowService.tableNameMetadataTables)
    }

    func testDropRoutesRequireAnAuthenticatedHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerLiveMigrationRoutes(app, backupConfiguration: nil)
        }) { app in
            try await app.test(.POST, "live-schema/tables/DropFixture/drop-preview") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.POST, "live-schema/tables/DropFixture/drop", beforeRequest: { request in
                try request.content.encode(TableDropConfirmationRequest(confirmationToken: "token", typedTableName: "DropFixture"))
            }) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }
}
