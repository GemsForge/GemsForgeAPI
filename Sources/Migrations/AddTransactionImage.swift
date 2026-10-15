import Fluent

/// Adds the nullable FileMetadata reference used by Transactions.Image.
///
/// This is intentionally separate from `CreateExpenseTransactions`: the
/// personal database already exists, so adding a column is a schema change,
/// not a request to recreate the Transactions table.
struct AddTransactionImage: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ExpenseTransaction.schema)
            .field("Image", .string, .references(
                FileMetadata.schema, "FileMetadataID", onDelete: .setNull, onUpdate: .cascade
            ))
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ExpenseTransaction.schema)
            .deleteField("Image")
            .update()
    }
}
