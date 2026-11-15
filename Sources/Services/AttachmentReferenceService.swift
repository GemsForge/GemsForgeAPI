import Foundation
import Fluent
import SQLKit
import Vapor

/// Validates and assigns FileMetadata references without exposing filesystem paths.
struct AttachmentReferenceService: Sendable {
    private let database: any Database
    private let hubID: String?

    init(database: any Database, hubID: String? = nil) {
        self.database = database
        self.hubID = hubID
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

        var query = FileMetadata.query(on: database).filter(\.$id == metadataID)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        guard let metadata = try await query.first() else {
            throw Abort(.unprocessableEntity, reason: "The referenced file metadata does not exist.")
        }

        if let existingType = metadata.ownerType,
           let existingID = metadata.ownerID,
           (existingType != ownerType || existingID != ownerID) {
            throw Abort(.conflict, reason: "The file metadata is already attached to another record.")
        }

        metadata.ownerType = ownerType
        metadata.ownerID = ownerID
        if let hubID { metadata.hubID = hubID }
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
           let oldMetadata = try await find(id: oldID),
           oldMetadata.ownerType == ownerType,
           oldMetadata.ownerID == ownerID {
            oldMetadata.ownerType = nil
            oldMetadata.ownerID = nil
            try await oldMetadata.save(on: database)
        }
    }

    /// Counts Markdown image links that still reference the file-content route.
    func bodyReferenceCount(metadataID: String) async throws -> Int {
        guard let sql = database as? SQLDatabase else { return 0 }
        let bodyTable = try await sql.raw(SQLQueryString(stringLiteral: """
            SELECT 1 AS present FROM sqlite_master
            WHERE type = 'table' AND name = 'RecordBodies'
            LIMIT 1
            """)).first()
        guard bodyTable != nil else { return 0 }

        var query = SQLQueryString("SELECT \(ident: "HubID"), \(ident: "Markdown") FROM \(ident: RecordBody.schema) WHERE ")
        if let hubID {
            query.appendInterpolation(ident: "HubID")
            query.appendInterpolation(unsafeRaw: " = ")
            query.appendInterpolation(bind: hubID)
        } else {
            query.appendInterpolation(unsafeRaw: "1 = 1")
        }
        let rows = try await sql.raw(query).all()
        let metadataHubID = try await find(id: metadataID)?.hubID
        return try rows.reduce(into: 0) { count, row in
            if let metadataHubID,
               try row.decode(column: "HubID", as: String.self) != metadataHubID { return }
            let markdown = try row.decode(column: "Markdown", as: String.self)
            count += recordBodyImageReferenceCount(in: markdown, metadataID: metadataID)
        }
    }

    private func find(id: String) async throws -> FileMetadata? {
        var query = FileMetadata.query(on: database).filter(\.$id == id)
        if let hubID { query = query.filter(\.$hubID == hubID) }
        return try await query.first()
    }
}

private func recordBodyImageReferenceCount(in markdown: String, metadataID: String) -> Int {
    guard let expression = try? NSRegularExpression(
        pattern: #"!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\s*\)"#
    ) else { return 0 }

    let source = markdown as NSString
    var count = expression.matches(in: markdown, range: NSRange(location: 0, length: source.length)).reduce(into: 0) { count, match in
        let range = match.range(at: 1).location == NSNotFound ? match.range(at: 2) : match.range(at: 1)
        if range.location != NSNotFound, isRecordBodyFileURL(source.substring(with: range), metadataID: metadataID) {
            count += 1
        }
    }

    // CommonMark reference images use a separate definition, for example
    // `![receipt][scan]` with `[scan]: /file-metadata/:id/content`.
    let imageReferencePattern = #"!\[([^\]]*)\](?:\[([^\]]*)\])?"#
    let definitionPattern = #"(?m)^[ \t]{0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+[^\n]*)?$"#
    guard let imageExpression = try? NSRegularExpression(pattern: imageReferencePattern),
          let definitionExpression = try? NSRegularExpression(pattern: definitionPattern) else { return count }

    let labels = imageExpression.matches(in: markdown, range: NSRange(location: 0, length: source.length)).reduce(into: Set<String>()) { labels, match in
        guard match.range(at: 2).location != NSNotFound else { return }
        let alt = source.substring(with: match.range(at: 1))
        let explicitReference = source.substring(with: match.range(at: 2))
        let label = explicitReference.isEmpty ? alt : explicitReference
        let normalized = label.split(whereSeparator: \.isWhitespace).joined(separator: " ").lowercased()
        if !normalized.isEmpty { labels.insert(normalized) }
    }
    for match in definitionExpression.matches(in: markdown, range: NSRange(location: 0, length: source.length)) {
        let label = source.substring(with: match.range(at: 1))
            .split(whereSeparator: \.isWhitespace).joined(separator: " ").lowercased()
        let destination = source.substring(with: match.range(at: 2))
        if labels.contains(label), isRecordBodyFileURL(destination, metadataID: metadataID) {
            count += 1
        }
    }
    return count
}

private func isRecordBodyFileURL(_ value: String, metadataID: String) -> Bool {
    guard let components = URLComponents(string: value),
          components.scheme == nil,
          components.host == nil else { return false }
    let segments = components.percentEncodedPath.split(separator: "/")
    return segments.count == 3
        && segments[0] == "file-metadata"
        && segments[2] == "content"
        && String(segments[1]).removingPercentEncoding == metadataID
}
