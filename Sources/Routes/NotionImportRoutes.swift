import Vapor

/// The discovery route is operator-only because the preview can contain
/// sensitive names and property metadata from a private Notion workspace.
func registerNotionImportRoutes(
    _ app: Application,
    backupConfiguration: LiveDatabaseBackupConfiguration? = .fromEnvironment()
) {
    app.get("notion-import", "preview") { request async throws -> NotionImportPreviewResponse in
        do {
            let api = try NotionAPIClient(client: request.client)
            return try await NotionImportPreviewService(api: api, database: request.db, hubID: request.requireAuthenticatedHubID())
                .preview()
        } catch let error as NotionAPIError {
            switch error {
            case .missingToken:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .rejected, .invalidResponse, .invalidFileURL, .fileDownloadFailed:
                throw Abort(.badGateway, reason: error.description)
            }
        }
    }

    app.post("notion-import", "commit") { request async throws -> NotionImportCommitResponse in
        do {
            let input = try request.content.decode(NotionImportCommitRequest.self)
            let api = try NotionAPIClient(client: request.client)
            return try await NotionImportExecutionService(
                api: api,
                database: request.db,
                hubID: request.requireAuthenticatedHubID(),
                backupConfiguration: backupConfiguration
            ).execute(input)
        } catch let error as NotionImportExecutionError {
            switch error {
            case .confirmationRequired: throw Abort(.badRequest, reason: error.description)
            case .previewExpired, .previewChanged: throw Abort(.conflict, reason: error.description)
            case .backupNotConfigured, .sourceMapUnavailable: throw Abort(.serviceUnavailable, reason: error.description)
            }
        } catch let error as NotionAPIError {
            let status: HTTPResponseStatus = if case .missingToken = error { .serviceUnavailable } else { .badGateway }
            throw Abort(status, reason: error.description)
        }
    }
}
