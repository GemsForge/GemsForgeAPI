import XCTest

@testable import GemsForgeAPI

final class NotionImportValueMapperTests: XCTestCase {
    func testAccountNumberKeepsOnlyLastFourDigits() {
        XCTAssertEqual(NotionImportValueMapper.accountNumberLastFour("1234 5678 9012"), "9012")
        XCTAssertEqual(NotionImportValueMapper.accountNumberLastFour("****-0042"), "0042")
        XCTAssertNil(NotionImportValueMapper.accountNumberLastFour("no account digits"))
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
        XCTAssertEqual(NotionImportValueMapper.propertyType("formula"), .init(storage: .text, requiresReview: true))
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

    func testPreviewRecognizesWorkspaceDataSourceNames() {
        XCTAssertEqual(NotionImportPreviewService.target(for: "Employment Database", object: "data_source"), "Employment")
        XCTAssertEqual(NotionImportPreviewService.target(for: "Education DB", object: "data_source"), "Education")
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Affiliation Database", object: "data_source"),
            "Custom table: Affiliation Database"
        )
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Vehicle Database", object: "data_source"),
            "Custom table: Vehicle Database"
        )
        XCTAssertEqual(
            NotionImportPreviewService.target(for: "Planner in Proverb", object: "data_source"),
            "Custom table: Planner in Proverb"
        )
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
