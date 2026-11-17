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
            case .recordUnavailable: throw Abort(.notFound, reason: error.description)
            case .invalidRecord: throw Abort(.unprocessableEntity, reason: error.description)
            case .invalidPropertyValue: throw Abort(.badRequest, reason: error.description)
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
            case .recordUnavailable: throw Abort(.notFound, reason: error.description)
            case .invalidRecord: throw Abort(.unprocessableEntity, reason: error.description)
            case .invalidPropertyValue: throw Abort(.badRequest, reason: error.description)
            }
        }
    }

    pages.post(":tableName", "query") { request async throws -> SchemaPageQueryResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        let input = try request.content.decode(SchemaPageQueryRequest.self)
        do {
            return try await ViewQueryExecutor(database: request.db, hubID: hubID).execute(tableName: tableName, request: input)
        } catch let error as ViewQueryExecutorError {
            switch error {
            case .tableUnavailable, .viewUnavailable: throw Abort(.notFound, reason: error.description)
            case .invalidRequest: throw Abort(.badRequest, reason: error.description)
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            case .invalidQuery, .unsupportedRelationColumn, .queryLimitExceeded:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        }
    }

    pages.get(":tableName", "records", ":recordID") { request async throws -> SchemaPageRecordResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName"),
              let recordID = request.parameters.get("recordID") else { throw Abort(.badRequest) }
        do {
            return try await SchemaPageService(database: request.db, hubID: hubID)
                .record(tableName: tableName, recordID: recordID)
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable: throw Abort(.notFound, reason: error.description)
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            case .recordUnavailable: throw Abort(.notFound, reason: error.description)
            case .invalidRecord: throw Abort(.notFound, reason: error.description)
            case .invalidPropertyValue: throw Abort(.badRequest, reason: error.description)
            }
        }
    }

    pages.patch(":tableName", "records", ":recordID") { request async throws -> HTTPStatus in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName"),
              let recordID = request.parameters.get("recordID") else { throw Abort(.badRequest) }
        let (values, createMissingOptions) = try decodeSchemaPageWrite(request)
        do {
            try await SchemaPageService(database: request.db, hubID: hubID)
                .updateRecord(tableName: tableName, recordID: recordID, values: values, createMissingOptions: createMissingOptions)
            return .noContent
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable, .recordUnavailable:
                throw Abort(.notFound, reason: error.description)
            case .unavailableDatabase:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .invalidRecord:
                throw Abort(.unprocessableEntity, reason: error.description)
            case .invalidPropertyValue:
                throw Abort(.badRequest, reason: error.description)
            }
        }
    }

    pages.patch(":tableName", "records", ":recordID", "attachments", ":columnName") { request async throws -> HTTPStatus in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName"),
              let recordID = request.parameters.get("recordID"),
              let columnName = request.parameters.get("columnName") else { throw Abort(.badRequest) }
        let input = try request.content.decode(AttachmentReferenceRequest.self)
        do {
            try await SchemaPageService(database: request.db, hubID: hubID).updateImageReference(
                tableName: tableName,
                recordID: recordID,
                columnName: columnName,
                fileMetadataID: input.fileMetadataID
            )
            return .noContent
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable, .recordUnavailable:
                throw Abort(.notFound, reason: error.description)
            case .unavailableDatabase:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .invalidRecord:
                throw Abort(.unprocessableEntity, reason: error.description)
            case .invalidPropertyValue:
                throw Abort(.badRequest, reason: error.description)
            }
        }
    }

    pages.post(":tableName", "records") { request async throws -> SchemaPageRecordCreationResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        let (values, createMissingOptions) = try decodeSchemaPageWrite(request)
        do {
            return try await SchemaPageService(database: request.db, hubID: hubID)
                .createRecord(tableName: tableName, values: values, createMissingOptions: createMissingOptions)
        } catch let error as SchemaPageError {
            switch error {
            case .tableUnavailable: throw Abort(.notFound, reason: error.description)
            case .unavailableDatabase: throw Abort(.serviceUnavailable, reason: error.description)
            case .recordUnavailable: throw Abort(.notFound, reason: error.description)
            case .invalidRecord: throw Abort(.unprocessableEntity, reason: error.description)
            case .invalidPropertyValue: throw Abort(.badRequest, reason: error.description)
            }
        }
    }
}

private func decodeSchemaPageWrite(_ request: Request) throws -> ([String: PatchJSONValue], Bool) {
    var values = try request.content.decode([String: PatchJSONValue].self)
    guard let flag = values.removeValue(forKey: "createMissingOptions") else { return (values, false) }
    guard case .bool(let enabled) = flag else {
        throw Abort(.badRequest, reason: "createMissingOptions must be a Boolean.")
    }
    return (values, enabled)
}
