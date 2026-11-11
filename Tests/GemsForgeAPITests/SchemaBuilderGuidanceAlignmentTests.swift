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
            XCTAssertEqual(definition.columns[1].name, "HubID")
            XCTAssertFalse(definition.columns[1].nullable)
            XCTAssertEqual(definition.columns[2].name, "Title")
            XCTAssertFalse(definition.columns[2].nullable)
            XCTAssertEqual(definition.columns[3].name, "Value")
            XCTAssertEqual(definition.columns[3].dataType, type)
        }
    }

    func testGuidedUnsafeInputsAreRejectedByTheValidator() {
        let invalidRequests = [
            TableBuilderRequest(tableName: "bad-name", columns: validColumns()),
            TableBuilderRequest(tableName: "Example", columns: validColumns(duplicateName: "Value")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(defaultValue: "(SELECT 1)")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(reservedName: "ID")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(reservedName: "HubID")),
            TableBuilderRequest(tableName: "Example", columns: validColumns(reservedName: "title"))
        ]

        for (index, request) in invalidRequests.enumerated() {
            XCTAssertThrowsError(try validator.validate(request), "invalid request \(index) was accepted")
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
