import Fluent

/// Provides database operations for Life-area address records.
///
/// Response privacy is handled by route DTOs; this service works with the full
/// table model so persistence logic remains complete and reusable.
struct AddressService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns address records ordered by status, city, and stable identifier.
    func list() async throws -> [Address] {
        try await Address.query(on: database)
            .sort(\.$addressStatus)
            .sort(\.$city)
            .sort(\.$id)
            .all()
    }

    /// Returns one address record by its stable AddressID.
    func find(id: String) async throws -> Address? {
        try await Address.find(id, on: database)
    }

    /// Creates or updates one address record.
    func save(_ address: Address) async throws {
        address.updatedAt = RecordTimestamp.now()
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
