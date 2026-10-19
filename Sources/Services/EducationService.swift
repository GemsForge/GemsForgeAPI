import Fluent

/// Provides database operations for Life-area education records.
///
/// The service knows how to query and persist Education rows; route handlers
/// remain responsible for HTTP decoding, validation, and status codes.
struct EducationService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns education records ordered by start date and institution name.
    func list() async throws -> [Education] {
        var query = Education.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$startDate)
            .sort(\.$institutionName)
            .all()
    }

    /// Returns one education record by its stable EducationID.
    func find(id: String) async throws -> Education? {
        var query = Education.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one education record.
    func save(_ education: Education) async throws {
        if let hubID { education.hubID = hubID }
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
