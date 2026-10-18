import Foundation
import Fluent
import Vapor

/// Maps one logo asset from the existing `ServiceLogoAssets` table.
///
/// The table currently stores legacy image bytes. The model keeps those bytes
/// available for an explicit image endpoint but does not make the model
/// `Content`, so collection and detail responses cannot accidentally embed a
/// binary blob. The future FileMetadata migration can replace that storage
/// relationship with a portable local-file reference.
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

/// Safe response metadata for a service logo.
struct ServiceLogoAssetSummary: Content {
    let id: Int
    let logoKey: String?
    let mimeType: String
    let fileName: String?
    let fileSizeBytes: Int?
    let imagePath: String

    init(_ asset: ServiceLogoAsset) throws {
        guard let id = asset.id else {
            throw Abort(.internalServerError, reason: "Service logo is missing its identifier.")
        }

        self.id = id
        self.logoKey = asset.logoKey
        self.mimeType = asset.mimeType
        self.fileName = asset.fileName
        self.fileSizeBytes = asset.fileSizeBytes ?? asset.logo.count
        self.imagePath = "/service-logos/\(id)/image"
    }
}
