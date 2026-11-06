import Foundation
import Fluent

/// Maps a retained legacy catalog row for logo-reference backfill and BLOB migration.
final class ServiceLogoAsset: Model, @unchecked Sendable {
    static let schema = "ServiceLogoAssets"

    @ID(custom: "LogoAssetID")
    var id: Int?

    @OptionalField(key: "HubID")
    var hubID: String?

    @Field(key: "Logo")
    var logo: Data

    @Field(key: "MimeType")
    var mimeType: String

    @OptionalField(key: "FileName")
    var fileName: String?

    @OptionalField(key: "FileSizeBytes")
    var fileSizeBytes: Int?

    @Timestamp(key: "DateCreated", on: .create)
    var createdAt: Date?

    @Timestamp(key: "DateUpdated", on: .update)
    var updatedAt: Date?

    @OptionalField(key: "LogoKey")
    var logoKey: String?

    /// New local-file reference populated by the legacy logo migration.
    @OptionalField(key: "FileMetadataID")
    var fileMetadataID: String?

    init() {}
}
