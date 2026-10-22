import XCTest
@testable import GemsForgeAPI

final class ViewColumnConfigurationValidatorTests: XCTestCase {
    func testValidatesExactColumnReferencesAndPreservesSavedMetadata() throws {
        let configuration = ViewColumnConfiguration(viewID: "view-1", columnName: "Amount")
        let result = try ViewColumnConfigurationValidator(schema: schema).validateAgainstSchema(
            [configuration], schema: schema, viewID: "view-1", tableName: "Records", viewName: "Amounts"
        )

        XCTAssertEqual(result.first?.columnName, "Amount")
        XCTAssertEqual(result.first?.viewID, "view-1")
    }

    func testReportsMissingOrRenamedTableAndColumnAsStaleWithoutRepair() throws {
        let renamedColumn = ViewColumnConfiguration(viewID: "view-1", columnName: "RenamedAmount")
        XCTAssertThrowsError(try ViewColumnConfigurationValidator(schema: schema).validateAgainstSchema(
            [renamedColumn], schema: schema, viewID: "view-1", tableName: "Records", viewName: "Amounts"
        )) { error in
            guard case .missingColumn(let table, let column, let context, let policy) = error as? SQLiteSchemaReferenceValidationError else {
                return XCTFail("Expected stale column reference, got \(error)")
            }
            XCTAssertEqual(table, "Records")
            XCTAssertEqual(column, "RenamedAmount")
            XCTAssertEqual(context?.viewName, "Amounts")
            XCTAssertEqual(policy, .preserveAndReport)
            XCTAssertTrue((error as? SQLiteSchemaReferenceValidationError)?.isSchemaDrift == true)
        }
        XCTAssertEqual(renamedColumn.columnName, "RenamedAmount")

        XCTAssertThrowsError(try ViewColumnConfigurationValidator(schema: schema).validateAgainstSchema(
            [], schema: schema, viewID: "view-1", tableName: "RenamedRecords", viewName: "Amounts"
        )) { error in
            guard case .missingTable(let table, _, _) = error as? SQLiteSchemaReferenceValidationError else {
                return XCTFail("Expected stale table reference, got \(error)")
            }
            XCTAssertEqual(table, "RenamedRecords")
        }
    }

    func testMatchingIsExactAndDoesNotUseSimilarIdentifiers() throws {
        let configuration = ViewColumnConfiguration(viewID: "view-1", columnName: "amount")
        XCTAssertThrowsError(try ViewColumnConfigurationValidator(schema: schema).validateAgainstSchema(
            [configuration], schema: schema, viewID: "view-1", tableName: "Records"
        )) { error in
            guard case .missingColumn(_, let column, _, _) = error as? SQLiteSchemaReferenceValidationError else {
                return XCTFail("Expected exact-match failure, got \(error)")
            }
            XCTAssertEqual(column, "amount")
        }
    }

    private var schema: LiveSchemaResponse {
        LiveSchemaResponse(
            databaseName: "test", tableCount: 1,
            tables: [LiveSchemaTableResponse(
                name: "Records",
                columns: [LiveSchemaColumnResponse(name: "Amount", dataType: "REAL", nullable: true, primaryKey: false, defaultValue: nil)],
                foreignKeys: [], indexes: []
            )]
        )
    }
}
