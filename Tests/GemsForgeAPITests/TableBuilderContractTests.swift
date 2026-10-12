import XCTest
@testable import GemsForgeAPI

final class TableBuilderContractTests: XCTestCase {
    private let service = TableBuilderContractService()

    func testValidatesAndNormalizesAHomeInventoryDefinition() throws {
        let definition = try service.validate(TableBuilderRequest(
            tableName: " HomeInventory ",
            columns: [
                TableBuilderColumnRequest(name: "InventoryID", dataType: .text, nullable: false, defaultValue: nil, primaryKey: true, unique: false),
                TableBuilderColumnRequest(name: "Name", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
                TableBuilderColumnRequest(name: "PurchasePrice", dataType: .real, nullable: true, defaultValue: "0.00", primaryKey: false, unique: false)
            ]
        ))

        XCTAssertEqual(definition.tableName, "HomeInventory")
        XCTAssertEqual(definition.columns.count, 3)
        XCTAssertEqual(definition.columns[0].dataType, .text)
        XCTAssertTrue(definition.columns[0].unique)
    }

    func testAcceptsTheSupportedSQLiteTypesCaseInsensitively() throws {
        let json = #"{"tableName":"Example","columns":[{"name":"ID","dataType":"integer","nullable":false,"defaultValue":null,"primaryKey":true,"unique":false}]}"#.data(using: .utf8)!
        let request = try JSONDecoder().decode(TableBuilderRequest.self, from: json)

        XCTAssertEqual(request.columns[0].dataType, .integer)
    }

    func testRejectsUnsafeIdentifiersDuplicateColumnsAndMissingPrimaryKey() {
        let requests = [
            TableBuilderRequest(tableName: "bad-name", columns: [column("ID", .text, primaryKey: true)]),
            TableBuilderRequest(tableName: "Example", columns: [column("Name", .text, primaryKey: true), column("name", .text)]),
            TableBuilderRequest(tableName: "Example", columns: [column("Name", .text)])
        ]

        XCTAssertThrowsError(try requests.forEach { _ = try service.validate($0) })
    }

    func testRejectsUnsafeDefaultsAndInvalidPrimaryKeys() {
        let unsafeDefault = TableBuilderRequest(tableName: "Example", columns: [
            TableBuilderColumnRequest(name: "ID", dataType: .text, nullable: false, defaultValue: "(SELECT secret)", primaryKey: true, unique: false)
        ])
        let nullablePrimaryKey = TableBuilderRequest(tableName: "Example", columns: [
            TableBuilderColumnRequest(name: "ID", dataType: .text, nullable: true, defaultValue: nil, primaryKey: true, unique: false)
        ])

        XCTAssertThrowsError(try service.validate(unsafeDefault))
        XCTAssertThrowsError(try service.validate(nullablePrimaryKey))
    }

    private func column(_ name: String, _ dataType: SQLiteColumnType, primaryKey: Bool = false) -> TableBuilderColumnRequest {
        TableBuilderColumnRequest(name: name, dataType: dataType, nullable: !primaryKey, defaultValue: nil, primaryKey: primaryKey, unique: false)
    }
}
