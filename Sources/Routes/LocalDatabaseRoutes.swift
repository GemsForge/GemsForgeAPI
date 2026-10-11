import Vapor

/// Registers the local-only database creation and migration preview endpoints.
func registerLocalDatabaseRoutes(_ app: Application, configuration: LocalDatabaseConfiguration) {
    let databases = app.grouped("local-databases")

    databases.get("capabilities") { request async -> LocalDatabaseCapabilitiesResponse in
        LocalDatabaseService(configuration: configuration).capabilities()
    }

    databases.post { request async throws -> LocalDatabaseCreationResponse in
        let input = try request.content.decode(LocalDatabaseCreationRequest.self)
        do {
            return try await LocalDatabaseService(configuration: configuration).create(request: input)
        } catch let error as LocalDatabaseError {
            switch error {
            case .disabled:
                throw Abort(.forbidden, reason: error.description)
            case .invalidDatabaseName, .confirmationRequired, .unsupportedProfile:
                throw Abort(.badRequest, reason: error.description)
            case .protectedDatabase, .databaseAlreadyExists:
                throw Abort(.conflict, reason: error.description)
            case .migrationFailed:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        }
    }
}
