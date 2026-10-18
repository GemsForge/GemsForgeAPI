import Fluent

/// Provides persistence operations for recurring Service Account records.
///
/// Service Accounts identify services that can generate recurring expenses;
/// individual purchases remain in the separate Transactions table.
struct ServiceAccountService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns Service Accounts ordered by display name.
    func list() async throws -> [ServiceAccount] {
        var query = ServiceAccount.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$service)
            .all()
    }

    /// Returns one Service Account by its stable ServiceID.
    func find(id: Int) async throws -> ServiceAccount? {
        var query = ServiceAccount.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one Service Account.
    func save(_ account: ServiceAccount) async throws {
        if let hubID { account.hubID = hubID }
        try await account.save(on: database)
    }

    /// Deletes one Service Account by its stable ServiceID.
    func delete(id: Int) async throws {
        guard let account = try await find(id: id) else {
            return
        }

        try await account.delete(on: database)
    }
}
