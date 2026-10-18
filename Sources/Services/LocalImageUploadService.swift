import Foundation
import Fluent
import Vapor

/// Host configuration for local image uploads.
struct LocalImageUploadConfiguration: Sendable {
    let directory: String?
    let maxBytes: Int

    static func fromEnvironment() -> Self {
        let configuredDirectory = Environment.get("ASSET_DIRECTORY")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let configuredLimit = Int(Environment.get("ASSET_MAX_BYTES") ?? "")

        return Self(
            directory: configuredDirectory?.isEmpty == false ? configuredDirectory : nil,
            maxBytes: max(1, configuredLimit ?? 10 * 1024 * 1024)
        )
    }
}

struct LocalImageUploadService: Sendable {
    private let configuration: LocalImageUploadConfiguration
    private let database: any Database
    private let hubID: String?

    init(configuration: LocalImageUploadConfiguration, database: any Database, hubID: String? = nil) {
        self.configuration = configuration
        self.database = database
        self.hubID = hubID
    }

    func upload(
        file: File,
        fileKind: String,
        ownerType: String?,
        ownerID: String?,
        fileIO: FileIO
    ) async throws -> FileMetadata {
        guard let directory = configuration.directory else {
            throw Abort(.serviceUnavailable, reason: "ASSET_DIRECTORY is not configured.")
        }

        guard file.data.readableBytes > 0 else {
            throw Abort(.badRequest, reason: "An image file is required.")
        }

        guard file.data.readableBytes <= configuration.maxBytes else {
            throw Abort(.payloadTooLarge, reason: "The image exceeds the configured upload limit.")
        }

        guard let contentType = file.contentType,
              contentType.type == "image" else {
            throw Abort(.unsupportedMediaType, reason: "Only image uploads are supported.")
        }

        let originalName = file.filename.trimmingCharacters(in: .whitespacesAndNewlines)
        let safeName = originalName.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? ""
        guard !safeName.isEmpty, safeName != ".", safeName != ".." else {
            throw Abort(.badRequest, reason: "The uploaded filename is invalid.")
        }

        let normalizedKind = fileKind.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedKind.isEmpty else {
            throw Abort(.badRequest, reason: "FileKind is required.")
        }

        guard (ownerType == nil) == (ownerID == nil) else {
            throw Abort(.badRequest, reason: "OwnerType and OwnerID must be provided together.")
        }

        let uploadID = UUID().uuidString
        let extensionName = file.extension?.lowercased() ?? "bin"
        let relativePath = "uploads/\(uploadID).\(extensionName)"
        let destinationDirectory = URL(fileURLWithPath: directory).appendingPathComponent("uploads", isDirectory: true)
        let destinationURL = destinationDirectory.appendingPathComponent("\(uploadID).\(extensionName)")

        try FileManager.default.createDirectory(at: destinationDirectory, withIntermediateDirectories: true)
        try await fileIO.writeFile(file.data, at: destinationURL.path)

        let metadata = FileMetadata(
            id: uploadID,
            relativePath: relativePath,
            fileName: safeName,
            fileKind: normalizedKind,
            mimeType: contentType.serialize(),
            byteSize: file.data.readableBytes,
            ownerType: ownerType,
            ownerID: ownerID
        )
        metadata.hubID = hubID

        do {
            try await metadata.save(on: database)
        } catch {
            try? FileManager.default.removeItem(at: destinationURL)
            throw error
        }

        return metadata
    }
}
