import Fluent

struct MerchantService: Sendable {
    private let database: any Database

    init(database: any Database) { self.database = database }

    /// Returns the unique merchant definitions keyed by their merchant codes.
    func list() async throws -> [Merchant] {
        try await Merchant.query(on: database)
            .sort(\.$name)
            .all()
    }
}
