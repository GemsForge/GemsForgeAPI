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
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns all ForgeKeeper pages in stable title order.
    func list() async throws -> [ForgeKeeper] {
        var query = ForgeKeeper.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$title)
            .all()
    }

    /// Returns all pages belonging to one top-level Gem Life domain.
    func list(domainID: String) async throws -> [ForgeKeeper] {
        var query = ForgeKeeper.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .filter(\.$domain.$id == domainID)
            .sort(\.$title)
            .all()
    }

    /// Returns root pages that do not have a parent page.
    func listRoots() async throws -> [ForgeKeeper] {
        var query = ForgeKeeper.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .filter(\.$parent.$id == nil)
            .sort(\.$title)
            .all()
    }

    /// Returns the immediate child pages belonging to one parent page.
    func listChildren(of parentID: Int) async throws -> [ForgeKeeper] {
        var query = ForgeKeeper.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .filter(\.$parent.$id == parentID)
            .sort(\.$title)
            .all()
    }

    /// Returns one ForgeKeeper page by its database identifier.
    func find(id: Int) async throws -> ForgeKeeper? {
        var query = ForgeKeeper.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Saves a new page or updates an existing page.
    ///
    /// Creates a page when it has no ID or updates the existing page record.
    func save(_ page: ForgeKeeper) async throws {
        if let hubID { page.hubID = hubID }
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
