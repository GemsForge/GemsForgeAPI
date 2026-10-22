import Fluent
import Foundation

extension ViewQueryNodeType: Equatable {}
extension ViewQueryComparisonOperator: Equatable {}
extension ViewQueryValueType: Equatable {}
extension ViewQueryBooleanOperator: Equatable {}
extension ViewQuerySortDirection: Equatable {}

struct ViewQueryValidationNode: Sendable, Equatable {
    let id: String
    let viewID: String
    let parentQueryID: String?
    let nodeType: ViewQueryNodeType
    let columnName: String?
    let columnDataType: String?
    let comparisonOperator: ViewQueryComparisonOperator?
    let valueType: ViewQueryValueType?
    let operands: [ViewQueryValue]
    let booleanOperator: ViewQueryBooleanOperator?
    let direction: ViewQuerySortDirection?
    let sortOrder: Int
}
struct ViewQueryConfigurationValidationResult: Sendable, Equatable {
    let viewID: String
    let tableName: String
    let filterRootID: String
    let nodes: [ViewQueryValidationNode]

    var independentNodeIDs: [String] {
        nodes.compactMap { node in
            switch node.nodeType {
            case .sort, .recordGroup: return node.id
            case .group, .condition: return nil
            }
        }
    }
}
enum ViewQueryConfigurationValidationError: Error, CustomStringConvertible, Equatable, Sendable {
    case missingNodeID(index: Int)
    case duplicateNodeID(String)
    case nodeBelongsToDifferentView(nodeID: String, expected: String, actual: String)
    case invalidNodeType(nodeID: String, value: String)
    case invalidComparisonOperator(nodeID: String, value: String)
    case invalidValueType(nodeID: String, value: String)
    case invalidBooleanOperator(nodeID: String, value: String)
    case invalidDirection(nodeID: String, value: String)
    case invalidField(nodeID: String, field: String, reason: String)
    case missingParent(nodeID: String, parentID: String)
    case parentBelongsToDifferentView(parentID: String, expected: String, actual: String)
    case selfParent(nodeID: String)
    case cycle([String])
    case invalidFilterRootCount(actual: Int, nodeIDs: [String])
    case emptyGroup(nodeID: String)
    case illegalParentChild(parentID: String, parentType: ViewQueryNodeType, childID: String, childType: ViewQueryNodeType)
    case independentNodeHasParent(nodeID: String, nodeType: ViewQueryNodeType, parentID: String)
    case invalidSortOrder(nodeID: String, value: Int)
    case duplicateSiblingSortOrder(parentID: String?, sortOrder: Int)
    case invalidValue(nodeID: String, reason: String)
    case incompatibleOperator(nodeID: String, columnName: String, comparisonOperator: ViewQueryComparisonOperator, declaredType: String)
    case incompatibleValueType(nodeID: String, columnName: String, valueType: ViewQueryValueType, declaredType: String)
    case schemaReference(SQLiteSchemaReferenceValidationError)

    var description: String {
        switch self {
        case .missingNodeID(let index): return "Query node at index \(index) must have a persisted ID."
        case .duplicateNodeID(let id): return "Query node ID \"\(id)\" is duplicated; parent references must be unambiguous."
        case .nodeBelongsToDifferentView(let id, let expected, let actual): return "Query node \"\(id)\" belongs to View \"\(actual)\", not the validated View \"\(expected)\"."
        case .invalidNodeType(let id, let value): return "Query node \"\(id)\" has unsupported NodeType \"\(value)\"."
        case .invalidComparisonOperator(let id, let value): return "Condition node \"\(id)\" has unsupported comparison operator \"\(value)\"."
        case .invalidValueType(let id, let value): return "Condition node \"\(id)\" has unsupported value type \"\(value)\"."
        case .invalidBooleanOperator(let id, let value): return "Group node \"\(id)\" has unsupported BooleanOperator \"\(value)\"."
        case .invalidDirection(let id, let value): return "Sort node \"\(id)\" has unsupported Direction \"\(value)\"."
        case .invalidField(let id, let field, let reason): return "Query node \"\(id)\" has an invalid \(field): \(reason)."
        case .missingParent(let id, let parent): return "Query node \"\(id)\" references missing parent \"\(parent)\" in the same View."
        case .parentBelongsToDifferentView(let parent, let expected, let actual): return "Parent query node \"\(parent)\" belongs to View \"\(actual)\", not View \"\(expected)\"."
        case .selfParent(let id): return "Query node \"\(id)\" cannot be its own parent."
        case .cycle(let ids): return "Query configuration contains a parent cycle: \(ids.joined(separator: " -> "))."
        case .invalidFilterRootCount(let actual, let ids): return "A View query requires exactly one filter root; found \(actual) (\(ids.isEmpty ? "none" : ids.joined(separator: ", ")))."
        case .emptyGroup(let id): return "Filter Group \"\(id)\" must contain at least one Condition or Group."
        case .illegalParentChild(let parent, let parentType, let child, let childType): return "\(childType.rawValue) node \"\(child)\" cannot be a child of \(parentType.rawValue) node \"\(parent)\"."
        case .independentNodeHasParent(let id, let type, let parent): return "\(type.rawValue) node \"\(id)\" is independent and cannot have parent \"\(parent)\"."
        case .invalidSortOrder(let id, let value): return "Query node \"\(id)\" has invalid SortOrder \(value); SortOrder must be non-negative."
        case .duplicateSiblingSortOrder(let parentID, let sortOrder):
            let scope = parentID.map { "parent \($0)" } ?? "the View root"
            return "Query nodes under \(scope) cannot share SortOrder \(sortOrder)."
        case .invalidValue(let id, let reason): return "Condition node \"\(id)\" has invalid typed value: \(reason)."
        case .incompatibleOperator(let id, let column, let op, let type): return "Condition node \"\(id)\" cannot apply \(op.rawValue) to column \"\(column)\" declared as \"\(type)\"."
        case .incompatibleValueType(let id, let column, let valueType, let type): return "Condition node \"\(id)\" cannot compare column \"\(column)\" declared as \"\(type)\" with \(valueType.rawValue) values."
        case .schemaReference(let error): return error.description
        }
    }
}
/// Validates persisted query rows as a complete, server-owned tree. The
/// schema initializer is useful for tests and callers with a captured schema;
/// the database initializer performs a fresh LiveSchemaService inspection.
struct ViewQueryConfigurationValidator: Sendable {
    private enum Source: Sendable {
        case schema(LiveSchemaResponse)
        case database(Database)
    }

    private let source: Source
    private let driftPolicy: TableViewSchemaDriftPolicy

    init(schema: LiveSchemaResponse, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.source = .schema(schema)
        self.driftPolicy = driftPolicy
    }

    init(database: Database, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.source = .database(database)
        self.driftPolicy = driftPolicy
    }

    func validate(
        _ nodes: [ViewQueryConfiguration],
        viewID: String,
        tableName: String,
        context: TableViewReferenceContext? = nil
    ) async throws -> ViewQueryConfigurationValidationResult {
        let schema: LiveSchemaResponse
        switch source {
        case .schema(let schemaValue): schema = schemaValue
        case .database(let database): schema = try await LiveSchemaService(database: database).inspect()
        }
        return try validateAgainstSchema(nodes, schema: schema, viewID: viewID, tableName: tableName, context: context)
    }

    /// Validates the View's table and every persisted query column by exact
    /// logical identifier. A stale reference fails validation before query-tree
    /// translation; the persisted node is never rewritten or repaired.
    func validateAgainstSchema(
        _ nodes: [ViewQueryConfiguration],
        schema: LiveSchemaResponse,
        viewID: String,
        tableName: String,
        context: TableViewReferenceContext? = nil
    ) throws -> ViewQueryConfigurationValidationResult {
        let referenceContext = context ?? TableViewReferenceContext(viewID: viewID)
        let referenceValidator = SQLiteSchemaReferenceValidator(schema: schema, driftPolicy: driftPolicy)
        do {
            _ = try referenceValidator.validateTable(named: tableName, context: referenceContext)
        } catch let error as SQLiteSchemaReferenceValidationError {
            throw ViewQueryConfigurationValidationError.schemaReference(error)
        }

        var parsed: [ParsedNode] = []
        parsed.reserveCapacity(nodes.count)
        var ids = Set<String>()

        for (index, node) in nodes.enumerated() {
            guard let id = node.id, !id.isEmpty else {
                throw ViewQueryConfigurationValidationError.missingNodeID(index: index)
            }
            guard ids.insert(id).inserted else {
                throw ViewQueryConfigurationValidationError.duplicateNodeID(id)
            }
            guard node.viewID == viewID else {
                throw ViewQueryConfigurationValidationError.nodeBelongsToDifferentView(nodeID: id, expected: viewID, actual: node.viewID)
            }
            guard let nodeType = node.typedNodeType else {
                throw ViewQueryConfigurationValidationError.invalidNodeType(nodeID: id, value: node.nodeType)
            }
            guard node.sortOrder >= 0 else {
                throw ViewQueryConfigurationValidationError.invalidSortOrder(nodeID: id, value: node.sortOrder)
            }

            let comparisonOperator = try parseComparisonOperator(node, id: id)
            let valueType = try parseValueType(node, id: id)
            let booleanOperator = try parseBooleanOperator(node, id: id)
            let direction = try parseDirection(node, id: id)
            let column: LiveSchemaColumnResponse?
            do {
                if let columnName = node.columnName {
                    column = try referenceValidator.validateColumn(named: columnName, inTable: tableName, context: referenceContext)
                } else {
                    column = nil
                }
            } catch let error as SQLiteSchemaReferenceValidationError {
                throw ViewQueryConfigurationValidationError.schemaReference(error)
            }

            let operands = try validateFieldsAndDecodeValues(
                node,
                id: id,
                nodeType: nodeType,
                comparisonOperator: comparisonOperator,
                valueType: valueType,
                booleanOperator: booleanOperator,
                direction: direction,
                column: column
            )
            parsed.append(ParsedNode(
                id: id,
                viewID: node.viewID,
                parentQueryID: node.parentQueryID,
                nodeType: nodeType,
                columnName: node.columnName,
                columnDataType: column?.dataType,
                comparisonOperator: comparisonOperator,
                valueType: valueType,
                operands: operands,
                booleanOperator: booleanOperator,
                direction: direction,
                sortOrder: node.sortOrder
            ))
        }

        let byID = Dictionary(uniqueKeysWithValues: parsed.map { ($0.id, $0) })
        var children: [String: [ParsedNode]] = [:]
        var siblingSortOrders: [String?: Set<Int>] = [:]
        var filterRoots: [ParsedNode] = []

        for node in parsed {
            guard let parentID = node.parentQueryID else {
                if node.nodeType == .group || node.nodeType == .condition {
                    filterRoots.append(node)
                }
                continue
            }
            guard let parent = byID[parentID] else {
                throw ViewQueryConfigurationValidationError.missingParent(nodeID: node.id, parentID: parentID)
            }
            guard parent.viewID == node.viewID else {
                throw ViewQueryConfigurationValidationError.parentBelongsToDifferentView(parentID: parentID, expected: viewID, actual: parent.viewID)
            }
            if node.id == parentID {
                throw ViewQueryConfigurationValidationError.selfParent(nodeID: node.id)
            }
            if node.nodeType == .sort || node.nodeType == .recordGroup {
                throw ViewQueryConfigurationValidationError.independentNodeHasParent(nodeID: node.id, nodeType: node.nodeType, parentID: parentID)
            }
            guard parent.nodeType == .group,
                  node.nodeType == .group || node.nodeType == .condition else {
                throw ViewQueryConfigurationValidationError.illegalParentChild(
                    parentID: parent.id,
                    parentType: parent.nodeType,
                    childID: node.id,
                    childType: node.nodeType
                )
            }
            var orders = siblingSortOrders[parentID] ?? []
            guard orders.insert(node.sortOrder).inserted else {
                throw ViewQueryConfigurationValidationError.duplicateSiblingSortOrder(parentID: parentID, sortOrder: node.sortOrder)
            }
            siblingSortOrders[parentID] = orders
            children[parentID, default: []].append(node)
        }

        let rootFilterSortOrders = filterRoots.map(\.sortOrder)
        if let duplicate = duplicateValue(in: rootFilterSortOrders) {
            throw ViewQueryConfigurationValidationError.duplicateSiblingSortOrder(parentID: nil, sortOrder: duplicate)
        }

        try validateNoCycles(parsed)
        guard filterRoots.count == 1 else {
            throw ViewQueryConfigurationValidationError.invalidFilterRootCount(actual: filterRoots.count, nodeIDs: filterRoots.map(\.id))
        }
        for node in parsed where node.nodeType == .group {
            guard !(children[node.id] ?? []).isEmpty else {
                throw ViewQueryConfigurationValidationError.emptyGroup(nodeID: node.id)
            }
        }

        // Serialize in deterministic pre-order: each group's children are emitted
        // by SortOrder, while independent Sort and RecordGroup nodes follow the
        // filter tree in their own persisted order.
        let orderedNodes = serializedOrder(root: filterRoots[0], children: children)
            + parsed.filter { $0.nodeType == .sort || $0.nodeType == .recordGroup }
        let resultNodes = orderedNodes.map { node in
            ViewQueryValidationNode(
                id: node.id,
                viewID: node.viewID,
                parentQueryID: node.parentQueryID,
                nodeType: node.nodeType,
                columnName: node.columnName,
                columnDataType: node.columnDataType,
                comparisonOperator: node.comparisonOperator,
                valueType: node.valueType,
                operands: node.operands,
                booleanOperator: node.booleanOperator,
                direction: node.direction,
                sortOrder: node.sortOrder
            )
        }
        return ViewQueryConfigurationValidationResult(
            viewID: viewID,
            tableName: tableName,
            filterRootID: filterRoots[0].id,
            nodes: resultNodes
        )
    }

    private struct ParsedNode {
        let id: String
        let viewID: String
        let parentQueryID: String?
        let nodeType: ViewQueryNodeType
        let columnName: String?
        let columnDataType: String?
        let comparisonOperator: ViewQueryComparisonOperator?
        let valueType: ViewQueryValueType?
        let operands: [ViewQueryValue]
        let booleanOperator: ViewQueryBooleanOperator?
        let direction: ViewQuerySortDirection?
        let sortOrder: Int
    }

    private func parseComparisonOperator(_ node: ViewQueryConfiguration, id: String) throws -> ViewQueryComparisonOperator? {
        guard let raw = node.comparisonOperator else { return nil }
        guard let result = ViewQueryComparisonOperator(rawValue: raw) else {
            throw ViewQueryConfigurationValidationError.invalidComparisonOperator(nodeID: id, value: raw)
        }
        return result
    }

    private func parseValueType(_ node: ViewQueryConfiguration, id: String) throws -> ViewQueryValueType? {
        guard let raw = node.valueType else { return nil }
        guard let result = ViewQueryValueType(rawValue: raw) else {
            throw ViewQueryConfigurationValidationError.invalidValueType(nodeID: id, value: raw)
        }
        return result
    }

    private func parseBooleanOperator(_ node: ViewQueryConfiguration, id: String) throws -> ViewQueryBooleanOperator? {
        guard let raw = node.booleanOperator else { return nil }
        guard let result = ViewQueryBooleanOperator(rawValue: raw) else {
            throw ViewQueryConfigurationValidationError.invalidBooleanOperator(nodeID: id, value: raw)
        }
        return result
    }

    private func parseDirection(_ node: ViewQueryConfiguration, id: String) throws -> ViewQuerySortDirection? {
        guard let raw = node.direction else { return nil }
        guard let result = ViewQuerySortDirection(rawValue: raw) else {
            throw ViewQueryConfigurationValidationError.invalidDirection(nodeID: id, value: raw)
        }
        return result
    }

    private func validateFieldsAndDecodeValues(
        _ node: ViewQueryConfiguration,
        id: String,
        nodeType: ViewQueryNodeType,
        comparisonOperator: ViewQueryComparisonOperator?,
        valueType: ViewQueryValueType?,
        booleanOperator: ViewQueryBooleanOperator?,
        direction: ViewQuerySortDirection?,
        column: LiveSchemaColumnResponse?
    ) throws -> [ViewQueryValue] {
        switch nodeType {
        case .group:
            guard booleanOperator != nil else { throw invalidField(id, "BooleanOperator", "a Group requires AND or OR") }
            try requireNil(node.columnName, field: "ColumnName", id: id)
            try requireNil(comparisonOperator, field: "Operator", id: id)
            try requireNil(valueType, field: "ValueType", id: id)
            try requireNil(node.value, field: "Value", id: id)
            try requireNil(direction, field: "Direction", id: id)
            return []
        case .condition:
            guard let column else { throw invalidField(id, "ColumnName", "a Condition requires an exact live SQLite column reference") }
            guard let comparisonOperator else { throw invalidField(id, "Operator", "a Condition requires a comparison operator") }
            let operands = try decodeOperands(node, id: id, op: comparisonOperator, valueType: valueType)
            try requireNil(booleanOperator, field: "BooleanOperator", id: id)
            try requireNil(direction, field: "Direction", id: id)
            try validateCompatibility(id: id, column: column, op: comparisonOperator, valueType: valueType)
            return operands
        case .sort:
            guard column != nil else { throw invalidField(id, "ColumnName", "a Sort requires an exact live SQLite column reference") }
            guard direction != nil else { throw invalidField(id, "Direction", "a Sort requires Ascending or Descending") }
            try requireNil(comparisonOperator, field: "Operator", id: id)
            try requireNil(valueType, field: "ValueType", id: id)
            try requireNil(node.value, field: "Value", id: id)
            try requireNil(booleanOperator, field: "BooleanOperator", id: id)
            return []
        case .recordGroup:
            guard column != nil else { throw invalidField(id, "ColumnName", "a RecordGroup requires an exact live SQLite column reference") }
            try requireNil(comparisonOperator, field: "Operator", id: id)
            try requireNil(valueType, field: "ValueType", id: id)
            try requireNil(node.value, field: "Value", id: id)
            try requireNil(booleanOperator, field: "BooleanOperator", id: id)
            try requireNil(direction, field: "Direction", id: id)
            return []
        }
    }

    private func decodeOperands(
        _ node: ViewQueryConfiguration,
        id: String,
        op: ViewQueryComparisonOperator,
        valueType: ViewQueryValueType?
    ) throws -> [ViewQueryValue] {
        if op.operandCount == 0...0 {
            guard valueType == .null else { throw invalidValue(id, "IsNull and IsNotNull require ValueType=Null") }
            guard node.value == nil else { throw invalidValue(id, "IsNull and IsNotNull do not accept a Value") }
            return []
        }
        guard let valueType, valueType != .null else {
            throw invalidValue(id, "an operand value type other than Null is required")
        }
        guard let encoded = node.value else {
            throw invalidValue(id, "the operator requires \(op.operandCount.lowerBound == op.operandCount.upperBound ? "one" : "the configured") operand value(s)")
        }

        do {
            if op.operandCount.upperBound == 1 {
                let operand = try ViewQueryValueCodec.decode(encoded, as: valueType)
                guard try ViewQueryValueCodec.encode(operand) == encoded else {
                    throw invalidValue(id, "the scalar value is not in canonical form")
                }
                return [operand]
            }

            guard let data = encoded.data(using: .utf8) else {
                throw invalidValue(id, "the multi-operand value is not valid UTF-8 JSON")
            }
            let values = try JSONDecoder().decode([String].self, from: data)
            guard op.operandCount.contains(values.count) else {
                throw invalidValue(id, "the operator requires \(op.operandCount.lowerBound)-\(op.operandCount.upperBound) operands; received \(values.count)")
            }
            let operands = try values.map { try ViewQueryValueCodec.decode($0, as: valueType) }
            guard try ViewQueryValueCodec.encode(operands, for: op) == encoded else {
                throw invalidValue(id, "the multi-operand value is not in canonical form")
            }
            return operands
        } catch let error as ViewQueryConfigurationValidationError {
            throw error
        } catch {
            throw invalidValue(id, error.localizedDescription)
        }
    }

    private func validateCompatibility(
        id: String,
        column: LiveSchemaColumnResponse,
        op: ViewQueryComparisonOperator,
        valueType: ViewQueryValueType?
    ) throws {
        let kind = SQLiteLiveColumnKind(dataType: column.dataType)
        if !kind.supports(op: op) {
            throw ViewQueryConfigurationValidationError.incompatibleOperator(nodeID: id, columnName: column.name, comparisonOperator: op, declaredType: column.dataType)
        }
        if let valueType, !kind.supports(valueType: valueType, op: op) {
            throw ViewQueryConfigurationValidationError.incompatibleValueType(nodeID: id, columnName: column.name, valueType: valueType, declaredType: column.dataType)
        }
    }

    private func validateNoCycles(_ nodes: [ParsedNode]) throws {
        let byID = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
        var completed = Set<String>()
        for node in nodes where !completed.contains(node.id) {
            var path: [String] = []
            var active = Set<String>()
            var current: ParsedNode? = node
            while let currentNode = current {
                if active.contains(currentNode.id) {
                    let start = path.firstIndex(of: currentNode.id) ?? 0
                    throw ViewQueryConfigurationValidationError.cycle(Array(path[start...]) + [currentNode.id])
                }
                if completed.contains(currentNode.id) { break }
                active.insert(currentNode.id)
                path.append(currentNode.id)
                current = currentNode.parentQueryID.flatMap { byID[$0] }
            }
            completed.formUnion(path)
        }
    }

    private func serializedOrder(root: ParsedNode, children: [String: [ParsedNode]]) -> [ParsedNode] {
        [root] + (children[root.id] ?? [])
            .sorted { $0.sortOrder == $1.sortOrder ? $0.id < $1.id : $0.sortOrder < $1.sortOrder }
            .flatMap { child in
                child.nodeType == .group ? serializedOrder(root: child, children: children) : [child]
            }
    }

    private func duplicateValue(in values: [Int]) -> Int? {
        var seen = Set<Int>()
        return values.first { !seen.insert($0).inserted }
    }

    private func requireNil<T>(_ value: T?, field: String, id: String) throws {
        guard value == nil else { throw invalidField(id, field, "this field is not legal for the node type") }
    }

    private func invalidField(_ id: String, _ field: String, _ reason: String) -> ViewQueryConfigurationValidationError {
        .invalidField(nodeID: id, field: field, reason: reason)
    }

    private func invalidValue(_ id: String, _ reason: String) -> ViewQueryConfigurationValidationError {
        .invalidValue(nodeID: id, reason: reason)
    }
}

private enum SQLiteLiveColumnKind: Sendable, Equatable {
    case any
    case blob
    case integer
    case real
    case numeric
    case text
    case date
    case dateTime
    case boolean

    init(dataType: String) {
        let type = dataType.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if type.contains("BOOL") { self = .boolean }
        else if type == "DATE" { self = .date }
        else if type.contains("DATETIME") || type.contains("TIMESTAMP") { self = .dateTime }
        else if type.contains("INT") { self = .integer }
        else if type.contains("CHAR") || type.contains("CLOB") || type.contains("TEXT") { self = .text }
        else if type.isEmpty || type.contains("BLOB") { self = .blob }
        else if type.contains("REAL") || type.contains("FLOA") || type.contains("DOUB") { self = .real }
        else if type == "ANY" { self = .any }
        else { self = .numeric }
    }

    func supports(op: ViewQueryComparisonOperator) -> Bool {
        switch op {
        case .contains, .startsWith, .endsWith:
            return self == .text
        case .equals, .notEquals, .between, .in:
            return self != .blob
        case .greaterThan, .greaterThanOrEqual, .lessThan, .lessThanOrEqual:
            // Ordering is meaningful only for numeric and temporal columns;
            // categorical text values must not be compared as ordered data.
            return self != .blob && self != .boolean && self != .text
        case .isNull, .isNotNull:
            return true
        }
    }

    func supports(valueType: ViewQueryValueType, op: ViewQueryComparisonOperator) -> Bool {
        if op == .isNull || op == .isNotNull { return valueType == .null }
        switch self {
        case .any: return valueType != .null
        case .blob: return false
        case .text: return valueType == .text
        case .integer: return valueType == .integer || valueType == .boolean
        case .real: return valueType == .decimal || valueType == .integer
        case .numeric: return valueType == .decimal || valueType == .integer || valueType == .boolean
        case .date: return valueType == .date
        case .dateTime: return valueType == .dateTime
        case .boolean: return valueType == .boolean
        }
    }
}
