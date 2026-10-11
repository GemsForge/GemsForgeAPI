import Fluent

/// Provides persistence operations for recurring Service Account records.
///
/// Service Accounts identify services that can generate recurring expenses;
/// individual purchases remain in the separate Transactions table.
struct ServiceAccountService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns Service Accounts ordered by display name.
    func list() async throws -> [ServiceAccount] {
        try await ServiceAccount.query(on: database)
            .sort(\.$service)
            .all()
    }

    /// Returns one Service Account by its stable ServiceID.
    func find(id: Int) async throws -> ServiceAccount? {
        try await ServiceAccount.find(id, on: database)
    }

    /// Creates or updates one Service Account.
    func save(_ account: ServiceAccount) async throws {
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
