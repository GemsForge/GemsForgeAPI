import Fluent

/// Defines the reusable emoji-label registry for isolated tests.
struct CreateEmojiLabelDefinitions: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(EmojiLabelDefinition.schema)
            .field("EmojiLabelID", .int, .identifier(auto: true))
            .field("HubID", .string)
            .field("Label", .string, .required)
            .field("Emoji", .string, .required)
            .field("Description", .string)
            .field("IsActive", .bool, .required)
            .unique(on: "Label")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(EmojiLabelDefinition.schema).delete()
    }
}
