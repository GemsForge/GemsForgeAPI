import Fluent

/// Provides persistence operations for the existing `BudgetSubcategories` table.
struct ExpenseSubcategoryService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns subcategories ordered by parent category and name.
    func list(categoryID: Int? = nil) async throws -> [ExpenseSubcategory] {
        var query = ExpenseSubcategory.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }

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
        var query = ExpenseSubcategory.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one subcategory.
    func save(_ subcategory: ExpenseSubcategory) async throws {
        if let hubID { subcategory.hubID = hubID }
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
