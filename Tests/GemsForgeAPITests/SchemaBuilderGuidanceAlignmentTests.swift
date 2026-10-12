import XCTest
@testable import GemsForgeAPI

final class SchemaBuilderGuidanceAlignmentTests: XCTestCase {
    private let validator = TableBuilderContractService()

    func testEveryGuidedSQLiteTypeCanBeValidated() throws {
        let guidance = SchemaBuilderGuidanceService().guidance()

        XCTAssertEqual(Set(guidance.supportedTypes.map(\.value)), Set(SQLiteColumnType.allCases))
        for type in SQLiteColumnType.allCases {
            let definition = try validator.validate(TableBuilderRequest(
                tableName: "Example",
                columns: [
                    TableBuilderColumnRequest(name: "ID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: true, unique: false),
                    TableBuilderColumnRequest(name: "Value", dataType: type, nullable: true, defaultValue: nil, primaryKey: false, unique: false)
                ]
            ))

            XCTAssertEqual(definition.columns[1].dataType, type)
        }
    }

    func testGuidedUnsafeInputsAreRejectedByTheValidator() {
        let invalidRequests = [
            TableBuilderRequest(tableName: "bad-name", columns: validColumns()),
            TableBuilderRequest(tableName: "Example", columns: validColumns(duplicateName: "ID")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(defaultValue: "(SELECT 1)")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(missingPrimaryKey: true))
        ]

        for request in invalidRequests {
            XCTAssertThrowsError(try validator.validate(request))
        }
    }

    private func validColumns(
        duplicateName: String? = nil,
        defaultValue: String? = nil,
        missingPrimaryKey: Bool = false
    ) -> [TableBuilderColumnRequest] {
        [
            TableBuilderColumnRequest(name: missingPrimaryKey ? "Value" : "ID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: !missingPrimaryKey, unique: false),
            TableBuilderColumnRequest(name: duplicateName ?? "Value", dataType: .text, nullable: true, defaultValue: defaultValue, primaryKey: false, unique: false)
        ]
    }
}
