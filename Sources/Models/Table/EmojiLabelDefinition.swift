import Fluent
import Vapor

/// Represents a reusable presentation label for taxonomy and UI surfaces.
///
/// Emoji labels are reference data. They do not define the identity of a
/// category or subcategory, and can be deactivated without deleting history.
final class EmojiLabelDefinition: Model, Content, @unchecked Sendable {
    static let schema = "EmojiLabelDefinitions"

    @ID(custom: "EmojiLabelID")
    var id: Int?

    @Field(key: "Label")
    var label: String

    @Field(key: "Emoji")
    var emoji: String

    @OptionalField(key: "Description")
    var description: String?

    @Field(key: "IsActive")
    var isActive: Bool

    init() {}

    init(
        id: Int? = nil,
        label: String,
        emoji: String,
        description: String? = nil,
        isActive: Bool = true
    ) {
        self.id = id
        self.label = label
        self.emoji = emoji
        self.description = description
        self.isActive = isActive
    }
}
