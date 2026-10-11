import Fluent

/// Defines FileMetadata for isolated tests.
///
/// The production API does not run this migration against the personal
/// database until the schema change is deliberately reviewed and applied.
struct CreateFileMetadata: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(FileMetadata.schema)
            .field("FileMetadataID", .string, .identifier(auto: false))
            .field("RelativePath", .string, .required)
            .field("FileName", .string)
            .field("FileKind", .string, .required)
            .field("MimeType", .string, .required)
            .field("ByteSize", .int)
            .field("Checksum", .string)
            .field("OwnerType", .string)
            .field("OwnerID", .string)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(FileMetadata.schema).delete()
    }
}
