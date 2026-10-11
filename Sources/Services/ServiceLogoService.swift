import Fluent

/// Provides read access to service logos stored in the existing logo table.
///
/// List and detail operations return metadata only. Binary bytes are loaded
/// only when the caller uses the explicit image endpoint.
struct ServiceLogoService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns logo records ordered by their stable display key.
    func list() async throws -> [ServiceLogoAsset] {
        try await ServiceLogoAsset.query(on: database)
            .sort(\.$logoKey)
            .all()
    }

    /// Returns one logo by its stable numeric identifier.
    func find(id: Int) async throws -> ServiceLogoAsset? {
        try await ServiceLogoAsset.find(id, on: database)
    }
}
