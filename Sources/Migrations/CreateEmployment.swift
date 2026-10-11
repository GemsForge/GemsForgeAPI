import Fluent

/// Defines the existing Employment schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It exists so tests can reproduce the existing table safely.
struct CreateEmployment: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Employment.schema)
            .field("EmploymentID", .string, .identifier(auto: false))
            .field("EmployerName", .string, .required)
            .field("EmployerType", .string, .required)
            .field("Industry", .string)
            .field("Website", .string)
            .field("PositionTitle", .string, .required)
            .field("EmploymentType", .string, .required)
            .field("StartDate", .string)
            .field("EndDate", .string)
            .field("EmploymentStatus", .string, .required)
            .field("WorkAddressID", .string)
            .field("EmployerContact", .string)
            .field("EmployerContactNumber", .string)
            .field("EmployerContactEmail", .string)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Employment.schema).delete()
    }
}
