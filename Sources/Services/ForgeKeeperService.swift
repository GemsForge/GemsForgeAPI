import Fluent
import Vapor

/// Provides database operations for ForgeKeeper page records.
///
/// This service owns persistence queries so route handlers can focus on HTTP
/// requests and responses. It does not create tables or run migrations.
///
/// Example from a route or test:
/// ```swift
/// let service = ForgeKeeperService(database: request.db)
/// let pages = try await service.list(domainID: "LIFE")
/// ```
struct ForgeKeeperService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns all ForgeKeeper pages in stable title order.
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

    /// Returns root pages that do not have a parent page.
    func listRoots() async throws -> [ForgeKeeper] {
        try await ForgeKeeper.query(on: database)
            .filter(\.$parent.$id == nil)
            .sort(\.$title)
            .all()
    }

    /// Returns the immediate child pages belonging to one parent page.
    func listChildren(of parentID: Int) async throws -> [ForgeKeeper] {
        try await ForgeKeeper.query(on: database)
            .filter(\.$parent.$id == parentID)
            .sort(\.$title)
            .all()
    }

    /// Returns one ForgeKeeper page by its database identifier.
    func find(id: Int) async throws -> ForgeKeeper? {
        try await ForgeKeeper.find(id, on: database)
    }

    /// Saves a new page or updates an existing page.
    ///
    /// Creates a page when it has no ID or updates the existing page record.
    func save(_ page: ForgeKeeper) async throws {
        try await page.save(on: database)
    }

    /// Deletes one ForgeKeeper page by its database identifier.
    func delete(id: Int) async throws {
        guard let page = try await find(id: id) else {
            return
        }

        try await page.delete(on: database)
    }
}
