import Fluent

/// Provides database operations for Life-area education records.
///
/// The service knows how to query and persist Education rows; route handlers
/// remain responsible for HTTP decoding, validation, and status codes.
struct EducationService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns education records ordered by start date and institution name.
    func list() async throws -> [Education] {
        try await Education.query(on: database)
            .sort(\.$startDate)
            .sort(\.$institutionName)
            .all()
    }

    /// Returns one education record by its stable EducationID.
    func find(id: String) async throws -> Education? {
        try await Education.find(id, on: database)
    }

    /// Creates or updates one education record.
    func save(_ education: Education) async throws {
        try await education.save(on: database)
    }

    /// Deletes one education record by its stable EducationID.
    func delete(id: String) async throws {
        guard let education = try await find(id: id) else {
            return
        }

        try await education.delete(on: database)
    }
}
