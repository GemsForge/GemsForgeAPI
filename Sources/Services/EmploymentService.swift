import Fluent

/// Provides database operations for Life-area employment records.
///
/// The service owns persistence queries while route handlers remain responsible
/// for HTTP decoding, validation, and status codes.
struct EmploymentService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns employment records ordered by start date and employer name.
    func list() async throws -> [Employment] {
        try await Employment.query(on: database)
            .sort(\.$startDate)
            .sort(\.$employerName)
            .all()
    }

    /// Returns one employment record by its stable EmploymentID.
    func find(id: String) async throws -> Employment? {
        try await Employment.find(id, on: database)
    }

    /// Creates or updates one employment record.
    func save(_ employment: Employment) async throws {
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
