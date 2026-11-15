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
        XCTAssertEqual(NotionImportValueMapper.dueDate("January 18th"), .init(day: 18, occurrence: "january"))
        XCTAssertEqual(NotionImportValueMapper.dueDate("Thursday"), .init(day: 0, occurrence: "thursday"))
    }

    func testDueDateRejectsUnsupportedOrInvalidValuesForReview() {
        XCTAssertNil(NotionImportValueMapper.dueDate("32nd"))
        XCTAssertNil(NotionImportValueMapper.dueDate("first business day"))
        XCTAssertNil(NotionImportValueMapper.dueDate(" "))
    }
}
