import Vapor

/// Registers the non-destructive CSV preview endpoint for the testing console.
func registerHomeInventoryCSVRoutes(_ app: Application) {
    app.post("home-inventory", "import", "preview") { request async throws -> HomeInventoryCSVPreviewResponse in
        do {
            let input = try request.content.decode(HomeInventoryCSVPreviewRequest.self)
            return try await HomeInventoryCSVPreviewService(database: request.db).preview(csv: input.csv)
        } catch let error as HomeInventoryCSVPreviewError {
            throw Abort(.badRequest, reason: error.description)
        }
    }
}
