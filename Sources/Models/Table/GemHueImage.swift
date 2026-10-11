import Foundation
import Fluent

/// An image blob associated with one Gem Hue.
///
/// Images live in the separate `GemHueImages` table so regular Gem Hue list
/// queries do not need to load binary data. The image model is intentionally
/// not `Content`; API responses should use a purpose-built DTO or image route.
final class GemHueImage: Model, @unchecked Sendable {
    // Matches the existing image table name in GemLife_DB_rebuild.sqlite.
    static let schema = "GemHueImages"

    @ID(custom: "ImageID")
    var id: Int?

    @Parent(key: "HueID")
    var hue: GemHue

    @Field(key: "Image")
    var image: Data

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

    init() {}
}
