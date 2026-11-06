import Vapor

/// Registers Hub-scoped table-property configuration and value endpoints.
func registerTablePropertyRoutes(_ app: Application) {
    let tables = app.grouped("schema-builder", "tables")

    tables.get(":tableName", "properties") { request async throws -> [TablePropertyDefinitionResponse] in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        do {
            return try await TablePropertyService(database: request.db, hubID: hubID).definitions(tableName: tableName)
        } catch let error as TablePropertyServiceError {
            throw TablePropertyRoutesNamespace.abort(error)
        }
    }

    tables.put(":tableName", "properties") { request async throws -> [TablePropertyDefinitionResponse] in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        let definitions = try request.content.decode([TablePropertyDefinitionRequest].self)
        do {
            return try await TablePropertyService(database: request.db, hubID: hubID)
                .replace(tableName: tableName, definitions: definitions)
        } catch let error as TablePropertyServiceError {
            throw TablePropertyRoutesNamespace.abort(error)
        }
    }

    tables.get(":tableName", "properties", ":propertyID", "options") { request async throws -> [RelatedRecordOption] in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName"),
              let propertyID = request.parameters.get("propertyID") else { throw Abort(.badRequest) }
        do {
            return try await TablePropertyService(database: request.db, hubID: hubID).options(
                tableName: tableName,
                definitionID: propertyID,
                recordID: request.query[String.self, at: "recordID"],
                search: request.query[String.self, at: "search"],
                limit: request.query[Int.self, at: "limit"] ?? 50
            )
        } catch let error as TablePropertyServiceError {
            throw TablePropertyRoutesNamespace.abort(error)
        }
    }

    tables.get(":tableName", "records", ":recordID", "properties") { request async throws -> [TablePropertyValue] in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName"),
              let recordID = request.parameters.get("recordID") else { throw Abort(.badRequest) }
        do {
            return try await TablePropertyService(database: request.db, hubID: hubID)
                .values(tableName: tableName, recordID: recordID)
        } catch let error as TablePropertyServiceError {
            throw TablePropertyRoutesNamespace.abort(error)
        }
    }
}

private extension TablePropertyRoutesNamespace {
    static func abort(_ error: TablePropertyServiceError) -> Abort {
        switch error {
        case .tableUnavailable, .recordUnavailable: return Abort(.notFound, reason: error.description)
        case .unavailableDatabase: return Abort(.serviceUnavailable, reason: error.description)
        case .invalidDefinition: return Abort(.unprocessableEntity, reason: error.description)
        }
    }
}

// Namespace wrapper keeps route error conversion local without exposing it as
// an unrelated global helper.
private enum TablePropertyRoutesNamespace {}
