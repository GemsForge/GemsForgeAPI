import Fluent

/// Provides persistence operations for the existing `BudgetCategories` table.
struct ExpenseCategoryService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns categories in stable alphabetical order.
    func list() async throws -> [ExpenseCategory] {
        var query = ExpenseCategory.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$name)
            .all()
    }

    /// Returns one category by its stable numeric identifier.
    func find(id: Int) async throws -> ExpenseCategory? {
        var query = ExpenseCategory.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one category.
    func save(_ category: ExpenseCategory) async throws {
        if let hubID { category.hubID = hubID }
        try await category.save(on: database)
    }

    /// Deletes one category; database foreign keys protect referenced records.
    func delete(id: Int) async throws {
        guard let category = try await find(id: id) else {
            return
        }

        try await category.delete(on: database)
    }
}
