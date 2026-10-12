import Fluent

/// Provides persistence operations for manually entered HomeInventory records.
/// Routes own HTTP decoding and validation; this service owns database access.
struct HomeInventoryService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns HomeInventory records in stable identifier order.
    func list() async throws -> [HomeInventory] {
        try await HomeInventory.query(on: database)
            .sort(\.$id)
            .all()
    }

    /// Returns one HomeInventory record by its stable InventoryID.
    func find(id: String) async throws -> HomeInventory? {
        try await HomeInventory.find(id, on: database)
    }

    /// Saves one manually entered record.
    func save(_ inventory: HomeInventory) async throws {
        try await inventory.save(on: database)
    }
}
