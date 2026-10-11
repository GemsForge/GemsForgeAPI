import Vapor

/// Registers migration preview and confirmation without executing schema changes.
func registerLiveMigrationRoutes(_ app: Application) {
    let service = LiveMigrationPreviewService()
    let migrations = app.grouped("live-database", "migrations")

    migrations.post("preview") { request async throws -> LiveMigrationPlan in
        do {
            let input = try request.content.decode(LiveMigrationPreviewRequest.self)
            return try await service.preview(request: input)
        } catch let error as LiveMigrationPreviewError {
            throw Abort(.badRequest, reason: error.description)
        }
    }

    migrations.post("confirm") { request async throws -> LiveMigrationPlan in
        do {
            let input = try request.content.decode(LiveMigrationConfirmationRequest.self)
            return try await service.confirm(input)
        } catch let error as LiveMigrationPreviewError {
            throw Abort(.conflict, reason: error.description)
        }
    }
}
