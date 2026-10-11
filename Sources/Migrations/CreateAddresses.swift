import Fluent

/// Defines the existing Addresses schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It exists so tests can reproduce the existing table safely.
struct CreateAddresses: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Address.schema)
            .field("AddressID", .string, .identifier(auto: false))
            .field("AddressType", .string, .required)
            .field("AddressLine1", .string)
            .field("AddressLine2", .string)
            .field("City", .string)
            .field("State", .string)
            .field("PostalCode", .string)
            .field("Country", .string, .required)
            .field("StartDate", .string)
            .field("EndDate", .string)
            .field("AddressStatus", .string, .required)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Address.schema).delete()
    }
}
