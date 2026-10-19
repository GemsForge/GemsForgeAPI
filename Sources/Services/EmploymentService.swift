import Fluent

/// Provides database operations for Life-area employment records.
///
/// The service owns persistence queries while route handlers remain responsible
/// for HTTP decoding, validation, and status codes.
struct EmploymentService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns employment records ordered by start date and employer name.
    func list() async throws -> [Employment] {
        var query = Employment.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$startDate)
            .sort(\.$employerName)
            .all()
    }

    /// Returns one employment record by its stable EmploymentID.
    func find(id: String) async throws -> Employment? {
        var query = Employment.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one employment record.
    func save(_ employment: Employment) async throws {
        if let hubID { employment.hubID = hubID }
        try await employment.save(on: database)
    }

    /// Deletes one employment record by its stable EmploymentID.
    func delete(id: String) async throws {
        guard let employment = try await find(id: id) else {
            return
        }

        try await employment.delete(on: database)
    }
}
