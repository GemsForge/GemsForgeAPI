import Fluent
import Vapor

/// Provides database operations for ForgeKeeper page records.
///
/// This service owns persistence queries so route handlers can focus on HTTP
/// requests and responses. It does not create tables or run migrations.
struct ForgeKeeperService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns pages in stable title order.
    func list() async throws -> [ForgeKeeper] {
        try await ForgeKeeper.query(on: database)
            .sort(\.$title)
            .all()
    }

    /// Returns all pages belonging to one top-level Gem Life domain.
    func list(domainID: String) async throws -> [ForgeKeeper] {
        try await ForgeKeeper.query(on: database)
            .filter(\.$domain.$id == domainID)
            .sort(\.$title)
            .all()
    }

    /// Returns one ForgeKeeper page by its database identifier.
    func find(id: Int) async throws -> ForgeKeeper? {
        try await ForgeKeeper.find(id, on: database)
    }

    /// Saves a new page or updates an existing page.
    func save(_ page: ForgeKeeper) async throws {
        try await page.save(on: database)
    }

    /// Deletes a page when test setup or a future feature explicitly requires it.
    func delete(id: Int) async throws {
        guard let page = try await find(id: id) else {
            return
        }

        try await page.delete(on: database)
    }
}
