import Vapor

/// Authenticated schema-aware import endpoints. Approval tokens are process-local,
/// single-use, Hub-bound, and expire after five minutes.
func registerTableCSVImportRoutes(_ app: Application) {
    let approvals = TableCSVImportApprovals()
    let imports = app.grouped("table-import")

    imports.get("tables") { request async throws -> ImportableSQLTablesResponse in
        _ = try request.requireAuthenticatedHubID()
        return try await approvals.listTables(database: request.db)
    }

    imports.on(.POST, "preview", body: .collect(maxSize: "2mb")) {
        request async throws -> TableCSVImportPreviewResponse in
        let hubID = try request.requireAuthenticatedHubID()
        let input = try request.content.decode(TableCSVImportPreviewRequest.self)
        do {
            return try await approvals.preview(input, database: request.db, hubID: hubID)
        } catch let error as TableCSVImportError {
            if case .tooManyPreviews = error {
                throw Abort(.tooManyRequests, reason: error.description)
            }
            throw Abort(.unprocessableEntity, reason: error.description)
        }
    }

    imports.post("commit") { request async throws -> TableCSVImportCommitResponse in
        let hubID = try request.requireAuthenticatedHubID()
        let input = try request.content.decode(TableCSVImportCommitRequest.self)
        do {
            return try await approvals.commit(
                token: input.confirmationToken, database: request.db, hubID: hubID)
        } catch let error as TableCSVImportError {
            throw Abort(.unprocessableEntity, reason: error.description)
        }
    }
}
