import Vapor

/// Exposes archive operations within the authenticated Hub boundary.
func registerTrashRoutes(_ app: Application) {
    let trash = app.grouped("trash")

    trash.get { request async throws -> [TrashEntryResponse] in
        try await service(for: request).list()
    }

    trash.post { request async throws -> TrashEntryResponse in
        let input = try request.content.decode(TrashEntryRequest.self)
        do {
            return try await service(for: request).archive(input)
        } catch let error as TrashServiceError {
            throw abort(for: error)
        }
    }

    trash.post(":entryID", "restore") { request async throws -> HTTPStatus in
        guard let entryID = request.parameters.get("entryID") else { throw Abort(.badRequest) }
        do {
            try await service(for: request).restore(entryID: entryID)
            return .noContent
        } catch let error as TrashServiceError {
            throw abort(for: error)
        }
    }

    trash.delete(":entryID") { request async throws -> HTTPStatus in
        guard let entryID = request.parameters.get("entryID") else { throw Abort(.badRequest) }
        do {
            try await service(for: request).permanentlyDelete(entryID: entryID)
            return .noContent
        } catch let error as TrashServiceError {
            throw abort(for: error)
        }
    }
}

private func service(for request: Request) throws -> TrashService {
    guard let hubID = request.authenticatedHubID else { throw Abort(.unauthorized) }
    return TrashService(database: request.db, hubID: hubID)
}

private func abort(for error: TrashServiceError) -> Abort {
    switch error {
    case .invalidTable:
        return Abort(.badRequest, reason: "This record type cannot be moved to Trash.")
    case .invalidRequest:
        return Abort(.badRequest, reason: "A valid record title, ID, and JSON snapshot are required.")
    case .alreadyArchived:
        return Abort(.conflict, reason: "This record is already in Trash.")
    case .entryNotFound:
        return Abort(.notFound, reason: "The Trash entry is unavailable in this Hub.")
    case .invalidStoredEntry:
        return Abort(.unprocessableEntity, reason: "The stored Trash entry is invalid.")
    case .databaseUnavailable:
        return Abort(.serviceUnavailable)
    }
}
