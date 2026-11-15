import Fluent
import Vapor

enum TableColumnPropertyType: String, Codable, Content, CaseIterable, Sendable {
    case select = "Select"
    case multiSelect = "MultiSelect"
    case status = "Status"
}

enum RecordColorToken: String, Codable, Content, CaseIterable, Sendable {
    case mint, gold, blue, green, purple, orange, red, gray
}

struct TableColumnOption: Codable, Content, Sendable, Equatable {
    var value: String
    var color: RecordColorToken?
}

/// Hub-scoped semantic metadata for one physical text column.
final class TableColumnDefinition: Model, @unchecked Sendable {
    static let schema = "TableColumnDefinitions"

    @ID(custom: "DefinitionID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "ColumnName") var columnName: String
    @Field(key: "PropertyType") var propertyType: String
    @Field(key: "OptionsJSON") var optionsJSON: String
    @Timestamp(key: "CreatedAt", on: .create) var createdAt: Date?
    @Timestamp(key: "UpdatedAt", on: .update) var updatedAt: Date?

    init() {}

    init(hubID: String, tableName: String, columnName: String, propertyType: TableColumnPropertyType, options: [TableColumnOption]) throws {
        self.id = UUID().uuidString
        self.hubID = hubID
        self.tableName = tableName
        self.columnName = columnName
        self.propertyType = propertyType.rawValue
        let data = try JSONEncoder().encode(options)
        self.optionsJSON = String(decoding: data, as: UTF8.self)
    }

    func options() throws -> [TableColumnOption] {
        try JSONDecoder().decode([TableColumnOption].self, from: Data(optionsJSON.utf8))
    }
}

struct TableColumnDefinitionResponse: Content, Sendable {
    let id: String
    let tableName: String
    let columnName: String
    let propertyType: TableColumnPropertyType
    let options: [TableColumnOption]

    init(model: TableColumnDefinition) throws {
        guard let id = model.id,
              let propertyType = TableColumnPropertyType(rawValue: model.propertyType) else {
            throw TableColumnDefinitionError.invalidStoredDefinition
        }
        self.id = id
        self.tableName = model.tableName
        self.columnName = model.columnName
        self.propertyType = propertyType
        self.options = try model.options()
    }
}

struct TableColumnDefinitionRequest: Content, Sendable {
    let propertyType: TableColumnPropertyType
    var options: [TableColumnOption]
    var renames: [TableColumnOptionRename]?
}

struct TableColumnOptionRename: Content, Sendable {
    let from: String
    let to: String
}

struct TableColumnDefinitionWriteResponse: Content, Sendable {
    let definition: TableColumnDefinitionResponse
    let rowsChanged: Int
}

enum TableColumnDefinitionError: Error, CustomStringConvertible, Equatable {
    case invalidStoredDefinition
    case invalidOption(String)
    case invalidColumn(String)
    case unavailableDatabase

    var description: String {
        switch self {
        case .invalidStoredDefinition: return "The stored table column definition is invalid."
        case .invalidOption(let reason), .invalidColumn(let reason): return reason
        case .unavailableDatabase: return "Table column definitions require the configured SQLite database."
        }
    }
}
