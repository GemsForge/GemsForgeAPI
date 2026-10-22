import Fluent
import Vapor

/// Per-view presentation metadata. It never changes the underlying Table.
final class ViewColumnConfiguration: Model, @unchecked Sendable {
    static let schema = "ViewColumnConfigurations"

    @ID(custom: "ViewColumnID") var id: String?
    @Field(key: "ViewID") var viewID: String
    @Field(key: "ColumnName") var columnName: String
    @Field(key: "IsVisible") var isVisible: Bool
    @Field(key: "SortOrder") var sortOrder: Int
    @OptionalField(key: "Width") var width: Double?

    init() {}

    init(
        id: String = UUID().uuidString,
        viewID: String,
        columnName: String,
        isVisible: Bool = true,
        sortOrder: Int = 0,
        width: Double? = nil
    ) {
        self.id = id
        self.viewID = viewID
        self.columnName = columnName
        self.isVisible = isVisible
        self.sortOrder = sortOrder
        self.width = width
    }
}

extension ViewColumnConfigurationResponse {
    init(model: ViewColumnConfiguration) throws {
        guard let id = model.id else { throw TableViewModelMappingError.invalidPersistedValue }
        self.init(viewColumnID: id, viewID: model.viewID, columnName: model.columnName,
                  isVisible: model.isVisible, sortOrder: model.sortOrder, width: model.width)
    }
}
