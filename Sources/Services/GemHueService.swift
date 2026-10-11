import Fluent

/// Provides read operations for Gem Hues and their associated image records.
///
/// This service maps existing database records. It does not create tables or
/// decide how Gem Hues relate to the Foundation domain.
struct GemHueService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns the Gem Hues ordered by color name.
    func list() async throws -> [GemHue] {
        try await GemHue.query(on: database)
            .sort(\.$colorName)
            .all()
    }

    /// Returns one Gem Hue by its stable HueID.
    func find(id: String) async throws -> GemHue? {
        try await GemHue.find(id, on: database)
    }

    /// Returns the image record associated with one Gem Hue, if present.
    func findImage(hueID: String) async throws -> GemHueImage? {
        try await GemHueImage.query(on: database)
            .filter(\.$hue.$id == hueID)
            .first()
    }
}
