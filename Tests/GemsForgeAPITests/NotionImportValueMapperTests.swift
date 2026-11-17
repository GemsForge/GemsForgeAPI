import XCTest
import Fluent
import FluentSQLiteDriver
import VaporTesting

@testable import GemsForgeAPI

final class NotionImportValueMapperTests: XCTestCase {
    func testWriteErrorDiagnosticIncludesTypeMessageAndColumnsWithoutValues() {
        struct SampleError: Error, CustomStringConvertible { var description: String { "constraint failed: UNIQUE" } }
        let diagnostic = NotionImportWriter.writeErrorDiagnostic(SampleError(), involvedColumns: ["CategoryID", "Category"])
        XCTAssertTrue(diagnostic.contains("SampleError"))
        XCTAssertTrue(diagnostic.contains("constraint failed: UNIQUE"))
        XCTAssertTrue(diagnostic.contains("Category,CategoryID"))
    }

    func testBudgetCategoryPropertiesMatchNormalizedNotionNames() throws {
        let category: NotionJSONValue = .object(["type": .string("select"), "select": .object(["name": .string("Housing")])])
        let subcategory: NotionJSONValue = .object(["type": .string("title"), "title": .array([.object(["plain_text": .string("Rent")])])])
        let properties = ["Parent Category": category, "Subcategory Name": subcategory]
        let object: [String: NotionJSONValue] = ["properties": .object(properties)]

        XCTAssertEqual(NotionImportWriter.budgetTarget(for: object), ExpenseSubcategory.schema)
        XCTAssertEqual(NotionImportWriter.budgetCategoryProperty(in: properties), category)
    }

    func testStandardTargetsFillRequiredDisplayColumnsAndEnumDefaults() throws {
        func schema(_ name: String, _ columns: [String]) -> LiveSchemaTableResponse {
            LiveSchemaTableResponse(name: name, columns: columns.enumerated().map { index, name in
                LiveSchemaColumnResponse(name: name, dataType: index == 0 ? "TEXT" : "TEXT", nullable: false, primaryKey: index == 0, defaultValue: nil)
            }, foreignKeys: [], indexes: [])
        }
        func row(_ title: String, properties: [String: NotionJSONValue] = [:]) -> [String: NotionJSONValue] {
            ["id": .string("row"), "title": .array([.object(["plain_text": .string(title)])]),
             "properties": .object(properties)]
        }
        let cases: [(String, [String], String, String?)] = [
            ("Transactions", ["TransactionID", "Item", "CategoryID"], "Receipt item", "Item"),
            ("BudgetCategories", ["CategoryID", "Category"], "Housing", "Category"),
            ("BudgetSubcategories", ["SubcategoryID", "CategoryID", "Subcategory"], "Rent", "Subcategory"),
            ("Education", ["EducationID", "EducationType", "InstitutionName"], "North College", "InstitutionName"),
            ("Employment", ["EmploymentID", "EmployerName", "PositionTitle", "EmploymentStatus"], "Forge Studio", "EmployerName"),
            ("Services", ["ServiceID", "Service"], "Water Utility", "Service"),
        ]
        for (table, columns, title, displayColumn) in cases {
            var requiredColumns = columns
            if table == "Transactions" { requiredColumns += ["Quantity", "FirstReceiptItem"] }
            if table == "Employment" { requiredColumns += ["EmployerType", "EmploymentType"] }
            if table == "Education" { requiredColumns += ["Status"] }
            let targetSchema = schema(table, requiredColumns)
            var values = NotionImportWriter.mappedValues(row(title), schema: targetSchema)
            if table == "Transactions" || table == "BudgetSubcategories" { values["CategoryID"] = .integer(1) }
            XCTAssertEqual(values[displayColumn!], ImportScalar.text(title), table)
            XCTAssertNoThrow(try NotionImportWriter.validateRequired(values, schema: targetSchema), table)
            if table == "Education" { XCTAssertEqual(values["EducationType"], ImportScalar.text("Education")) }
            if table == "Employment" { XCTAssertEqual(values["EmploymentStatus"], ImportScalar.text("Imported")) }
        }
    }

    func testNotionNamesNormalizeToValidDistinctIdentifiers() throws {
        let properties: NotionJSONValue = .object([
            "10. What helps you stay consistent?": .object(["type": .string("rich_text")]),
            "Café": .object(["type": .string("rich_text")]),
            "☕": .object(["type": .string("rich_text")]),
            "": .object(["type": .string("rich_text")]),
            "id": .object(["type": .string("rich_text")]),
            "Title": .object(["type": .string("rich_text")]),
            "Name": .object(["type": .string("rich_text")]),
            "name": .object(["type": .string("rich_text")]),
        ])
        let columns = try NotionImportWriter.customColumns(from: properties)
        let names = columns.map(\.name)
        XCTAssertTrue(names.contains("Field10WhatHelpsYouStayConsistent"))
        XCTAssertTrue(names.contains("Cafe"))
        XCTAssertTrue(names.contains("Field"))
        XCTAssertTrue(names.contains("Field2")) // empty and emoji-only names
        XCTAssertTrue(names.contains("Name"))
        XCTAssertTrue(names.contains("Name2"))
        XCTAssertFalse(names.contains { ["ID", "HubID", "Title"].contains($0) })
        XCTAssertEqual(Set(names.map { $0.lowercased() }).count, names.count)
        XCTAssertTrue(names.allSatisfy { (try? TableBuilderContractService().validate(TableBuilderRequest(
            tableName: "SafeTable", columns: [TableBuilderColumnRequest(name: $0, dataType: .text, nullable: true, defaultValue: nil, primaryKey: false, unique: false)]
        ))) != nil })
        XCTAssertEqual(NotionImportExecutionService.customTableName("2026"), "Table2026")
        XCTAssertEqual(NotionImportExecutionService.customTableName("☕"), "Untitled")
    }

    func testPreviewAndExecutionAllocateSameNamesAndHonorExclusions() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateNotionImportReferences())
            try await app.autoMigrate()
        }) { app in
            try await AuthenticationAccount(id: "account-a").save(on: app.db)
            try await Hub(id: "hub-a", accountID: "account-a").save(on: app.db)
            try await app.db.schema("Domains").id().create()
            try await app.db.schema("Addresses").id().create()
            let sources: [NotionJSONValue] = [
                .object(["id": .string("b"), "title": .array([.object(["plain_text": .string("Same Title")])])]),
                .object(["id": .string("a"), "title": .array([.object(["plain_text": .string("Same Title")])])]),
                .object(["id": .string("c"), "title": .array([.object(["plain_text": .string("Domains")])])]),
                .object(["id": .string("d"), "title": .array([.object(["plain_text": .string("Addresses")])])]),
                .object(["id": .string("e"), "title": .array([.object(["plain_text": .string("  ")])])]),
            ]
            let snapshot = NotionImportSnapshot(pages: [], dataSources: sources, rowsByDataSourceID: [
                "a": [.object(["id": .string("row-a"), "parent": .object(["type": .string("data_source_id")])])],
                "b": [.object(["id": .string("row-b"), "parent": .object(["type": .string("data_source_id")])])],
                "x": [.object(["id": .string("excluded-row")])],
            ])
            let api = try NotionAPIClient(client: app.client, token: "test-token")
            let previewService = NotionImportPreviewService(api: api, database: app.db, hubID: "hub-a")
            let preview = try await previewService.response(for: snapshot, confirmationToken: "token", expiresAt: Date())
            let first = try await NotionImportExecutionService.allocateTargets(for: snapshot, database: app.db, hubID: "hub-a")
            XCTAssertEqual(first["a"], "SameTitle")
            XCTAssertEqual(first["b"], "SameTitle2")
            XCTAssertEqual(first["c"], "Domains2")
            XCTAssertEqual(first["d"], "Addresses2")
            XCTAssertEqual(first["e"], "Untitled")
            for source in sources {
                let id = source.objectValue?["id"]?.stringValue ?? ""
                XCTAssertEqual(preview.resources.first { $0.notionID == id }?.target, "New table: \(first[id]!)")
            }
            try await NotionImportReference(hubID: "hub-a", notionPageID: "a", tableName: "SavedName", recordID: "__table__").save(on: app.db)
            let second = try await NotionImportExecutionService.allocateTargets(for: snapshot, database: app.db, hubID: "hub-a")
            XCTAssertEqual(second["a"], "SavedName")
            let excluding = try await NotionImportExecutionService.allocateTargets(for: snapshot, database: app.db, hubID: "hub-a", excluding: ["b"])
            XCTAssertNil(excluding["b"])
        }
    }
    func testCommitRequestDefaultsExcludedIDsAndDecodesProvidedIDs() throws {
        let decoder = JSONDecoder()
        let omitted = try decoder.decode(NotionImportCommitRequest.self, from: Data(
            #"{"confirmationToken":"token","confirmImport":false}"#.utf8
        ))
        let provided = try decoder.decode(NotionImportCommitRequest.self, from: Data(
            #"{"confirmationToken":"token","confirmImport":true,"excludedNotionIDs":["a","b"]}"#.utf8
        ))

        XCTAssertEqual(omitted.excludedNotionIDs, [])
        XCTAssertEqual(provided.excludedNotionIDs, ["a", "b"])
    }

    func testAccountNumberKeepsOnlyLastFourDigits() {
        XCTAssertEqual(NotionImportValueMapper.accountNumberLastFour("1234 5678 9012"), "9012")
        XCTAssertEqual(NotionImportValueMapper.accountNumberLastFour("****-0042"), "0042")
        XCTAssertNil(NotionImportValueMapper.accountNumberLastFour("no account digits"))
    }

    func testAccountLikeNamesMatchSensitiveFieldsButNotDescriptions() {
        for name in ["Account Number", "Acct #", "Acct#", "Account#", "Card#", "Card", "CardNumber", "Routing No", "IBAN", "Bank Num"] {
            XCTAssertTrue(NotionImportValueMapper.isAccountLike(name), name)
        }
        for name in ["Account Name", "Account Type", "Account Status", "Card Type", "Bank Name", "Account Holder",
                     "Account Notes", "Bank Annotation", "Card Nominee", "Acct Holder"] {
            XCTAssertFalse(NotionImportValueMapper.isAccountLike(name), name)
        }
    }

    func testAccountLikeValuesKeepOnlyFourDigitsAndPreserveDigitlessValues() {
        XCTAssertEqual(NotionImportValueMapper.protectAccountValue("4111 2222 3333 4444"), "4444")
        XCTAssertEqual(NotionImportValueMapper.protectAccountValue("Acct #123456789"), "6789")
        XCTAssertEqual(NotionImportValueMapper.protectAccountValue(String(Int64(123456))), "3456")
        XCTAssertEqual(NotionImportValueMapper.protectAccountValue(String(Int64(987654321))), "4321")
        XCTAssertEqual(NotionImportValueMapper.protectAccountValue("pending"), "pending")
    }

    func testAccountLikeNumericScalarsKeepCorrectLastFourDigits() {
        XCTAssertEqual(NotionImportValueMapper.protectedAccountScalar(.number(123456)), .text("3456"))
        XCTAssertEqual(NotionImportValueMapper.protectedAccountScalar(.integer(987654321)), .text("4321"))
        XCTAssertEqual(NotionImportValueMapper.protectedAccountScalar(.number(1e20)), .text("0000"))
        // Notion number fields cannot carry exact 16-digit values; text values are exact.
        XCTAssertEqual(NotionImportValueMapper.protectedAccountScalar(.number(4_111_222_233_334_444)), .text("4444"))
    }

    func testDueDateMapsOrdinalAndCalendarDateLabels() {
        XCTAssertEqual(NotionImportValueMapper.dueDate("15th"), .init(day: 15, occurrence: "monthly"))
        XCTAssertEqual(NotionImportValueMapper.dueDate("21st"), .init(day: 21, occurrence: "monthly"))
        XCTAssertEqual(NotionImportValueMapper.dueDate("January 18th"), .init(day: 18, occurrence: "january"))
        XCTAssertEqual(NotionImportValueMapper.dueDate("Thursday"), .init(day: 0, occurrence: "thursday"))
    }

    func testDueDateRejectsUnsupportedOrInvalidValuesForReview() {
        XCTAssertNil(NotionImportValueMapper.dueDate("32nd"))
        XCTAssertNil(NotionImportValueMapper.dueDate("11st"))
        XCTAssertNil(NotionImportValueMapper.dueDate("13rd"))
        XCTAssertNil(NotionImportValueMapper.dueDate("first business day"))
        XCTAssertNil(NotionImportValueMapper.dueDate("February 31st"))
        XCTAssertNil(NotionImportValueMapper.dueDate("April 31st"))
        XCTAssertNil(NotionImportValueMapper.dueDate(" "))
    }

    func testPropertyTypesIdentifyStorageAndReviewRequirements() {
        XCTAssertEqual(NotionImportValueMapper.propertyType("multi_select"), .init(storage: .multiSelect, requiresReview: false))
        XCTAssertEqual(NotionImportValueMapper.propertyType("relation"), .init(storage: .relation, requiresReview: false))
        XCTAssertEqual(NotionImportValueMapper.propertyType("rollup"), .init(storage: .lookup, requiresReview: true))
        XCTAssertEqual(NotionImportValueMapper.propertyType("formula"), .init(storage: .formulaText, requiresReview: true))
        XCTAssertEqual(NotionImportValueMapper.propertyType("checkbox"), .init(storage: .checkbox, requiresReview: true))
        XCTAssertEqual(NotionImportValueMapper.propertyType("people"), .init(storage: .dropped, requiresReview: false))
        XCTAssertEqual(NotionImportValueMapper.propertyType("file"), .init(storage: .unsupported, requiresReview: true))
    }

    func testPreviewFlagsMultipleRelationsAndRollupCalculations() {
        let definitions: NotionJSONValue = .object([
            "Project": .object(["type": .string("relation"), "relation": .object(["data_source_id": .string("projects")])]),
            "Total": .object(["type": .string("rollup"), "rollup": .object(["function": .string("sum")])]),
        ])
        let row: NotionJSONValue = .object(["properties": .object([
            "Project": .object(["relation": .array([
                .object(["id": .string("a")]), .object(["id": .string("b")]),
            ])]),
        ])])
        let properties = NotionImportPreviewService.properties(
            from: definitions, rows: [row], targetSourceIDs: ["projects"]
        )

        XCTAssertTrue(properties.first { $0.name == "Project" }?.requiresReview == true)
        XCTAssertTrue(properties.first { $0.name == "Total" }?.requiresReview == true)
        XCTAssertTrue(properties.first { $0.name == "Total" }?.proposedStorage.contains("rollup calculation") == true)
    }

    func testPreviewRecognizesBuiltInDataSourceNames() {
        XCTAssertEqual(NotionImportPreviewService.target(for: "Employment Database", object: "data_source"), "Employment")
        XCTAssertEqual(NotionImportPreviewService.target(for: "Education DB", object: "data_source"), "Education")
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Affiliation Database", object: "data_source"),
            "Review required"
        )
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Vehicle Database", object: "data_source"),
            "Review required"
        )
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Planner in Proverb", object: "data_source"),
            "Review required"
        )
    }

    func testTargetMatchingNormalizesTitleWhitespace() {
        XCTAssertEqual(NotionImportPreviewService.target(for: "  Employment\n Database ", object: "data_source"), "Employment")
    }

    func testPreviewTitleCollapsesWhitespaceAndFallsBackWhenEmpty() {
        let title: [String: NotionJSONValue] = ["title": .array([
            .object(["plain_text": .string("  Collections\n  and   Notes  ")]),
        ])]
        let empty: [String: NotionJSONValue] = ["title": .array([
            .object(["plain_text": .string(" \n\t ")]),
        ])]

        XCTAssertEqual(NotionImportPreviewService.title(from: title), "Collections and Notes")
        XCTAssertEqual(NotionImportPreviewService.title(from: empty), "Untitled")
    }

    func testPreviewClassifiesDataSourcePagesAsRows() {
        for parentType in ["data_source_id", "database_id", "data_source", "database"] {
            let page: [String: NotionJSONValue] = ["parent": .object(["type": .string(parentType)])]
            XCTAssertTrue(NotionImportPreviewService.isDatabaseRow(page))
            XCTAssertEqual(NotionImportPreviewService.target(for: "Recipe", object: "page", notionObject: page), "Database row")
        }
        let nestedPage: [String: NotionJSONValue] = ["parent": .object([
            "type": .string("page_id"), "page_id": .string("parent-page"),
        ])]
        XCTAssertFalse(NotionImportPreviewService.isDatabaseRow(nestedPage))
        XCTAssertEqual(NotionImportPreviewService.target(for: "Recipe", object: "page", notionObject: nestedPage), "ForgeKeeper")
        let workspacePage: [String: NotionJSONValue] = ["parent": .object(["type": .string("workspace")])]
        XCTAssertEqual(NotionImportPreviewService.target(for: "Faith", object: "page", notionObject: workspacePage), "ForgeKeeper")
    }

    func testRowsWhoseDataSourceIsUnavailableAreCountedByParent() {
        func row(_ parent: [String: NotionJSONValue]) -> NotionJSONValue { .object(["parent": .object(parent)]) }
        let sources: [NotionJSONValue] = [.object([
            "id": .string("source-a"),
            "parent": .object(["type": .string("database_id"), "database_id": .string("db-a")]),
        ])]
        let pages: [NotionJSONValue] = [
            row(["type": .string("data_source_id"), "data_source_id": .string("source-a"), "database_id": .string("db-a")]),
            row(["type": .string("database_id"), "database_id": .string("db-a")]),
            row(["type": .string("data_source_id"), "data_source_id": .string("hidden"), "database_id": .string("db-hidden")]),
            row(["type": .string("data_source_id"), "data_source_id": .string("hidden")]),
            row(["type": .string("page_id"), "page_id": .string("some-page")]),
        ]
        XCTAssertEqual(
            NotionImportPreviewService.unavailableParentRowCounts(pages: pages, dataSources: sources),
            ["hidden": 2]
        )
    }

    func testMarkdownRendererPreservesSupportedBlocksAndReportsUnsupportedOnes() {
        let blocks: [[String: Any]] = [
            ["type": "heading_1", "heading_1": ["rich_text": [["plain_text": "Journal"]]]],
            ["type": "paragraph", "paragraph": [
                "rich_text": [["plain_text": "Entry"]],
                "children": [["type": "bulleted_list_item", "bulleted_list_item": ["rich_text": [["plain_text": "Nested note"]]]]],
            ]],
            ["type": "to_do", "to_do": ["checked": true, "rich_text": [["plain_text": "Done"]]]],
            ["type": "synced_block", "synced_block": [:]],
        ]
        let result = NotionImportValueMapper.markdown(blocks: blocks)
        XCTAssertEqual(result.markdown, "# Journal\n\nEntry\n\n  - Nested note\n\n- [x] Done")
        XCTAssertEqual(result.unmappedTypes, ["synced_block"])
    }
}
