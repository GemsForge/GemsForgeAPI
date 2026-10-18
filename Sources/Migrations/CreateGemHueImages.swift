import Fluent

/// Defines the existing Gem Hue image schema for isolated tests.
///
/// Image bytes are kept separate from the table model used by list responses.
struct CreateGemHueImages: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(GemHueImage.schema)
            .field("ImageID", .int, .identifier(auto: true))
            .field("HubID", .string)
            .field("HueID", .string, .required, .references(GemHue.schema, "HueID", onDelete: .cascade, onUpdate: .cascade))
            .field("Image", .data, .required)
            .field("MimeType", .string, .required)
            .field("FileName", .string)
            .field("FileSizeBytes", .int)
            .field("DateCreated", .datetime, .required)
            .field("DateUpdated", .datetime, .required)
            .unique(on: "HueID")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(GemHueImage.schema).delete()
    }
}
