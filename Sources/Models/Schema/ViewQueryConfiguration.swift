import Fluent
import Vapor

/// One node in a server-validated View query tree. Query rows are metadata;
/// they are never interpreted as arbitrary SQL.
final class ViewQueryConfiguration: Model, @unchecked Sendable {
    static let schema = "ViewQueryConfigurations"

    @ID(custom: "ViewQueryID") var id: String?
    @Field(key: "ViewID") var viewID: String
    @OptionalField(key: "ParentQueryID") var parentQueryID: String?
    @Field(key: "NodeType") var nodeType: String
    @OptionalField(key: "ColumnName") var columnName: String?
    @OptionalField(key: "Operator") var comparisonOperator: String?
    @OptionalField(key: "ValueType") var valueType: String?
    @OptionalField(key: "Value") var value: String?
    @OptionalField(key: "BooleanOperator") var booleanOperator: String?
    @OptionalField(key: "Direction") var direction: String?
    @Field(key: "SortOrder") var sortOrder: Int

    init() {}

    init(
        id: String = UUID().uuidString,
        viewID: String,
        parentQueryID: String? = nil,
        nodeType: ViewQueryNodeType,
        columnName: String? = nil,
        comparisonOperator: ViewQueryComparisonOperator? = nil,
        valueType: ViewQueryValueType? = nil,
        value: String? = nil,
        booleanOperator: ViewQueryBooleanOperator? = nil,
        direction: ViewQuerySortDirection? = nil,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.viewID = viewID
        self.parentQueryID = parentQueryID
        self.nodeType = nodeType.rawValue
        self.columnName = columnName
        self.comparisonOperator = comparisonOperator?.rawValue
        self.valueType = valueType?.rawValue
        self.value = value
        self.booleanOperator = booleanOperator?.rawValue
        self.direction = direction?.rawValue
        self.sortOrder = sortOrder
    }

    var typedNodeType: ViewQueryNodeType? { ViewQueryNodeType(rawValue: nodeType) }
    var typedComparisonOperator: ViewQueryComparisonOperator? {
        comparisonOperator.flatMap(ViewQueryComparisonOperator.init(rawValue:))
    }
    var typedValueType: ViewQueryValueType? { valueType.flatMap(ViewQueryValueType.init(rawValue:)) }
    var typedBooleanOperator: ViewQueryBooleanOperator? {
        booleanOperator.flatMap(ViewQueryBooleanOperator.init(rawValue:))
    }
    var typedDirection: ViewQuerySortDirection? { direction.flatMap(ViewQuerySortDirection.init(rawValue:)) }
}

extension ViewQueryConfigurationResponse {
    init(model: ViewQueryConfiguration) throws {
        guard let id = model.id, let nodeType = model.typedNodeType else {
            throw TableViewModelMappingError.invalidPersistedValue
        }
        let comparisonOperator: ViewQueryComparisonOperator?
        if model.comparisonOperator != nil {
            guard let parsed = model.typedComparisonOperator else { throw TableViewModelMappingError.invalidPersistedValue }
            comparisonOperator = parsed
        } else {
            comparisonOperator = nil
        }
        let valueType: ViewQueryValueType?
        if model.valueType != nil {
            guard let parsed = model.typedValueType else { throw TableViewModelMappingError.invalidPersistedValue }
            valueType = parsed
        } else {
            valueType = nil
        }
        let booleanOperator: ViewQueryBooleanOperator?
        if model.booleanOperator != nil {
            guard let parsed = model.typedBooleanOperator else { throw TableViewModelMappingError.invalidPersistedValue }
            booleanOperator = parsed
        } else {
            booleanOperator = nil
        }
        let direction: ViewQuerySortDirection?
        if model.direction != nil {
            guard let parsed = model.typedDirection else { throw TableViewModelMappingError.invalidPersistedValue }
            direction = parsed
        } else {
            direction = nil
        }
        self.init(viewQueryID: id, viewID: model.viewID, parentQueryID: model.parentQueryID,
                  nodeType: nodeType, columnName: model.columnName,
                  comparisonOperator: comparisonOperator, valueType: valueType,
                  value: model.value, booleanOperator: booleanOperator,
                  direction: direction, sortOrder: model.sortOrder)
    }
}
