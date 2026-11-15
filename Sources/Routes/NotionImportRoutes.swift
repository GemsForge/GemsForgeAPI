import Vapor

/// The discovery route is operator-only because the preview can contain
/// sensitive names and property metadata from a private Notion workspace.
func registerNotionImportRoutes(_ app: Application) {
    app.get("notion-import", "preview") { request async throws -> NotionImportPreviewResponse in
        do {
            let api = try NotionAPIClient(client: request.client)
            return try await NotionImportPreviewService(api: api).preview()
        } catch let error as NotionAPIError {
            switch error {
            case .missingToken:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .rejected, .invalidResponse:
                throw Abort(.badGateway, reason: error.description)
            }
        }
    }
}
