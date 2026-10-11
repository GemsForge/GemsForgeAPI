import Fluent

/// Defines the existing Education schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It exists so tests can reproduce the existing table safely.
struct CreateEducation: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Education.schema)
            .field("EducationID", .string, .identifier(auto: false))
            .field("EducationType", .string, .required)
            .field("InstitutionName", .string, .required)
            .field("Program", .string)
            .field("FieldOfStudy", .string)
            .field("Credential", .string)
            .field("CredentialID", .string)
            .field("StartDate", .string)
            .field("EndDate", .string)
            .field("AwardedDate", .string)
            .field("Status", .string, .required)
            .field("LocationAddressID", .string)
            .field("Website", .string)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Education.schema).delete()
    }
}
