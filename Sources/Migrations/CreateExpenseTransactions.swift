import Fluent

/// Defines the existing Transactions schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It exists so tests can reproduce the existing table safely.
struct CreateExpenseTransactions: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ExpenseTransaction.schema)
            .field("TransactionID", .string, .identifier(auto: false))
            .field("ReceiptID", .string)
            .field("Item", .string, .required)
            .field("FirstReceiptItem", .int, .required)
            .field("CategoryID", .int, .required)
            .field("SubcategoryID", .int)
            .field("MerchantCode", .string)
            .field("TransactionDate", .string)
            .field("Quantity", .double, .required)
            .field("RegularPrice", .double)
            .field("PaidPrice", .double)
            .field("Total", .double)
            .field("Discount", .double)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ExpenseTransaction.schema).delete()
    }
}
