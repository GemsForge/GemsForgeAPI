import Crypto
import Foundation
import Fluent

struct LegacyAttachmentMigrationResult: Sendable {
    let gemHueImagesMigrated: Int
    let serviceLogosMigrated: Int
    let filesWritten: Int
}

/// Moves legacy database blobs into local media storage and records the bridge IDs.
/// The operation is repeat-safe: rows with an existing FileMetadataID are preserved.
struct LegacyAttachmentMigrationService: Sendable {
    private let database: any Database
    private let directory: URL

    init(database: any Database, directory: String) {
        self.database = database
        self.directory = URL(fileURLWithPath: directory, isDirectory: true)
            .standardizedFileURL
    }

    func migrate() async throws -> LegacyAttachmentMigrationResult {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let gemHueCount = try await migrateGemHueImages()
        let logoCount = try await migrateServiceLogos()
        return LegacyAttachmentMigrationResult(
            gemHueImagesMigrated: gemHueCount.migrated,
            serviceLogosMigrated: logoCount.migrated,
            filesWritten: gemHueCount.filesWritten + logoCount.filesWritten
        )
    }

    private func migrateGemHueImages() async throws -> (migrated: Int, filesWritten: Int) {
        let images = try await GemHueImage.query(on: database).all()
        var migrated = 0
        var filesWritten = 0
        for image in images where image.fileMetadataID == nil {
            guard let imageID = image.id else { continue }
            let metadataID = "gem-hue-image-\(imageID)"
            let relativePath = try write(data: image.image, folder: "gem-hues", id: metadataID, mimeType: image.mimeType)
            let metadata = FileMetadata(
                id: metadataID,
                relativePath: relativePath,
                fileName: image.fileName,
                fileKind: "image",
                mimeType: image.mimeType,
                byteSize: image.fileSizeBytes ?? image.image.count,
                checksum: checksum(image.image),
                ownerType: "GemHueImage",
                ownerID: String(imageID)
            )
            metadata.hubID = image.hubID
            do {
                try await metadata.save(on: database)
                image.fileMetadataID = metadataID
                try await image.save(on: database)
                migrated += 1
                filesWritten += 1
            } catch {
                try? FileManager.default.removeItem(at: path(for: relativePath))
                throw error
            }
        }
        return (migrated, filesWritten)
    }

    private func migrateServiceLogos() async throws -> (migrated: Int, filesWritten: Int) {
        let logos = try await ServiceLogoAsset.query(on: database).all()
        var migrated = 0
        var filesWritten = 0
        for logo in logos where logo.fileMetadataID == nil {
            guard let logoID = logo.id else { continue }
            let metadataID = "service-logo-\(logoID)"
            let relativePath = try write(data: logo.logo, folder: "service-icons", id: metadataID, mimeType: logo.mimeType)
            let metadata = FileMetadata(
                id: metadataID,
                relativePath: relativePath,
                fileName: logo.fileName,
                fileKind: "service-icon",
                mimeType: logo.mimeType,
                byteSize: logo.fileSizeBytes ?? logo.logo.count,
                checksum: checksum(logo.logo),
                ownerType: "ServiceLogoAsset",
                ownerID: String(logoID)
            )
            metadata.hubID = logo.hubID
            do {
                try await metadata.save(on: database)
                logo.fileMetadataID = metadataID
                try await logo.save(on: database)
                migrated += 1
                filesWritten += 1
            } catch {
                try? FileManager.default.removeItem(at: path(for: relativePath))
                throw error
            }
        }
        return (migrated, filesWritten)
    }

    private func write(data: Data, folder: String, id: String, mimeType: String) throws -> String {
        let ext = mimeType.split(separator: "/").dropFirst().first.map(String.init) ?? "bin"
        let relativePath = "migrated/\(folder)/\(id).\(ext)"
        let fileURL = path(for: relativePath)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            try data.write(to: fileURL, options: .atomic)
        }
        return relativePath
    }

    private func path(for relativePath: String) -> URL {
        directory.appendingPathComponent(relativePath).standardizedFileURL
    }

    private func checksum(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
