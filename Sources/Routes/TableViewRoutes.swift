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
    let workspaceState: String?

    private enum CodingKeys: String, CodingKey {
        case viewType
        case name
        case columns
        case queries
        case workspaceState
    }

    init(
        viewType: TableViewType,
        name: String,
        columns: [SavedTableColumnRequest],
        queries: [SavedTableQueryRequest],
        workspaceState: String? = nil
    ) {
        self.viewType = viewType
        self.name = name
        self.columns = columns
        self.queries = queries
        self.workspaceState = workspaceState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        viewType = try container.decode(TableViewType.self, forKey: .viewType)
        name = try container.decode(String.self, forKey: .name)
        columns = try container.decode([SavedTableColumnRequest].self, forKey: .columns)
        queries = try container.decode([SavedTableQueryRequest].self, forKey: .queries)
        workspaceState = try container.decodeIfPresent(String.self, forKey: .workspaceState)
    }
}

struct TableViewWorkspaceStateRequest: Content, Sendable {
    let workspaceState: String
}

struct TableViewColumnsRequest: Content, Sendable {
    let columns: [SavedTableColumnRequest]
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
        guard let hubID = request.authenticatedHubID else {
            throw Abort(.unauthorized)
        }

        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue)
        else { throw Abort(.badRequest, reason: "A valid table name and view type are required.") }

        guard let view = try await TableView.query(on: request.db)
            .filter(\.$hubID == hubID)
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
        guard let hubID = request.authenticatedHubID else {
            throw Abort(.unauthorized)
        }

        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue)
        else { throw Abort(.badRequest, reason: "A valid table name and view type are required.") }

        let input = try request.content.decode(SavedTableViewRequest.self)
        guard input.viewType == viewType else { throw Abort(.badRequest, reason: "The view type does not match the route.") }
        if let workspaceState = input.workspaceState {
            try await validateWorkspaceSelection(workspaceState, tableName: tableName, hubID: hubID, database: request.db)
        }

        let view = try await TableView.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$viewType == viewType.rawValue)
            .first() ?? TableView(hubID: hubID, tableName: tableName, name: input.name, viewType: viewType, isDefault: true)
        view.name = input.name
        // Older clients omit this field. Preserve state they do not know about.
        if let workspaceState = input.workspaceState {
            view.workspaceState = workspaceState
        }
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

    // Workspace navigation changes are independent from column and query edits.
    views.put(":tableName", ":viewType", "workspace-state") { request async throws -> TableViewResponse in
        guard let hubID = request.authenticatedHubID else {
            throw Abort(.unauthorized)
        }

        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue)
        else { throw Abort(.badRequest, reason: "A valid table name and view type are required.") }

        let input = try request.content.decode(TableViewWorkspaceStateRequest.self)
        try await validateWorkspaceSelection(input.workspaceState, tableName: tableName, hubID: hubID, database: request.db)
        let view = try await TableView.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$viewType == viewType.rawValue)
            .first()

        let savedView: TableView
        if let view {
            view.workspaceState = input.workspaceState
            savedView = view
        } else {
            let hasDefaultView = try await TableView.query(on: request.db)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .filter(\.$isDefault == true)
                .first() != nil
            savedView = TableView(
                hubID: hubID,
                tableName: tableName,
                name: viewType.rawValue,
                viewType: viewType,
                isDefault: !hasDefaultView,
                workspaceState: input.workspaceState
            )
        }

        try await savedView.save(on: request.db)
        return try TableViewResponse(model: savedView)
    }

    // Display column edits are independent from query and workspace state.
    views.put(":tableName", ":viewType", "columns") { request async throws -> SavedTableViewResponse in
        guard let hubID = request.authenticatedHubID else { throw Abort(.unauthorized) }
        guard let tableName = request.parameters.get("tableName"),
              let viewTypeValue = request.parameters.get("viewType"),
              let viewType = TableViewType(rawValue: viewTypeValue) else {
            throw Abort(.badRequest, reason: "A valid table name and view type are required.")
        }
        let input = try request.content.decode(TableViewColumnsRequest.self)
        return try await request.db.transaction { database in
            let view = try await TableView.query(on: database)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .filter(\.$viewType == viewType.rawValue)
                .first() ?? TableView(hubID: hubID, tableName: tableName, name: viewType.rawValue, viewType: viewType, isDefault: true)
            try await view.save(on: database)
            guard let viewID = view.id else { throw Abort(.internalServerError) }
            try await ViewColumnConfiguration.query(on: database).filter(\.$viewID == viewID).delete()
            for column in input.columns {
                try await ViewColumnConfiguration(
                    viewID: viewID,
                    columnName: column.columnName,
                    isVisible: column.isVisible,
                    sortOrder: column.sortOrder,
                    width: column.width
                ).save(on: database)
            }
            let columns = try await ViewColumnConfiguration.query(on: database).filter(\.$viewID == viewID).sort(\.$sortOrder).all()
            let queries = try await ViewQueryConfiguration.query(on: database).filter(\.$viewID == viewID).sort(\.$sortOrder).all()
            return SavedTableViewResponse(
                view: try TableViewResponse(model: view),
                columns: try columns.map(ViewColumnConfigurationResponse.init(model:)),
                queries: try queries.map(ViewQueryConfigurationResponse.init(model:))
            )
        }
    }
}
