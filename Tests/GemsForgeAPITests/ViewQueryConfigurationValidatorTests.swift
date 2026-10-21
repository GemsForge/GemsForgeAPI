import XCTest
@testable import GemsForgeAPI

final class ViewQueryConfigurationValidatorTests: XCTestCase {
    func testValidatesFilterTreeAndIndependentNodesAgainstLiveTypes() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let nodes = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "price", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "Amount", comparisonOperator: .greaterThan, valueType: .decimal, value: "20"),
            ViewQueryConfiguration(id: "sort", viewID: "view-1", nodeType: .sort, columnName: "Name", direction: .ascending),
            ViewQueryConfiguration(id: "group", viewID: "view-1", nodeType: .recordGroup, columnName: "Name")
        ]

        let result = try validator.validateAgainstSchema(nodes, schema: schema, viewID: "view-1", tableName: "Records")

        XCTAssertEqual(result.filterRootID, "root")
        XCTAssertEqual(result.independentNodeIDs, ["sort", "group"])
        XCTAssertEqual(result.nodes.first { $0.id == "price" }?.operands, [.decimal("20")])
    }

    func testRejectsCyclesEmptyGroupsAndDependentIndependentNodes() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)

        let cycle = [
            ViewQueryConfiguration(id: "a", viewID: "view-1", parentQueryID: "b", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "b", viewID: "view-1", parentQueryID: "a", nodeType: .group, booleanOperator: .and)
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(cycle, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .cycle = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected a cycle error, got \(error)")
            }
        }

        let invalid = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "sort", viewID: "view-1", parentQueryID: "root", nodeType: .sort, columnName: "Name", direction: .ascending)
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(invalid, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .independentNodeHasParent = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected an independent-node error, got \(error)")
            }
        }
    }

    func testReportsMissingReferencesWithoutRepairingMetadata() throws {
        let validator = SQLiteSchemaReferenceValidator(schema: schema)
        XCTAssertThrowsError(try validator.validateColumn(
            named: "RenamedAmount",
            inTable: "Records",
            context: TableViewReferenceContext(viewID: "view-1", viewName: "Amounts")
        )) { error in
            guard case .missingColumn(let table, let column, let context, let policy) = error as? SQLiteSchemaReferenceValidationError else {
                return XCTFail("Expected a missing-column drift report, got \(error)")
            }
            XCTAssertEqual(table, "Records")
            XCTAssertEqual(column, "RenamedAmount")
            XCTAssertEqual(context?.viewName, "Amounts")
            XCTAssertEqual(policy, .preserveAndReport)
            XCTAssertTrue((error as? SQLiteSchemaReferenceValidationError)?.isSchemaDrift == true)
        }
    }

    private var schema: LiveSchemaResponse {
        LiveSchemaResponse(
            databaseName: "test",
            tableCount: 1,
            tables: [LiveSchemaTableResponse(
                name: "Records",
                columns: [
                    LiveSchemaColumnResponse(name: "Amount", dataType: "REAL", nullable: true, primaryKey: false, defaultValue: nil),
                    LiveSchemaColumnResponse(name: "Name", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: nil)
                ],
                foreignKeys: [],
                indexes: []
            )]
        )
    }
}
