import Vapor

func registerSchemaPageRoutes(_ app: Application) {
    let pages = app.grouped("schema-builder", "tables")

    pages.get { request async throws -> SchemaPageTablesResponse in
        let hubID = try request.requireAuthenticatedHubID()
        return try await SchemaPageService(database: request.db, hubID: hubID).listTables()
    }

    pages.post(":tableName", "page") { request async throws -> SchemaPageTableResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        do {
            return try await SchemaPageService(database: request.db, hubID: hubID).createPage(tableName: tableName)
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable: throw Abort(.unprocessableEntity, reason: error.description)
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            }
        }
    }

    pages.get(":tableName", "records") { request async throws -> SchemaPageRecordsResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        let limit = request.query[Int.self, at: "limit"] ?? 50
        let offset = request.query[Int.self, at: "offset"] ?? 0
        do {
            return try await SchemaPageService(database: request.db, hubID: hubID)
                .records(tableName: tableName, limit: limit, offset: offset)
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable: throw Abort(.notFound, reason: error.description)
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            }
        }
    }
}
