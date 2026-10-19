import Fluent

/// Provides read operations for Gem Hues and their associated image records.
///
/// This service maps existing database records. It does not create tables or
/// decide how Gem Hues relate to the Foundation domain.
struct GemHueService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns the Gem Hues ordered by color name.
    func list() async throws -> [GemHue] {
        var query = GemHue.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$colorName)
            .all()
    }

    /// Returns one Gem Hue by its stable HueID.
    func find(id: String) async throws -> GemHue? {
        var query = GemHue.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates a Gem Hue or updates an existing record.
    func save(_ hue: GemHue) async throws {
        try await hue.save(on: database)
    }

    /// Returns the image record associated with one Gem Hue, if present.
    func findImage(hueID: String) async throws -> GemHueImage? {
        var query = GemHueImage.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .filter(\.$hue.$id == hueID)
            .first()
    }
}
