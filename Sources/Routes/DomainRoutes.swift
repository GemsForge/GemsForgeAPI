import Vapor

/// The fields accepted when creating or updating a domain.
struct DomainRequest: Content {
    let id: String?
    let title: String
    let description: String
    let notes: String?
}

/// Registers the HTTP endpoints for the Domain resource.
func registerDomainRoutes(_ app: Application) {
    let domains = app.grouped("domains")

    domains.get { request async throws -> [Domain] in
        try await DomainService(database: request.db).list()
    }

    domains.post { request async throws -> Domain in
        let input = try request.content.decode(DomainRequest.self)
        let domain = Domain(
            id: input.id,
            title: input.title,
            description: input.description,
            notes: input.notes
        )

        try await DomainService(database: request.db).save(domain)
        return domain
    }

    domains.get(":id") { request async throws -> Domain in
        guard let id = request.parameters.get("id"),
              let domain = try await DomainService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return domain
    }

    domains.put(":id") { request async throws -> Domain in
        guard let id = request.parameters.get("id"),
              let domain = try await DomainService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(DomainRequest.self)
        domain.title = input.title
        domain.description = input.description
        domain.notes = input.notes
        try await DomainService(database: request.db).save(domain)
        return domain
    }

    domains.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await DomainService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await DomainService(database: request.db).delete(id: id)
        return .noContent
    }
}
