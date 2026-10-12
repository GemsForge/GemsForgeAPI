import Fluent
import Vapor

/// Validates and assigns FileMetadata references without exposing filesystem paths.
struct AttachmentReferenceService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    /// Attaches a metadata record to one owner, or clears the reference when nil.
    func attach(
        metadataID: String?,
        ownerType: String,
        ownerID: String
    ) async throws -> FileMetadata? {
        guard let metadataID = metadataID?.trimmingCharacters(in: .whitespacesAndNewlines), !metadataID.isEmpty else {
            return nil
        }

        guard let metadata = try await FileMetadata.find(metadataID, on: database) else {
            throw Abort(.unprocessableEntity, reason: "The referenced file metadata does not exist.")
        }

        if let existingType = metadata.ownerType,
           let existingID = metadata.ownerID,
           (existingType != ownerType || existingID != ownerID) {
            throw Abort(.conflict, reason: "The file metadata is already attached to another record.")
        }

        metadata.ownerType = ownerType
        metadata.ownerID = ownerID
        try await metadata.save(on: database)
        return metadata
    }

    /// Moves ownership to a replacement before detaching the previous reference.
    func replace(
        oldMetadataID: String?,
        newMetadataID: String?,
        ownerType: String,
        ownerID: String
    ) async throws {
        if oldMetadataID == newMetadataID { return }
        _ = try await attach(metadataID: newMetadataID, ownerType: ownerType, ownerID: ownerID)

        if let oldID = oldMetadataID,
           let oldMetadata = try await FileMetadata.find(oldID, on: database),
           oldMetadata.ownerType == ownerType,
           oldMetadata.ownerID == ownerID {
            oldMetadata.ownerType = nil
            oldMetadata.ownerID = nil
            try await oldMetadata.save(on: database)
        }
    }
}
