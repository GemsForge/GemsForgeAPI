import Fluent
import Vapor

/// Represents one of the four top-level Gem Life domains.
///
/// This model maps to the existing `domains` table. It describes the major
/// areas of the personal operating system; it does not store individual
/// records such as expenses, services, or employment history.
final class Domain: Model, Content, @unchecked Sendable {
    // Fluent uses this value to map the model to the SQLite table.
    static let schema = "domains"

    // The database uses stable values such as POS, FOUNDATION, LIFE, and KNOWLEDGE.
    @ID(custom: "id")
    var id: String?

    // The human-readable name of the domain, such as "Life".
    @Field(key: "title")
    var title: String

    // A short explanation of what information belongs in the domain.
    @Field(key: "description")
    var description: String

    // Optional notes provide additional context without changing the core definition.
    @OptionalField(key: "notes")
    var notes: String?

    // Fluent fills these automatically when a record is created or updated.
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    /// Creates a domain with values that can be stored in the database.
    init(
        id: String? = nil,
        title: String,
        description: String,
        notes: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.notes = notes
    }
}
