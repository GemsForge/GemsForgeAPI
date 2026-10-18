import Fluent

/// Provides persistence operations for local-file metadata records.
///
/// This service stores metadata only. It does not read, write, move, or delete
/// files on disk; those filesystem operations belong to the later upload
/// workflow after its security boundary is defined.
struct FileMetadataService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
    }

    /// Returns metadata records ordered by file kind and name.
    func list() async throws -> [FileMetadata] {
        var query = FileMetadata.query(on: database)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query
            .sort(\.$fileKind)
            .sort(\.$fileName)
            .all()
    }

    /// Returns one metadata record by its stable identifier.
    func find(id: String) async throws -> FileMetadata? {
        var query = FileMetadata.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }

    /// Creates or updates one metadata record.
    func save(_ metadata: FileMetadata) async throws {
        if let hubID { metadata.hubID = hubID }
        try await metadata.save(on: database)
    }

    /// Deletes one metadata record without touching the referenced file.
    func delete(id: String) async throws {
        guard let metadata = try await find(id: id) else {
            return
        }

        try await metadata.delete(on: database)
    }
}
