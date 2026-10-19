import Fluent

/// Provides persistence operations for manually entered HomeInventory records.
/// Routes own HTTP decoding and validation; this service owns database access.
struct HomeInventoryService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns HomeInventory records in stable identifier order.
    func list() async throws -> [HomeInventory] {
        var query = HomeInventory.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$id)
            .all()
    }

    /// Returns one HomeInventory record by its stable InventoryID.
    func find(id: String) async throws -> HomeInventory? {
        var query = HomeInventory.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Saves one manually entered record.
    func save(_ inventory: HomeInventory) async throws {
        if let hubID { inventory.hubID = hubID }
        try await inventory.save(on: database)
    }
}
