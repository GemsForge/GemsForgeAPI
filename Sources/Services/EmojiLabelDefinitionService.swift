import Fluent

/// Provides persistence operations for reusable emoji label definitions.
struct EmojiLabelDefinitionService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns active labels by default; local administration can request all labels.
    func list(includeInactive: Bool = false) async throws -> [EmojiLabelDefinition] {
        var query = EmojiLabelDefinition.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }

        if !includeInactive {
            query = query.filter(\.$isActive == true)
        }

        return try await query
            .sort(\.$label)
            .all()
    }

    /// Returns one label definition by its stable numeric identifier.
    func find(id: Int) async throws -> EmojiLabelDefinition? {
        var query = EmojiLabelDefinition.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one label definition.
    func save(_ definition: EmojiLabelDefinition) async throws {
        if let hubID { definition.hubID = hubID }
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
