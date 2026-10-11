import Fluent
import Vapor

/// Describes a local file without embedding its binary contents in SQLite.
///
/// `relativePath` is intentionally portable. It is resolved against a local
/// asset directory configured by the host application; machine-specific
/// absolute paths never belong in this record.
final class FileMetadata: Model, Content, @unchecked Sendable {
    static let schema = "FileMetadata"

    @ID(custom: "FileMetadataID")
    var id: String?

    @Field(key: "RelativePath")
    var relativePath: String

    @OptionalField(key: "FileName")
    var fileName: String?

    @Field(key: "FileKind")
    var fileKind: String

    @Field(key: "MimeType")
    var mimeType: String

    @OptionalField(key: "ByteSize")
    var byteSize: Int?

    @OptionalField(key: "Checksum")
    var checksum: String?

    @OptionalField(key: "OwnerType")
    var ownerType: String?

    @OptionalField(key: "OwnerID")
    var ownerID: String?

    init() {}

    init(
        id: String? = nil,
        relativePath: String,
        fileName: String? = nil,
        fileKind: String,
        mimeType: String,
        byteSize: Int? = nil,
        checksum: String? = nil,
        ownerType: String? = nil,
        ownerID: String? = nil
    ) {
        self.id = id
        self.relativePath = relativePath
        self.fileName = fileName
        self.fileKind = fileKind
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.checksum = checksum
        self.ownerType = ownerType
        self.ownerID = ownerID
    }
}
