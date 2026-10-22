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

    /// The validated result is the canonical serialized tree order, and sibling
    /// positions are unique within each parent so clients cannot disagree.
    func testSerializesNestedTreeInSiblingOrderAndRejectsDuplicatePositions() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let nodes = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and, sortOrder: 0),
            ViewQueryConfiguration(id: "nested", viewID: "view-1", parentQueryID: "root", nodeType: .group, booleanOperator: .or, sortOrder: 2),
            ViewQueryConfiguration(id: "first", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "Name", comparisonOperator: .equals, valueType: .text, value: "A", sortOrder: 1),
            ViewQueryConfiguration(id: "second", viewID: "view-1", parentQueryID: "nested", nodeType: .condition, columnName: "Amount", comparisonOperator: .greaterThan, valueType: .decimal, value: "20", sortOrder: 0)
        ]

        let result = try validator.validateAgainstSchema(nodes, schema: schema, viewID: "view-1", tableName: "Records")
        XCTAssertEqual(result.nodes.map(\.id), ["root", "first", "nested", "second"])

        let duplicate = nodes + [
            ViewQueryConfiguration(id: "duplicate", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "Name", comparisonOperator: .equals, valueType: .text, value: "B", sortOrder: 1)
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(duplicate, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .duplicateSiblingSortOrder(parentID: "root", sortOrder: 1) = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected a duplicate sibling order error, got \(error)")
            }
        }
    }

    func testRejectsMissingCrossViewAndSelfParents() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let missing = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "child", viewID: "view-1", parentQueryID: "gone", nodeType: .condition, columnName: "Name", comparisonOperator: .equals, valueType: .text, value: "A")
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(missing, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .missingParent(nodeID: "child", parentID: "gone") = error as? ViewQueryConfigurationValidationError else { XCTFail("Expected missing parent, got \(error)"); return }
        }

        let crossView = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "child", viewID: "view-2", parentQueryID: "root", nodeType: .condition, columnName: "Name", comparisonOperator: .equals, valueType: .text, value: "A")
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(crossView, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .nodeBelongsToDifferentView(nodeID: "child", expected: "view-1", actual: "view-2") = error as? ViewQueryConfigurationValidationError else { XCTFail("Expected cross-view error, got \(error)"); return }
        }

        let selfParent = [ViewQueryConfiguration(id: "root", viewID: "view-1", parentQueryID: "root", nodeType: .group, booleanOperator: .and)]
        XCTAssertThrowsError(try validator.validateAgainstSchema(selfParent, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .selfParent(nodeID: "root") = error as? ViewQueryConfigurationValidationError else { XCTFail("Expected self-parent error, got \(error)"); return }
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

    /// Confirms query validation reports stale table and column identifiers with View context.
    func testQueryValidationReportsMissingReferencesWithViewContext() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let nodes = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "condition", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "RenamedAmount", comparisonOperator: .equals, valueType: .decimal, value: "20")
        ]
        let context = TableViewReferenceContext(viewID: "view-1", viewName: "Amounts")

        XCTAssertThrowsError(try validator.validateAgainstSchema(
            nodes, schema: schema, viewID: "view-1", tableName: "Records", context: context
        )) { error in
            guard case .schemaReference(.missingColumn(let table, let column, let referenceContext, let policy)) = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected a stale query-column report, got \(error)")
            }
            XCTAssertEqual(table, "Records")
            XCTAssertEqual(column, "RenamedAmount")
            XCTAssertEqual(referenceContext?.viewID, "view-1")
            XCTAssertEqual(referenceContext?.viewName, "Amounts")
            XCTAssertEqual(policy, .preserveAndReport)
        }

        XCTAssertThrowsError(try validator.validateAgainstSchema(
            nodes, schema: schema, viewID: "view-1", tableName: "RenamedRecords", context: context
        )) { error in
            guard case .schemaReference(.missingTable(let table, let referenceContext, let policy)) = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected a stale query-table report, got \(error)")
            }
            XCTAssertEqual(table, "RenamedRecords")
            XCTAssertEqual(referenceContext?.viewName, "Amounts")
            XCTAssertEqual(policy, .preserveAndReport)
        }
    }

    func testQueryValidationUsesExactColumnNamesAndPreservesRenamedIdentifiers() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let renamedNode = ViewQueryConfiguration(
            id: "condition", viewID: "view-1", nodeType: .condition,
            columnName: "amount", comparisonOperator: .equals,
            valueType: .decimal, value: "20"
        )
        let nodes = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            renamedNode
        ]

        XCTAssertThrowsError(try validator.validateAgainstSchema(
            nodes, schema: schema, viewID: "view-1", tableName: "Records"
        )) { error in
            guard case .schemaReference(.missingColumn(_, let column, _, let policy)) = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected an exact stale query-column report, got \(error)")
            }
            XCTAssertEqual(column, "amount")
            XCTAssertEqual(policy, .preserveAndReport)
        }
        XCTAssertEqual(renamedNode.columnName, "amount")
    }

    /// Confirms operators and persisted value types are checked against live SQLite column kinds.
    func testRejectsIncompatibleOperatorAndValueType() throws {
        let validator = ViewQueryConfigurationValidator(schema: schema)
        let textNumeric = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "condition", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "Name", comparisonOperator: .greaterThan, valueType: .text, value: "A")
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(textNumeric, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .incompatibleOperator = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected an incompatible-operator error, got \(error)")
            }
        }

        let numericText = [
            ViewQueryConfiguration(id: "root", viewID: "view-1", nodeType: .group, booleanOperator: .and),
            ViewQueryConfiguration(id: "condition", viewID: "view-1", parentQueryID: "root", nodeType: .condition, columnName: "Amount", comparisonOperator: .equals, valueType: .text, value: "20")
        ]
        XCTAssertThrowsError(try validator.validateAgainstSchema(numericText, schema: schema, viewID: "view-1", tableName: "Records")) { error in
            guard case .incompatibleValueType = error as? ViewQueryConfigurationValidationError else {
                return XCTFail("Expected an incompatible-value-type error, got \(error)")
            }
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
