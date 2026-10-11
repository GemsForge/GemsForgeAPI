import Fluent

/// Defines the existing BudgetSubcategories schema for isolated tests.
struct CreateBudgetSubcategories: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ExpenseSubcategory.schema)
            .field("SubcategoryID", .int, .identifier(auto: true))
            .field("CategoryID", .int, .required)
            .field("Subcategory", .string, .required)
            .unique(on: "CategoryID", "Subcategory")
            .foreignKey(
                ["CategoryID"],
                references: ExpenseCategory.schema,
                ["CategoryID"],
                onDelete: .restrict
            )
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ExpenseSubcategory.schema).delete()
    }
}
