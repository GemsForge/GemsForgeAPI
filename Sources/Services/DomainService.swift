import Fluent
import Vapor

/// Provides database operations for top-level Gem Life domains.
///
/// Route handlers should call this service instead of knowing how Fluent builds
/// queries. That separation keeps HTTP concerns and persistence concerns apart.
///
/// Example:
/// ```swift
/// let service = DomainService(database: request.db)
/// let domains = try await service.list()
/// ```
struct DomainService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns all top-level Gem Life domains in alphabetical order by title.
    func list() async throws -> [Domain] {
        try await Domain.query(on: database)
            .sort(\.$title)
            .all()
    }

    /// Returns one top-level domain by its stable identifier.
    func find(id: String) async throws -> Domain? {
        try await Domain.find(id, on: database)
    }

    /// Creates a domain or updates an existing domain record.
    func save(_ domain: Domain) async throws {
        try await domain.save(on: database)
    }

    /// Deletes one domain by its stable identifier.
    func delete(id: String) async throws {
        guard let domain = try await find(id: id) else {
            return
        }

        try await domain.delete(on: database)
    }
}
