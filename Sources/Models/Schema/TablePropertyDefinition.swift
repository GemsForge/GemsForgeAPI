import Fluent
import Vapor

enum TablePropertyKind: String, Codable, Content, Sendable {
    case relation = "Relation"
    case lookup = "Lookup"
}

/// A table-level relationship or computed property shared across all views.
final class TablePropertyDefinition: Model, @unchecked Sendable {
    static let schema = "TablePropertyDefinitions"

    @ID(custom: "DefinitionID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "Name") var name: String
    @Field(key: "Kind") var kind: String
    @OptionalField(key: "SourceColumnName") var sourceColumnName: String?
    @OptionalField(key: "TargetTableName") var targetTableName: String?
    @OptionalField(key: "TargetKeyColumnName") var targetKeyColumnName: String?
    @OptionalField(key: "TargetDisplayColumnName") var targetDisplayColumnName: String?
    @OptionalField(key: "RelationDefinitionID") var relationDefinitionID: String?
    @OptionalField(key: "TargetColumnName") var targetColumnName: String?
    @OptionalField(key: "FilterByDefinitionID") var filterByDefinitionID: String?
    @OptionalField(key: "TargetFilterColumnName") var targetFilterColumnName: String?
    @Field(key: "SortOrder") var sortOrder: Int

    init() {}

    init(hubID: String, tableName: String, definition: TablePropertyDefinitionRequest, id: String, sortOrder: Int) {
        self.id = id
        self.hubID = hubID
        self.tableName = tableName
        self.name = definition.name
        self.kind = definition.kind.rawValue
        self.sourceColumnName = definition.sourceColumnName
        self.targetTableName = definition.targetTableName
        self.targetKeyColumnName = definition.targetKeyColumnName
        self.targetDisplayColumnName = definition.targetDisplayColumnName
        self.relationDefinitionID = definition.relationDefinitionID
        self.targetColumnName = definition.targetColumnName
        self.filterByDefinitionID = definition.filterByDefinitionID
        self.targetFilterColumnName = definition.targetFilterColumnName
        self.sortOrder = sortOrder
    }
}

struct TablePropertyDefinitionRequest: Content, Sendable {
    var id: String?
    var name: String
    var kind: TablePropertyKind
    var sourceColumnName: String?
    var targetTableName: String?
    var targetKeyColumnName: String?
    var targetDisplayColumnName: String?
    var relationDefinitionID: String?
    var targetColumnName: String?
    var filterByDefinitionID: String?
    var targetFilterColumnName: String?
}

struct TablePropertyDefinitionResponse: Content, Sendable {
    let id: String
    let tableName: String
    let name: String
    let kind: TablePropertyKind
    let sourceColumnName: String?
    let targetTableName: String?
    let targetKeyColumnName: String?
    let targetDisplayColumnName: String?
    let relationDefinitionID: String?
    let targetColumnName: String?
    let filterByDefinitionID: String?
    let targetFilterColumnName: String?
    let sortOrder: Int

    init(model: TablePropertyDefinition) throws {
        guard let id = model.id, let kind = TablePropertyKind(rawValue: model.kind) else {
            throw TablePropertyServiceError.invalidDefinition("Stored property definition is invalid.")
        }
        self.id = id
        self.tableName = model.tableName
        self.name = model.name
        self.kind = kind
        self.sourceColumnName = model.sourceColumnName
        self.targetTableName = model.targetTableName
        self.targetKeyColumnName = model.targetKeyColumnName
        self.targetDisplayColumnName = model.targetDisplayColumnName
        self.relationDefinitionID = model.relationDefinitionID
        self.targetColumnName = model.targetColumnName
        self.filterByDefinitionID = model.filterByDefinitionID
        self.targetFilterColumnName = model.targetFilterColumnName
        self.sortOrder = model.sortOrder
    }
}

struct RelatedRecordOption: Content, Sendable {
    let id: String
    let name: String
}

struct TablePropertyValue: Content, Sendable {
    let definitionID: String
    let recordID: String?
    let displayValue: String?
    let value: String?
}

enum TablePropertyServiceError: Error, CustomStringConvertible, Equatable {
    case unavailableDatabase
    case tableUnavailable
    case recordUnavailable
    case invalidDefinition(String)

    var description: String {
        switch self {
        case .unavailableDatabase: return "Table properties require the configured SQLite database."
        case .tableUnavailable: return "The source or target table is unavailable to this Hub."
        case .recordUnavailable: return "The record is unavailable to this Hub."
        case .invalidDefinition(let message): return message
        }
    }
}
