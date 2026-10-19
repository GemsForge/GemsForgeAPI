import Fluent

/// Provides persistence operations for documented expense transactions.
///
/// The service owns database queries while routes remain responsible for HTTP
/// decoding, validation, and status codes.
struct ExpenseTransactionService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns transactions ordered by date and stable transaction ID.
    func list() async throws -> [ExpenseTransaction] {
        var query = ExpenseTransaction.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$transactionDate)
            .sort(\.$id)
            .all()
    }

    /// Returns one transaction by its stable TransactionID.
    func find(id: String) async throws -> ExpenseTransaction? {
        var query = ExpenseTransaction.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one transaction.
    func save(_ transaction: ExpenseTransaction) async throws {
        if let hubID { transaction.hubID = hubID }
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
