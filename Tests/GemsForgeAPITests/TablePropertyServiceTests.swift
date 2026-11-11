import Fluent
import SQLKit
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

struct CreateTablePropertyFixtures: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("BudgetCategories")
            .field("CategoryID", .int, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("Category", .string, .required)
            .create()
        try await database.schema("BudgetSubcategories")
            .field("SubcategoryID", .int, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("CategoryID", .int, .required)
            .field("Subcategory", .string, .required)
            .foreignKey(["CategoryID"], references: "BudgetCategories", ["CategoryID"])
            .create()
        try await database.schema("Transactions")
            .field("TransactionID", .string, .identifier(auto: false))
            .field("HubID", .string, .required)
            .field("CategoryID", .int, .required)
            .field("SubcategoryID", .int)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("Transactions").delete()
        try await database.schema("BudgetSubcategories").delete()
        try await database.schema("BudgetCategories").delete()
    }
}

final class TablePropertyServiceTests: XCTestCase {
    func testPropertyEndpointsRequireAnAuthenticatedHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            registerTablePropertyRoutes(app)
        }) { app in
            try await app.test(.GET, "schema-builder/tables/Transactions/properties") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.PUT, "schema-builder/tables/Transactions/properties") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await app.test(.GET, "schema-builder/tables/Transactions/records/TRX-1/properties") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testRelationsLookupsAndDependentOptionsAreHubScoped() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTablePropertyFixtures())
            try await app.autoMigrate()
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a'), ('account-b', 'subject-b')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A'), ('hub-b', 'account-b', 'B')").run()
            try await TableView(hubID: "hub-a", tableName: "BudgetCategories", name: "Budget Categories", viewType: .table, isDefault: true).save(on: app.db)
            try await TableView(hubID: "hub-a", tableName: "BudgetSubcategories", name: "Budget Subcategories", viewType: .table, isDefault: true).save(on: app.db)
            try await sql.raw("""
                INSERT INTO BudgetCategories (CategoryID, HubID, Category) VALUES
                  (1, 'hub-a', 'Food'), (2, 'hub-a', 'Housing'), (99, 'hub-b', 'Other Hub')
                """).run()
            try await sql.raw("""
                INSERT INTO BudgetSubcategories (SubcategoryID, HubID, CategoryID, Subcategory) VALUES
                  (10, 'hub-a', 1, 'Groceries'), (11, 'hub-a', 1, 'Dining'), (20, 'hub-a', 2, 'Rent')
                """).run()
            try await sql.raw("INSERT INTO Transactions (TransactionID, HubID, CategoryID, SubcategoryID) VALUES ('txn-a', 'hub-a', 1, 10), ('txn-b', 'hub-a', 99, NULL), ('txn-inconsistent', 'hub-a', 1, 20)").run()
        }) { app in
            let service = TablePropertyService(database: app.db, hubID: "hub-a")
            let definitions = [
                TablePropertyDefinitionRequest(id: "category", name: "Category", kind: .relation,
                    sourceColumnName: "CategoryID", targetTableName: "BudgetCategories",
                    targetKeyColumnName: "CategoryID", targetDisplayColumnName: "Category",
                    relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                    targetFilterColumnName: nil),
                TablePropertyDefinitionRequest(id: "subcategory", name: "Subcategory", kind: .relation,
                    sourceColumnName: "SubcategoryID", targetTableName: "BudgetSubcategories",
                    targetKeyColumnName: "SubcategoryID", targetDisplayColumnName: "Subcategory",
                    relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: "category",
                    targetFilterColumnName: "CategoryID"),
                TablePropertyDefinitionRequest(id: "category-name", name: "Category name", kind: .lookup,
                    sourceColumnName: nil, targetTableName: nil, targetKeyColumnName: nil,
                    targetDisplayColumnName: nil, relationDefinitionID: "category", targetColumnName: "Category",
                    filterByDefinitionID: nil, targetFilterColumnName: nil),
            ]
            let saved = try await service.replace(tableName: "Transactions", definitions: definitions)
            XCTAssertEqual(saved.map(\.kind), [.relation, .relation, .lookup])
            let readDefinitions = try await service.definitions(tableName: "Transactions")
            XCTAssertEqual(readDefinitions.map(\.name), ["Category", "Subcategory", "Category name"])

            let values = try await service.values(tableName: "Transactions", recordID: "txn-a")
            XCTAssertEqual(values.first(where: { $0.definitionID == "category" })?.displayValue, "Food")
            XCTAssertEqual(values.first(where: { $0.definitionID == "subcategory" })?.displayValue, "Groceries")
            XCTAssertEqual(values.first(where: { $0.definitionID == "category-name" })?.value, "Food")
            let inconsistentValues = try await service.values(tableName: "Transactions", recordID: "txn-inconsistent")
            XCTAssertNil(inconsistentValues.first(where: { $0.definitionID == "subcategory" })?.displayValue)

            let options = try await service.options(tableName: "Transactions", definitionID: "subcategory", recordID: "txn-a", search: nil, limit: 50)
            XCTAssertEqual(options.map(\.name), ["Dining", "Groceries"])
            let noCategory = try await service.options(tableName: "Transactions", definitionID: "subcategory", recordID: "txn-b", search: nil, limit: 50)
            XCTAssertTrue(noCategory.isEmpty)

            let otherValues = try await service.values(tableName: "Transactions", recordID: "txn-b")
            let crossHubRelation = try XCTUnwrap(otherValues.first(where: { $0.definitionID == "category" }))
            XCTAssertEqual(crossHubRelation.recordID, "99")
            XCTAssertNil(crossHubRelation.displayValue)

            let otherHubDefinitions = try await TablePropertyService(database: app.db, hubID: "hub-b")
                .definitions(tableName: "Transactions")
            XCTAssertTrue(otherHubDefinitions.isEmpty, "Dedicated collection properties remain isolated by Hub.")
        }
    }

    func testInvalidReplacementPreservesPreviouslySavedDefinitions() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTablePropertyFixtures())
            try await app.autoMigrate()
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A')").run()
            try await TableView(hubID: "hub-a", tableName: "BudgetCategories", name: "Budget Categories", viewType: .table, isDefault: true).save(on: app.db)
            try await TableView(hubID: "hub-a", tableName: "BudgetSubcategories", name: "Budget Subcategories", viewType: .table, isDefault: true).save(on: app.db)
            try await TableView(hubID: "hub-a", tableName: "TablePropertyDefinitions", name: "Property Definitions", viewType: .table, isDefault: true).save(on: app.db)
        }) { app in
            let service = TablePropertyService(database: app.db, hubID: "hub-a")
            let valid = TablePropertyDefinitionRequest(id: "category", name: "Category", kind: .relation,
                sourceColumnName: "CategoryID", targetTableName: "BudgetCategories",
                targetKeyColumnName: "CategoryID", targetDisplayColumnName: "Category",
                relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                targetFilterColumnName: nil)
            _ = try await service.replace(tableName: "Transactions", definitions: [valid])
            let invalid = TablePropertyDefinitionRequest(id: "bad", name: "Broken", kind: .relation,
                sourceColumnName: "MissingID", targetTableName: "BudgetCategories",
                targetKeyColumnName: "CategoryID", targetDisplayColumnName: "Category",
                relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                targetFilterColumnName: nil)
            do {
                _ = try await service.replace(tableName: "Transactions", definitions: [invalid])
                XCTFail("Invalid source columns must be rejected.")
            } catch let error as TablePropertyServiceError {
                guard case .invalidDefinition = error else { return XCTFail("Unexpected error: \(error)") }
            }
            let preserved = try await service.definitions(tableName: "Transactions")
            XCTAssertEqual(preserved.map(\.id), ["category"])

            let protectedTarget = TablePropertyDefinitionRequest(id: "protected-target", name: "Protected metadata", kind: .relation,
                sourceColumnName: "TransactionID", targetTableName: "TablePropertyDefinitions",
                targetKeyColumnName: "DefinitionID", targetDisplayColumnName: "Name",
                relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                targetFilterColumnName: nil)
            do {
                _ = try await service.replace(tableName: "Transactions", definitions: [protectedTarget])
                XCTFail("Relations must not target protected metadata tables, even if a Hub view is registered.")
            } catch let error as TablePropertyServiceError {
                guard case .invalidDefinition = error else { return XCTFail("Unexpected error: \(error)") }
            }
            let stillPreserved = try await service.definitions(tableName: "Transactions")
            XCTAssertEqual(stillPreserved.map(\.id), ["category"])

            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO Transactions (TransactionID, HubID, CategoryID) VALUES ('txn-protected', 'hub-a', 1)").run()
            try await TablePropertyDefinition(
                hubID: "hub-a", tableName: "Transactions", definition: protectedTarget,
                id: "stored-protected-target", sortOrder: 1
            ).save(on: app.db)
            do {
                _ = try await service.options(tableName: "Transactions", definitionID: "stored-protected-target", recordID: nil, search: nil, limit: 50)
                XCTFail("Options must not query protected relation targets from a stored invalid definition.")
            } catch let error as TablePropertyServiceError {
                guard case .tableUnavailable = error else { return XCTFail("Unexpected error: \(error)") }
            }
            do {
                _ = try await service.values(tableName: "Transactions", recordID: "txn-protected")
                XCTFail("Lookup values must not read protected relation targets from a stored invalid definition.")
            } catch let error as TablePropertyServiceError {
                guard case .tableUnavailable = error else { return XCTFail("Unexpected error: \(error)") }
            }

            let unrelatedFilterRelation = TablePropertyDefinitionRequest(id: "unrelated", name: "Unrelated", kind: .relation,
                sourceColumnName: "CategoryID", targetTableName: "BudgetSubcategories",
                targetKeyColumnName: "SubcategoryID", targetDisplayColumnName: "Subcategory",
                relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                targetFilterColumnName: nil)
            let incorrectlyFiltered = TablePropertyDefinitionRequest(id: "filtered", name: "Filtered", kind: .relation,
                sourceColumnName: "SubcategoryID", targetTableName: "BudgetSubcategories",
                targetKeyColumnName: "SubcategoryID", targetDisplayColumnName: "Subcategory",
                relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: "unrelated",
                targetFilterColumnName: "CategoryID")
            do {
                _ = try await service.replace(tableName: "Transactions", definitions: [unrelatedFilterRelation, incorrectlyFiltered])
                XCTFail("A filter column must reference the selected relation's target key.")
            } catch let error as TablePropertyServiceError {
                guard case .invalidDefinition = error else { return XCTFail("Unexpected error: \(error)") }
            }
        }
    }

    func testOptionsRejectsFilterColumnRemovedAfterDefinitionWasSaved() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateTableViews())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateTablePropertyDefinitions())
            app.migrations.add(CreateTablePropertyFixtures())
            try await app.autoMigrate()
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("INSERT INTO AppleAccounts (AccountID, AppleSubject) VALUES ('account-a', 'subject-a')").run()
            try await sql.raw("INSERT INTO Hubs (HubID, AccountID, Name) VALUES ('hub-a', 'account-a', 'A')").run()
            try await TableView(hubID: "hub-a", tableName: "BudgetCategories", name: "Budget Categories", viewType: .table, isDefault: true).save(on: app.db)
            try await TableView(hubID: "hub-a", tableName: "BudgetSubcategories", name: "Budget Subcategories", viewType: .table, isDefault: true).save(on: app.db)
            try await sql.raw("INSERT INTO BudgetCategories (CategoryID, HubID, Category) VALUES (1, 'hub-a', 'Food')").run()
            try await sql.raw("INSERT INTO Transactions (TransactionID, HubID, CategoryID, SubcategoryID) VALUES ('txn-a', 'hub-a', 1, NULL)").run()
        }) { app in
            let service = TablePropertyService(database: app.db, hubID: "hub-a")
            let definitions = [
                TablePropertyDefinitionRequest(id: "category", name: "Category", kind: .relation,
                    sourceColumnName: "CategoryID", targetTableName: "BudgetCategories",
                    targetKeyColumnName: "CategoryID", targetDisplayColumnName: "Category",
                    relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: nil,
                    targetFilterColumnName: nil),
                TablePropertyDefinitionRequest(id: "subcategory", name: "Subcategory", kind: .relation,
                    sourceColumnName: "SubcategoryID", targetTableName: "BudgetSubcategories",
                    targetKeyColumnName: "SubcategoryID", targetDisplayColumnName: "Subcategory",
                    relationDefinitionID: nil, targetColumnName: nil, filterByDefinitionID: "category",
                    targetFilterColumnName: "CategoryID"),
            ]
            _ = try await service.replace(tableName: "Transactions", definitions: definitions)
            guard let sql = app.db as? SQLDatabase else { return XCTFail("Expected SQLite SQL database.") }
            try await sql.raw("ALTER TABLE BudgetSubcategories RENAME TO BudgetSubcategoriesBeforeDrift").run()
            try await sql.raw("CREATE TABLE BudgetSubcategories (SubcategoryID INTEGER PRIMARY KEY, HubID TEXT NOT NULL, Subcategory TEXT NOT NULL)").run()
            try await sql.raw("DROP TABLE BudgetSubcategoriesBeforeDrift").run()
            do {
                _ = try await service.options(tableName: "Transactions", definitionID: "subcategory", recordID: "txn-a", search: nil, limit: 50)
                XCTFail("A removed target filter column must produce a clear validation error.")
            } catch let error as TablePropertyServiceError {
                guard case .invalidDefinition = error else { return XCTFail("Unexpected error: \(error)") }
            }
        }
    }
}
