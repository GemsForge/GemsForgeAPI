import Fluent

/// Provides persistence operations for the existing `BudgetCategories` table.
struct ExpenseCategoryService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns categories in stable alphabetical order.
    func list() async throws -> [ExpenseCategory] {
        try await ExpenseCategory.query(on: database)
            .sort(\.$name)
            .all()
    }

    /// Returns one category by its stable numeric identifier.
    func find(id: Int) async throws -> ExpenseCategory? {
        try await ExpenseCategory.find(id, on: database)
    }

    /// Creates or updates one category.
    func save(_ category: ExpenseCategory) async throws {
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
