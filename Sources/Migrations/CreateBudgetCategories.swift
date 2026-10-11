import Fluent

/// Defines the existing BudgetCategories schema for isolated tests.
struct CreateBudgetCategories: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ExpenseCategory.schema)
            .field("CategoryID", .int, .identifier(auto: true))
            .field("Category", .string, .required)
            .unique(on: "Category")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ExpenseCategory.schema).delete()
    }
}
