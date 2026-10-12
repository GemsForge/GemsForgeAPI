import XCTest
@testable import GemsForgeAPI

final class TableBuilderContractTests: XCTestCase {
    private let service = TableBuilderContractService()

    func testValidatesAndNormalizesAHomeInventoryDefinition() throws {
        let definition = try service.validate(TableBuilderRequest(
            tableName: " HomeInventory ",
            columns: [
                TableBuilderColumnRequest(name: "Name", dataType: .text, nullable: false, defaultValue: nil, primaryKey: false, unique: false),
                TableBuilderColumnRequest(name: "PurchasePrice", dataType: .real, nullable: true, defaultValue: "0.00", primaryKey: false, unique: false)
            ]
        ))

        XCTAssertEqual(definition.tableName, "HomeInventory")
        XCTAssertEqual(definition.columns.count, 3)
        XCTAssertEqual(definition.columns[0].name, "ID")
        XCTAssertEqual(definition.columns[0].dataType, .text)
        XCTAssertTrue(definition.columns[0].primaryKey)
        XCTAssertTrue(definition.columns[0].unique)
    }

    func testAcceptsTheSupportedSQLiteTypesCaseInsensitively() throws {
        let json = #"{"tableName":"Example","columns":[{"name":"Name","dataType":"integer","nullable":false,"defaultValue":null,"primaryKey":false,"unique":false}]}"#.data(using: .utf8)!
        let request = try JSONDecoder().decode(TableBuilderRequest.self, from: json)

        XCTAssertEqual(request.columns[0].dataType, .integer)
    }

    func testRejectsUnsafeIdentifiersDuplicateColumnsAndReservedID() {
        let requests = [
            TableBuilderRequest(tableName: "bad-name", columns: [column("Name", .text)]),
            TableBuilderRequest(tableName: "Example", columns: [column("Name", .text), column("name", .text)]),
            TableBuilderRequest(tableName: "Example", columns: [column("ID", .text)]),
            TableBuilderRequest(tableName: "Example", columns: [column("Name", .text, primaryKey: true)])
        ]

        for request in requests {
            XCTAssertThrowsError(try service.validate(request))
        }
    }

    func testRejectsUnsafeDefaultsAndClientManagedPrimaryKeys() {
        let unsafeDefault = TableBuilderRequest(tableName: "Example", columns: [
            TableBuilderColumnRequest(name: "Name", dataType: .text, nullable: false, defaultValue: "(SELECT secret)", primaryKey: false, unique: false)
        ])

        XCTAssertThrowsError(try service.validate(unsafeDefault))
    }

    private func column(_ name: String, _ dataType: SQLiteColumnType, primaryKey: Bool = false) -> TableBuilderColumnRequest {
        TableBuilderColumnRequest(name: name, dataType: dataType, nullable: !primaryKey, defaultValue: nil, primaryKey: primaryKey, unique: false)
    }
}
