import Foundation
import Vapor

/// The fields accepted when creating or replacing file metadata.
struct FileMetadataRequest: Content {
    let id: String?
    let relativePath: String
    let fileName: String?
    let fileKind: String
    let mimeType: String
    let byteSize: Int?
    let checksum: String?
    let ownerType: String?
    let ownerID: String?
}

private func validate(_ input: FileMetadataRequest) throws {
    let path = input.relativePath.trimmingCharacters(in: .whitespacesAndNewlines)
    let fileKind = input.fileKind.trimmingCharacters(in: .whitespacesAndNewlines)
    let mimeType = input.mimeType.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !path.isEmpty, !path.hasPrefix("/"), !path.split(separator: "/").contains("..") else {
        throw Abort(.badRequest, reason: "RelativePath must be a non-empty portable path.")
    }

    guard !fileKind.isEmpty, mimeType.contains("/") else {
        throw Abort(.badRequest, reason: "FileKind and a valid MimeType are required.")
    }

    if let byteSize = input.byteSize, byteSize < 0 {
        throw Abort(.badRequest, reason: "ByteSize cannot be negative.")
    }

    guard (input.ownerType == nil) == (input.ownerID == nil) else {
        throw Abort(.badRequest, reason: "OwnerType and OwnerID must be provided together.")
    }
}

private func makeMetadata(from input: FileMetadataRequest, id: String) -> FileMetadata {
    FileMetadata(
        id: id,
        relativePath: input.relativePath.trimmingCharacters(in: .whitespacesAndNewlines),
        fileName: input.fileName,
        fileKind: input.fileKind.trimmingCharacters(in: .whitespacesAndNewlines),
        mimeType: input.mimeType.trimmingCharacters(in: .whitespacesAndNewlines),
        byteSize: input.byteSize,
        checksum: input.checksum,
        ownerType: input.ownerType,
        ownerID: input.ownerID
    )
}

/// Registers metadata CRUD routes without performing filesystem operations.
func registerFileMetadataRoutes(_ app: Application) {
    let files = app.grouped("file-metadata")

    files.get { request async throws -> [FileMetadata] in
        // Returns file descriptions; it never loads binary file contents.
        try await FileMetadataService(database: request.db).list()
    }

    files.post { request async throws -> FileMetadata in
        let input = try request.content.decode(FileMetadataRequest.self)
        try validate(input)
        let providedID = input.id?.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = providedID?.isEmpty == false ? providedID! : UUID().uuidString

        if try await FileMetadataService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "File metadata with this ID already exists.")
        }

        let metadata = makeMetadata(from: input, id: id)
        try await FileMetadataService(database: request.db).save(metadata)
        return metadata
    }

    files.get(":id") { request async throws -> FileMetadata in
        guard let id = request.parameters.get("id"),
              let metadata = try await FileMetadataService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return metadata
    }

    files.put(":id") { request async throws -> FileMetadata in
        guard let id = request.parameters.get("id"),
              let metadata = try await FileMetadataService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(FileMetadataRequest.self)
        try validate(input)
        let replacement = makeMetadata(from: input, id: id)
        metadata.relativePath = replacement.relativePath
        metadata.fileName = replacement.fileName
        metadata.fileKind = replacement.fileKind
        metadata.mimeType = replacement.mimeType
        metadata.byteSize = replacement.byteSize
        metadata.checksum = replacement.checksum
        metadata.ownerType = replacement.ownerType
        metadata.ownerID = replacement.ownerID
        try await FileMetadataService(database: request.db).save(metadata)
        return metadata
    }

    files.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await FileMetadataService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        // Deleting metadata deliberately does not delete the referenced file.
        try await FileMetadataService(database: request.db).delete(id: id)
        return .noContent
    }
}
