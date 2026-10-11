import Fluent

/// Provides persistence operations for the existing `BudgetSubcategories` table.
struct ExpenseSubcategoryService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns subcategories ordered by parent category and name.
    func list(categoryID: Int? = nil) async throws -> [ExpenseSubcategory] {
        var query = ExpenseSubcategory.query(on: database)

        if let categoryID {
            query = query.filter(\.$categoryID == categoryID)
        }

        return try await query
            .sort(\.$categoryID)
            .sort(\.$name)
            .all()
    }

    /// Returns one subcategory by its stable numeric identifier.
    func find(id: Int) async throws -> ExpenseSubcategory? {
        try await ExpenseSubcategory.find(id, on: database)
    }

    /// Creates or updates one subcategory.
    func save(_ subcategory: ExpenseSubcategory) async throws {
        try await subcategory.save(on: database)
    }

    /// Deletes one subcategory; database foreign keys protect referenced records.
    func delete(id: Int) async throws {
        guard let subcategory = try await find(id: id) else {
            return
        }

        try await subcategory.delete(on: database)
    }
}
