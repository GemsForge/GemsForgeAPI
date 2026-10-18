import Fluent

/// Defines the existing Gem Hues schema for isolated tests.
///
/// The production API does not run this migration against the personal
/// database. It exists so tests can reproduce the table shape safely.
struct CreateGemHues: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(GemHue.schema)
            .field("HueID", .string, .identifier(auto: false))
            .field("HubID", .string)
            .field("ColorName", .string, .required)
            .field("ColorFamily", .string)
            .field("HexCode", .string, .required)
            .field("Mood", .string)
            .field("Palette", .string)
            .field("Description", .string)
            .field("CreatedDate", .string)
            .field("Notes", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(GemHue.schema).delete()
    }
}
