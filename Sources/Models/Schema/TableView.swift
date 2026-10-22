import Fluent
import Vapor

/// Hub-owned presentation metadata for one existing logical SQLite table.
final class TableView: Model, @unchecked Sendable {
    static let schema = "TableViews"

    @ID(custom: "ViewID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "Name") var name: String
    @Field(key: "ViewType") var viewType: String
    @Field(key: "IsDefault") var isDefault: Bool
    @Field(key: "SortOrder") var sortOrder: Int
    @Field(key: "ConfigurationVersion") var configurationVersion: Int
    @Timestamp(key: "CreatedAt", on: .create) var createdAt: Date?
    @Timestamp(key: "UpdatedAt", on: .update) var updatedAt: Date?

    init() {}

    init(
        id: String = UUID().uuidString,
        hubID: String,
        tableName: String,
        name: String,
        viewType: TableViewType,
        isDefault: Bool = false,
        sortOrder: Int = 0,
        configurationVersion: Int = 1
    ) {
        self.id = id
        self.hubID = hubID
        self.tableName = tableName
        self.name = name
        self.viewType = viewType.rawValue
        self.isDefault = isDefault
        self.sortOrder = sortOrder
        self.configurationVersion = configurationVersion
    }

    /// Returns the closed-contract view type, or `nil` for unsupported stored values.
    ///
    /// Persisted metadata is rejected by DTO mapping rather than being silently
    /// coerced into a supported renderer.
    var typedViewType: TableViewType? { TableViewType(rawValue: viewType) }
}

extension TableViewResponse {
    init(model: TableView) throws {
        guard let viewID = model.id, let viewType = model.typedViewType else {
            throw TableViewModelMappingError.invalidPersistedValue
        }
        self.init(viewID: viewID, hubID: model.hubID, tableName: model.tableName, name: model.name,
                  viewType: viewType, isDefault: model.isDefault, sortOrder: model.sortOrder,
                  configurationVersion: model.configurationVersion, createdAt: model.createdAt,
                  updatedAt: model.updatedAt)
    }
}

/// Indicates that persisted Table View metadata cannot satisfy the public DTO contract.
enum TableViewModelMappingError: Error, Equatable { case invalidPersistedValue }
