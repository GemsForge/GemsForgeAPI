import Fluent
import Vapor

/// Provides database operations for top-level Gem Life domains.
///
/// Route handlers should call this service instead of knowing how Fluent builds
/// queries. That separation keeps HTTP concerns and persistence concerns apart.
struct DomainService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns domains in alphabetical order by title.
    func list() async throws -> [Domain] {
        try await Domain.query(on: database)
            .sort(\.$title)
            .all()
    }

    /// Finds one domain by its stable identifier.
    func find(id: String) async throws -> Domain? {
        try await Domain.find(id, on: database)
    }

    /// Saves a new domain or updates an existing domain.
    func save(_ domain: Domain) async throws {
        try await domain.save(on: database)
    }

    /// Deletes a domain by its stable identifier.
    func delete(id: String) async throws {
        guard let domain = try await find(id: id) else {
            return
        }

        try await domain.delete(on: database)
    }
}
