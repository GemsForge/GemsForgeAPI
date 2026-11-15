import Vapor

func registerTableColumnDefinitionRoutes(_ app: Application) {
    let definitions = app.grouped("table-column-definitions")

    definitions.get(":tableName", "backfill", "preview") { request async throws -> TableColumnDefinitionBackfillResponse in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        return try await TableColumnDefinitionBackfillService(database: request.db, hubID: hubID).preview(tableName: tableName)
    }

    definitions.post(":tableName", "backfill", "apply") { request async throws -> TableColumnDefinitionBackfillResponse in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        return try await TableColumnDefinitionBackfillService(database: request.db, hubID: hubID).apply(tableName: tableName)
    }

    definitions.get(":tableName") { request async throws -> [TableColumnDefinitionResponse] in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        return try await TableColumnDefinitionService(database: request.db, hubID: hubID).definitions(tableName: tableName)
    }

    definitions.put(":tableName", ":columnName") { request async throws -> TableColumnDefinitionWriteResponse in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        guard let columnName = request.parameters.get("columnName"), !columnName.isEmpty else {
            throw Abort(.badRequest, reason: "A column name is required.")
        }
        let input = try request.content.decode(TableColumnDefinitionRequest.self)
        do {
            return try await TableColumnDefinitionService(database: request.db, hubID: hubID)
                .save(tableName: tableName, columnName: columnName, input: input)
        } catch let error as TableColumnDefinitionError {
            switch error {
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            case .invalidStoredDefinition: throw Abort(.internalServerError, reason: error.description)
            case .invalidOption, .invalidColumn: throw Abort(.badRequest, reason: error.description)
            }
        }
    }

    definitions.delete(":tableName", ":columnName") { request async throws -> HTTPStatus in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        guard let columnName = request.parameters.get("columnName"), !columnName.isEmpty else {
            throw Abort(.badRequest, reason: "A column name is required.")
        }
        try await TableColumnDefinitionService(database: request.db, hubID: hubID).delete(tableName: tableName, columnName: columnName)
        return .noContent
    }
}

private func requireHubID(_ request: Request) throws -> String {
    guard let hubID = request.authenticatedHubID else { throw Abort(.unauthorized) }
    return hubID
}

private func requireTableName(_ request: Request) throws -> String {
    guard let tableName = request.parameters.get("tableName"), !tableName.isEmpty else {
        throw Abort(.badRequest, reason: "A table name is required.")
    }
    return tableName
}
