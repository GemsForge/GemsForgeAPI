import Fluent

/// Provides persistence operations for local-file metadata records.
///
/// This service stores metadata only. It does not read, write, move, or delete
/// files on disk; those filesystem operations belong to the later upload
/// workflow after its security boundary is defined.
struct FileMetadataService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Returns metadata records ordered by file kind and name.
    func list() async throws -> [FileMetadata] {
        try await FileMetadata.query(on: database)
            .sort(\.$fileKind)
            .sort(\.$fileName)
            .all()
    }

    /// Returns one metadata record by its stable identifier.
    func find(id: String) async throws -> FileMetadata? {
        try await FileMetadata.find(id, on: database)
    }

    /// Creates or updates one metadata record.
    func save(_ metadata: FileMetadata) async throws {
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
