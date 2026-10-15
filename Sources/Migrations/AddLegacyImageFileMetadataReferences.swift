import Fluent

/// Adds the optional FileMetadata reference used to migrate Gem Hue image blobs.
struct AddGemHueImageFileMetadataReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(GemHueImage.schema)
            .field("FileMetadataID", .string)
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(GemHueImage.schema)
            .deleteField("FileMetadataID")
            .update()
    }
}

/// Adds the optional FileMetadata reference used to migrate service logo blobs.
struct AddServiceLogoFileMetadataReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ServiceLogoAsset.schema)
            .field("FileMetadataID", .string)
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ServiceLogoAsset.schema)
            .deleteField("FileMetadataID")
            .update()
    }
}
