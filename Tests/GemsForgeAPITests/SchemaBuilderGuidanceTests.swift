import XCTest
@testable import GemsForgeAPI

final class SchemaBuilderGuidanceTests: XCTestCase {
    func testGuidanceListsTheTypesUsedByTheValidator() {
        let guidance = SchemaBuilderGuidanceService().guidance()

        XCTAssertEqual(guidance.version, "1")
        XCTAssertEqual(Set(guidance.supportedTypes.map(\.value)), Set(SQLiteColumnType.allCases))
        XCTAssertTrue(guidance.supportedTypes.allSatisfy { !$0.description.isEmpty })
    }

    func testGuidanceExplainsSafetyRules() {
        let keys = Set(SchemaBuilderGuidanceService().guidance().rules.map(\.key))

        XCTAssertTrue(keys.isSuperset(of: [
            "table-name", "column-name", "primary-key", "defaults",
            "files", "preview-first"
        ]))
    }
}
