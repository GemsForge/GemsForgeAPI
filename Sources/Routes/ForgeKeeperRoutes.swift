import Vapor

/// Registers endpoints for existing ForgeKeeper pages.
func registerForgeKeeperRoutes(_ app: Application) {
    let pages = app.grouped("forgekeeper")

    pages.get { request async throws -> [ForgeKeeper] in
        try await ForgeKeeperService(database: request.db).list()
    }

    pages.get("roots") { request async throws -> [ForgeKeeper] in
        try await ForgeKeeperService(database: request.db).listRoots()
    }

    pages.get(":id", "children") { request async throws -> [ForgeKeeper] in
        guard let id = request.parameters.get("id", as: Int.self),
              try await ForgeKeeperService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        return try await ForgeKeeperService(database: request.db).listChildren(of: id)
    }

    pages.get(":id") { request async throws -> ForgeKeeper in
        guard let id = request.parameters.get("id", as: Int.self),
              let page = try await ForgeKeeperService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return page
    }

    pages.patch(":id") { request async throws -> ForgeKeeper in
        guard let id = request.parameters.get("id", as: Int.self),
              let page = try await ForgeKeeperService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ForgeKeeperPatchRequest.self)
        guard input.title != nil || input.description != nil || input.parentID != nil else {
            throw Abort(.badRequest, reason: "At least one editable field is required.")
        }

        if let title = input.title {
            guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw Abort(.badRequest, reason: "Title cannot be empty.")
            }
            page.title = title
        }

        if let description = input.description {
            guard !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw Abort(.badRequest, reason: "Description cannot be empty.")
            }
            page.description = description
        }

        if let parentID = input.parentID {
            guard let parentID else {
                page.$parent.id = nil
                try await ForgeKeeperService(database: request.db).save(page)
                return page
            }

            guard parentID != page.id,
                  let parent = try await ForgeKeeperService(database: request.db).find(id: parentID),
                  parent.$domain.id == page.$domain.id
            else {
                throw Abort(.badRequest, reason: "Parent page must exist in the same domain and cannot be the page itself.")
            }

            page.$parent.id = parentID
        }

        try await ForgeKeeperService(database: request.db).save(page)
        return page
    }

    // Use `id` here because `/domains/:id` already exists in DomainRoutes.
    // RoutingKit requires matching parameter names at the same path position.
    app.grouped("domains", ":id", "forgekeeper").get { request async throws -> [ForgeKeeper] in
        guard let domainID = request.parameters.get("id") else {
            throw Abort(.notFound)
        }

        return try await ForgeKeeperService(database: request.db).list(domainID: domainID)
    }
}
