import Foundation
import Vapor

/// Registers the safe binary-content endpoint for locally stored files.
///
/// FileMetadata stores a portable relative path. This route is the only place
/// that resolves that path against the configured local asset directory, so
/// absolute paths never cross the API boundary and `..` cannot escape storage.
func registerFileContentRoutes(
    _ app: Application,
    configuration: LocalImageUploadConfiguration
) {
    app.get("file-metadata", ":id", "content") { request async throws -> Response in
        guard let id = request.parameters.get("id"),
              let metadata = try await FileMetadataService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return try await streamFileMetadataContent(
            metadata,
            request: request,
            configuration: configuration
        )
    }
}

/// Streams a FileMetadata record from the configured local asset directory.
/// Callers use this for domain-specific routes while preserving one path-safety
/// implementation for all locally stored files.
func streamFileMetadataContent(
    _ metadata: FileMetadata,
    request: Request,
    configuration: LocalImageUploadConfiguration
) async throws -> Response {
    guard let directory = configuration.directory else {
        throw Abort(.serviceUnavailable, reason: "ASSET_DIRECTORY is not configured.")
    }

    let root = URL(fileURLWithPath: directory).standardizedFileURL
    let requestedURL = root.appendingPathComponent(metadata.relativePath).standardizedFileURL
    guard requestedURL.path.hasPrefix(root.path + "/") else {
        throw Abort(.forbidden, reason: "The file path is outside the configured asset directory.")
    }

    guard FileManager.default.fileExists(atPath: requestedURL.path) else {
        throw Abort(.notFound)
    }

    let mediaTypeParts = metadata.mimeType.split(separator: "/", maxSplits: 1).map(String.init)
    let mediaType = mediaTypeParts.count == 2
        ? HTTPMediaType(type: mediaTypeParts[0], subType: mediaTypeParts[1])
        : nil
    return try await request.fileio.asyncStreamFile(
        at: requestedURL.path,
        mediaType: mediaType
    )
}
