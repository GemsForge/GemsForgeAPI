import Fluent
import Vapor

/// The persisted presentation state for one hub-owned table view.
struct SavedTableViewResponse: Content, Sendable {
    let view: TableViewResponse
    let columns: [ViewColumnConfigurationResponse]
    let queries: [ViewQueryConfigurationResponse]
}

struct SavedTableViewRequest: Content, Sendable {
    let viewType: TableViewType
    let name: String
    let columns: [SavedTableColumnRequest]
    let queries: [SavedTableQueryRequest]
}

struct SavedTableColumnRequest: Content, Sendable {
    let columnName: String
    let isVisible: Bool
    let sortOrder: Int
    let width: Double?
}

struct SavedTableQueryRequest: Content, Sendable {
    let parentQueryID: String?
    let nodeType: ViewQueryNodeType
    let columnName: String?
    let comparisonOperator: ViewQueryComparisonOperator?
    let valueType: ViewQueryValueType?
    let value: String?
    let booleanOperator: ViewQueryBooleanOperator?
    let direction: ViewQuerySortDirection?
    let sortOrder: Int
}

/// Loads and replaces the saved presentation metadata for a table view.
func registerTableViewRoutes(_ app: Application) {
    let views = app.grouped("table-views")

    views.get(":tableName", ":viewType") { request async throws -> SavedTableViewResponse in
        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue)
        else { throw Abort(.badRequest, reason: "A valid table name and view type are required.") }

        guard let view = try await TableView.query(on: request.db)
            .filter(\.$hubID == request.authenticatedHubID)
            .filter(\.$tableName == tableName)
            .filter(\.$viewType == viewType.rawValue)
            .first()
        else { throw Abort(.notFound) }

        guard let viewID = view.id else { throw Abort(.internalServerError) }
        let columns = try await ViewColumnConfiguration.query(on: request.db)
            .filter(\.$viewID == viewID).sort(\.$sortOrder).all()
        let queries = try await ViewQueryConfiguration.query(on: request.db)
            .filter(\.$viewID == viewID).sort(\.$sortOrder).all()

        return SavedTableViewResponse(
            view: try TableViewResponse(model: view),
            columns: try columns.map(ViewColumnConfigurationResponse.init(model:)),
            queries: try queries.map(ViewQueryConfigurationResponse.init(model:))
        )
    }

    views.put(":tableName", ":viewType") { request async throws -> SavedTableViewResponse in
        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue)
        else { throw Abort(.badRequest, reason: "A valid table name and view type are required.") }

        let input = try request.content.decode(SavedTableViewRequest.self)
        guard input.viewType == viewType else { throw Abort(.badRequest, reason: "The view type does not match the route.") }

        let view = try await TableView.query(on: request.db)
            .filter(\.$hubID == request.authenticatedHubID)
            .filter(\.$tableName == tableName)
            .filter(\.$viewType == viewType.rawValue)
            .first() ?? TableView(hubID: request.authenticatedHubID, tableName: tableName, name: input.name, viewType: viewType, isDefault: true)
        view.name = input.name
        try await view.save(on: request.db)
        guard let viewID = view.id else { throw Abort(.internalServerError) }

        try await ViewColumnConfiguration.query(on: request.db).filter(\.$viewID == viewID).delete()
        try await ViewQueryConfiguration.query(on: request.db).filter(\.$viewID == viewID).delete()
        for column in input.columns {
            try await ViewColumnConfiguration(viewID: viewID, columnName: column.columnName, isVisible: column.isVisible, sortOrder: column.sortOrder, width: column.width).save(on: request.db)
        }
        for query in input.queries {
            try await ViewQueryConfiguration(viewID: viewID, parentQueryID: query.parentQueryID, nodeType: query.nodeType, columnName: query.columnName, comparisonOperator: query.comparisonOperator, valueType: query.valueType, value: query.value, booleanOperator: query.booleanOperator, direction: query.direction, sortOrder: query.sortOrder).save(on: request.db)
        }

        let columns = try await ViewColumnConfiguration.query(on: request.db).filter(\.$viewID == viewID).sort(\.$sortOrder).all()
        let queries = try await ViewQueryConfiguration.query(on: request.db).filter(\.$viewID == viewID).sort(\.$sortOrder).all()
        return SavedTableViewResponse(view: try TableViewResponse(model: view), columns: try columns.map(ViewColumnConfigurationResponse.init(model:)), queries: try queries.map(ViewQueryConfigurationResponse.init(model:)))
    }
}
