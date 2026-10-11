import Fluent

/// Provides persistence operations for documented expense transactions.
///
/// The service owns database queries while routes remain responsible for HTTP
/// decoding, validation, and status codes.
struct ExpenseTransactionService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns transactions ordered by date and stable transaction ID.
    func list() async throws -> [ExpenseTransaction] {
        try await ExpenseTransaction.query(on: database)
            .sort(\.$transactionDate)
            .sort(\.$id)
            .all()
    }

    /// Returns one transaction by its stable TransactionID.
    func find(id: String) async throws -> ExpenseTransaction? {
        try await ExpenseTransaction.find(id, on: database)
    }

    /// Creates or updates one transaction.
    func save(_ transaction: ExpenseTransaction) async throws {
        try await transaction.save(on: database)
    }

    /// Deletes one transaction by its stable TransactionID.
    func delete(id: String) async throws {
        guard let transaction = try await find(id: id) else {
            return
        }

        try await transaction.delete(on: database)
    }
}
