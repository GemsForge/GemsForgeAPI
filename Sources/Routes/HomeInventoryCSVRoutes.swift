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

    app.post("home-inventory", "import") { request async throws -> HomeInventoryCSVImportResponse in
        do {
            let input = try request.content.decode(HomeInventoryCSVImportRequest.self)
            return try await HomeInventoryCSVImportService(database: request.db).importCSV(input)
        } catch let error as HomeInventoryCSVImportError {
            switch error {
            case .confirmationRequired:
                throw Abort(.badRequest, reason: error.description)
            case .previewNotReady:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        } catch let error as HomeInventoryCSVPreviewError {
            throw Abort(.unprocessableEntity, reason: error.description)
        } catch let error as AbortError {
            throw error
        }
    }
}
