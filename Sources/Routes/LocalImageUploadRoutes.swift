import Vapor

struct LocalImageUploadForm: Content {
    let file: File
    let fileKind: String?
    let ownerType: String?
    let ownerID: String?
}

/// Registers the local image upload workflow. Files are written to the
/// configured asset directory and represented in SQLite by FileMetadata.
func registerLocalImageUploadRoutes(
    _ app: Application,
    configuration: LocalImageUploadConfiguration
) {
    app.on(.POST, "file-uploads", body: .collect(maxSize: ByteCount(value: configuration.maxBytes + 64 * 1024))) { request async throws -> FileMetadata in
        let form = try request.content.decode(LocalImageUploadForm.self)
        return try await LocalImageUploadService(
            configuration: configuration,
            database: request.db
        ).upload(
            file: form.file,
            fileKind: form.fileKind ?? "image",
            ownerType: form.ownerType,
            ownerID: form.ownerID,
            fileIO: request.fileio
        )
    }
}
