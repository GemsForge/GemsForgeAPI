import Fluent

/// Adds the FileMetadata reference used by HomeInventory images.
struct AddHomeInventoryAttachmentReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(HomeInventory.schema)
            .field("ImageFileMetadataID", .string)
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(HomeInventory.schema)
            .deleteField("ImageFileMetadataID")
            .update()
    }
}
