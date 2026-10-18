import Fluent

/// Provides database operations for Life-area address records.
///
/// Response privacy is handled by route DTOs; this service works with the full
/// table model so persistence logic remains complete and reusable.
struct AddressService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns address records ordered by status, city, and stable identifier.
    func list() async throws -> [Address] {
        var query = Address.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$addressStatus)
            .sort(\.$city)
            .sort(\.$id)
            .all()
    }

    /// Returns one address record by its stable AddressID.
    func find(id: String) async throws -> Address? {
        var query = Address.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one address record.
    func save(_ address: Address) async throws {
        if let hubID { address.hubID = hubID }
        try await address.save(on: database)
    }

    /// Deletes one address record by its stable AddressID.
    func delete(id: String) async throws {
        guard let address = try await find(id: id) else {
            return
        }

        try await address.delete(on: database)
    }
}
