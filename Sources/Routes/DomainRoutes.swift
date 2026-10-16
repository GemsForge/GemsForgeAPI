import Vapor

/// The fields accepted when creating or updating a domain.
struct DomainRequest: Content {
    let id: String?
    let title: String
    let description: String
}

private func validate(_ input: DomainRequest) throws {
    guard !input.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          !input.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
        throw Abort(.badRequest, reason: "Domain title and description are required.")
    }
}

/// Registers the HTTP endpoints for the Domain resource.
func registerDomainRoutes(_ app: Application) {
    let domains = app.grouped("domains")

    domains.get { request async throws -> [Domain] in
        try await DomainService(database: request.db).list()
    }

    domains.post { request async throws -> Domain in
        let input = try request.content.decode(DomainRequest.self)
        try validate(input)

        if let id = input.id,
           try await DomainService(database: request.db).find(id: id) != nil
        {
            throw Abort(.conflict, reason: "A domain with this ID already exists.")
        }

        let domain = Domain(
            id: input.id,
            title: input.title,
            description: input.description
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

    domains.patch(":id") { request async throws -> Domain in
        guard let id = request.parameters.get("id"),
              let domain = try await DomainService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let payload = try request.content.decode([String: String?].self)
        try PropertyPatchValidation.requireNonEmpty(payload)
        try PropertyPatchValidation.requireKnownProperties(payload, allowed: ["title", "description"])

        let title = PropertyPatchValidation.value("title", in: payload, current: domain.title)
        let description = PropertyPatchValidation.value("description", in: payload, current: domain.description)
        guard let title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let description, !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw Abort(.unprocessableEntity, reason: "Domain title and description cannot be empty.")
        }

        domain.title = title
        domain.description = description
        try await DomainService(database: request.db).save(domain)
        return domain
    }

    domains.put(":id") { request async throws -> Domain in
        guard let id = request.parameters.get("id"),
              let domain = try await DomainService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(DomainRequest.self)
        try validate(input)
        domain.title = input.title
        domain.description = input.description
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
