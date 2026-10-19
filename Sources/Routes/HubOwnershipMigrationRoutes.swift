import Vapor

/// Registers explicit operator-only inspection and ownership-assignment routes.
func registerHubOwnershipMigrationRoutes(_ app: Application) {
    app.get("operator", "hub-ownership", "preview") { request async throws -> HubOwnershipMigrationPreview in
        let hubID = try request.requireAuthenticatedHubID()
        do {
            return try await HubOwnershipMigrationService(database: request.db).preview(hubID: hubID)
        } catch let error as HubOwnershipMigrationError {
            throw abort(for: error)
        }
    }

    app.post("operator", "hub-ownership", "assign") { request async throws -> HubOwnershipAssignmentResult in
        let hubID = try request.requireAuthenticatedHubID()
        let input = try request.content.decode(HubOwnershipAssignmentRequest.self)
        do {
            return try await HubOwnershipMigrationService(database: request.db)
                .assignUnowned(hubID: hubID, request: input)
        } catch let error as HubOwnershipMigrationError {
            throw abort(for: error)
        }
    }
}

private func abort(for error: HubOwnershipMigrationError) -> Abort {
    switch error {
    case .confirmationRequired:
        return Abort(.badRequest, reason: error.description)
    case .unknownHub:
        return Abort(.forbidden, reason: error.description)
    case .previewMismatch:
        return Abort(.conflict, reason: error.description)
    case .unsupportedDatabase:
        return Abort(.serviceUnavailable, reason: error.description)
    }
}
