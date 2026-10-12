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
                    TableBuilderColumnRequest(name: "Value", dataType: type, nullable: true, defaultValue: nil, primaryKey: false, unique: false)
                ]
            ))

            XCTAssertEqual(definition.columns[0].name, "ID")
            XCTAssertTrue(definition.columns[0].primaryKey)
            XCTAssertEqual(definition.columns[1].dataType, type)
        }
    }

    func testGuidedUnsafeInputsAreRejectedByTheValidator() {
        let invalidRequests = [
            TableBuilderRequest(tableName: "bad-name", columns: validColumns()),
            TableBuilderRequest(tableName: "Example", columns: validColumns(duplicateName: "Value")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(defaultValue: "(SELECT 1)")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(reservedName: "ID")),
            TableBuilderRequest(tableName: "Example", columns: [])
        ]

        for request in invalidRequests {
            XCTAssertThrowsError(try validator.validate(request))
        }
    }

    private func validColumns(
        duplicateName: String? = nil,
        defaultValue: String? = nil,
        reservedName: String? = nil
    ) -> [TableBuilderColumnRequest] {
        let firstName = reservedName ?? duplicateName ?? "Name"
        return [
            TableBuilderColumnRequest(name: firstName, dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
            TableBuilderColumnRequest(name: duplicateName ?? "Value", dataType: .text, nullable: true, defaultValue: defaultValue, primaryKey: false, unique: false)
        ]
    }
}
