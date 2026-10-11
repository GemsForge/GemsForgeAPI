import Vapor

/// Registers the read-only live database schema inspection endpoint.
func registerLiveSchemaRoutes(_ app: Application) {
    app.get("live-database", "schema") { request async throws -> LiveSchemaResponse in
        try await LiveSchemaService(database: request.db).inspect()
    }
}
