import Fluent

/// Provides read access to service logos stored in the existing logo table.
///
/// List and detail operations return metadata only. Binary bytes are loaded
/// only when the caller uses the explicit image endpoint.
struct ServiceLogoService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns logo records ordered by their stable display key.
    func list() async throws -> [ServiceLogoAsset] {
        var query = ServiceLogoAsset.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$logoKey)
            .all()
    }

    /// Returns one logo by its stable numeric identifier.
    func find(id: Int) async throws -> ServiceLogoAsset? {
        var query = ServiceLogoAsset.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }
}
