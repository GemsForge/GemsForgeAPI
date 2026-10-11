import Fluent

/// Defines the existing service logo schema for isolated tests.
///
/// This migration mirrors the legacy BLOB table. It is not registered against
/// the personal database while the FileMetadata relationship is being designed.
struct CreateServiceLogoAssets: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ServiceLogoAsset.schema)
            .field("LogoAssetID", .int, .identifier(auto: true))
            .field("Logo", .data, .required)
            .field("MimeType", .string, .required)
            .field("FileName", .string)
            .field("FileSizeBytes", .int)
            .field("DateCreated", .datetime, .required)
            .field("DateUpdated", .datetime, .required)
            .field("LogoKey", .string)
            .unique(on: "LogoKey")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ServiceLogoAsset.schema).delete()
    }
}
