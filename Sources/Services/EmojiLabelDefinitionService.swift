import Fluent

/// Provides persistence operations for reusable emoji label definitions.
struct EmojiLabelDefinitionService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns active labels by default; local administration can request all labels.
    func list(includeInactive: Bool = false) async throws -> [EmojiLabelDefinition] {
        var query = EmojiLabelDefinition.query(on: database)

        if !includeInactive {
            query = query.filter(\.$isActive == true)
        }

        return try await query
            .sort(\.$label)
            .all()
    }

    /// Returns one label definition by its stable numeric identifier.
    func find(id: Int) async throws -> EmojiLabelDefinition? {
        try await EmojiLabelDefinition.find(id, on: database)
    }

    /// Creates or updates one label definition.
    func save(_ definition: EmojiLabelDefinition) async throws {
        try await definition.save(on: database)
    }

    /// Deletes one label definition.
    func delete(id: Int) async throws {
        guard let definition = try await find(id: id) else {
            return
        }

        try await definition.delete(on: database)
    }
}
