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
        XCTAssertEqual(NotionImportValueMapper.propertyType("formula"), .init(storage: .text, requiresReview: true))
        XCTAssertEqual(NotionImportValueMapper.propertyType("people"), .init(storage: .dropped, requiresReview: false))
        XCTAssertEqual(NotionImportValueMapper.propertyType("file"), .init(storage: .unsupported, requiresReview: true))
    }

    func testMarkdownRendererPreservesSupportedBlocksAndReportsUnsupportedOnes() {
        let blocks: [[String: Any]] = [
            ["type": "heading_1", "heading_1": ["rich_text": [["plain_text": "Journal"]]]],
            ["type": "paragraph", "paragraph": ["rich_text": [["plain_text": "Entry"]]]],
            ["type": "to_do", "to_do": ["checked": true, "rich_text": [["plain_text": "Done"]]]],
            ["type": "synced_block", "synced_block": [:]],
        ]
        let result = NotionImportValueMapper.markdown(blocks: blocks)
        XCTAssertEqual(result.markdown, "# Journal\n\nEntry\n\n- [x] Done")
        XCTAssertEqual(result.unmappedTypes, ["synced_block"])
    }
}
