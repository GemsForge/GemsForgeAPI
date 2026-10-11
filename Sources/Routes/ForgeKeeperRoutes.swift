import Vapor

/// Registers read-only endpoints for existing ForgeKeeper pages.
func registerForgeKeeperRoutes(_ app: Application) {
    let pages = app.grouped("forgekeeper")

    pages.get { request async throws -> [ForgeKeeper] in
        try await ForgeKeeperService(database: request.db).list()
    }

    pages.get(":id") { request async throws -> ForgeKeeper in
        guard let id = request.parameters.get("id", as: Int.self),
              let page = try await ForgeKeeperService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return page
    }

    app.grouped("domains", ":domainID", "forgekeeper").get { request async throws -> [ForgeKeeper] in
        guard let domainID = request.parameters.get("domainID") else {
            throw Abort(.notFound)
        }

        return try await ForgeKeeperService(database: request.db).list(domainID: domainID)
    }
}
