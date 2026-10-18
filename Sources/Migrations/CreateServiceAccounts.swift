import Fluent

/// Defines the existing Services schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It mirrors the existing table so Service Account behavior can be
/// tested without changing real records.
struct CreateServiceAccounts: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema)
            .field("ServiceID", .int, .identifier(auto: true))
            .field("Service", .string, .required)
            .field("LogoKey", .string)
            .field("Type", .string)
            .field("ExpenseGroup", .string)
            .field("MonthlyAmount", .double)
            .field("InterestRate", .double)
            .field("APR", .double)
            .field("Due", .string)
            .field("Occurrence", .string)
            .field("Status", .string)
            .field("Since", .string)
            .field("Website", .string)
            .field("Notes", .string)
            .field("NotionPage", .string)
            .field("PaymentMethod", .string)
            .field("AccountNumber", .string)
            .field("EmailUpdated", .string)
            .field("AssociatedAddress", .string)
            .field("ServiceKey", .string)
            .field("DateUpdated", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema).delete()
    }
}
