import Foundation
import Fluent
import Vapor

struct RecordBodyResponse: Content, Sendable {
    let recordID: String
    let markdown: String
    let revision: Int
    let updatedAt: Date?
}

struct RecordBodyRequest: Content, Sendable {
    let markdown: String
    let baseRevision: Int
}

struct RecordBodyExcerptResponse: Content, Sendable {
    let recordID: String
    let updatedAt: Date?
    let excerpt: String
}

private enum RecordBodySaveResult: Sendable {
    case saved(RecordBody)
    case conflict(RecordBody?)
}

/// Reads and writes Markdown bodies as Hub-scoped record sidecars.
func registerRecordBodyRoutes(_ app: Application) {
    let bodies = app.grouped("record-bodies")

    bodies.get(":tableName") { request async throws -> [RecordBodyExcerptResponse] in
        let hubID = try requireRecordBodyHubID(request)
        let tableName = try requireRecordBodyTableName(request)
        let records = try await RecordBody.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .sort(\.$updatedAt, .descending)
            .all()
        var excerpts: [RecordBodyExcerptResponse] = []
        for record in records {
            do {
                try await validatePresentationRecord(
                    tableName: tableName,
                    recordID: record.recordID,
                    hubID: hubID,
                    database: request.db
                )
            } catch let abort as Abort where abort.status == .notFound {
                continue
            }
            excerpts.append(
                RecordBodyExcerptResponse(
                    recordID: record.recordID,
                    updatedAt: record.updatedAt,
                    excerpt: recordBodyPlainText(record.markdown).prefix(200).description
                )
            )
        }
        return excerpts
    }

    bodies.get(":tableName", ":recordID") { request async throws -> RecordBodyResponse in
        let hubID = try requireRecordBodyHubID(request)
        let tableName = try requireRecordBodyTableName(request)
        let recordID = try requireRecordBodyID(request)
        try await validatePresentationRecord(
            tableName: tableName,
            recordID: recordID,
            hubID: hubID,
            database: request.db
        )

        let body = try await findRecordBody(tableName: tableName, recordID: recordID, hubID: hubID, database: request.db)
        return response(for: body, recordID: recordID)
    }

    app.on(
        .PUT,
        "record-bodies",
        ":tableName",
        ":recordID",
        // The decoded Markdown is limited below. Leave room for JSON escaping of
        // control characters (for example, each newline is encoded as `\\n`).
        body: .collect(maxSize: ByteCount(value: 6_100_000))
    ) { request async throws -> Response in
        let hubID = try requireRecordBodyHubID(request)
        let tableName = try requireRecordBodyTableName(request)
        let recordID = try requireRecordBodyID(request)
        let input = try request.content.decode(RecordBodyRequest.self)
        guard input.baseRevision >= 0 else {
            throw Abort(.badRequest, reason: "Base revision must be zero or greater.")
        }
        guard input.markdown.utf8.count <= 1_000_000 else {
            throw Abort(.payloadTooLarge, reason: "The record body exceeds 1 MB.")
        }

        try await validatePresentationRecord(
            tableName: tableName,
            recordID: recordID,
            hubID: hubID,
            database: request.db
        )
        let markdown = normalizeRecordBodyLineEndings(input.markdown)
        let result = try await request.db.transaction { transaction in
            let current = try await findRecordBody(
                tableName: tableName,
                recordID: recordID,
                hubID: hubID,
                database: transaction
            )
            let currentRevision = current?.revision ?? 0
            guard currentRevision == input.baseRevision else {
                return RecordBodySaveResult.conflict(current)
            }

            let body = current ?? RecordBody(
                hubID: hubID,
                tableName: tableName,
                recordID: recordID
            )
            body.markdown = markdown
            body.revision = currentRevision + 1
            body.updatedAt = Date()
            try await body.save(on: transaction)
            return RecordBodySaveResult.saved(body)
        }

        let bodyResponse: RecordBodyResponse
        let status: HTTPStatus
        switch result {
        case .saved(let body):
            bodyResponse = response(for: body, recordID: recordID)
            status = .ok
        case .conflict(let body):
            bodyResponse = response(for: body, recordID: recordID)
            status = .conflict
        }

        let response = Response(status: status)
        try response.content.encode(bodyResponse)
        return response
    }
}

private func requireRecordBodyHubID(_ request: Request) throws -> String {
    guard let hubID = request.authenticatedHubID else { throw Abort(.unauthorized) }
    return hubID
}

private func requireRecordBodyTableName(_ request: Request) throws -> String {
    guard let tableName = request.parameters.get("tableName"), !tableName.isEmpty else {
        throw Abort(.badRequest, reason: "A table name is required.")
    }
    return tableName
}

private func requireRecordBodyID(_ request: Request) throws -> String {
    guard let recordID = request.parameters.get("recordID"), !recordID.isEmpty else {
        throw Abort(.badRequest, reason: "A record ID is required.")
    }
    return recordID
}

private func findRecordBody(
    tableName: String,
    recordID: String,
    hubID: String,
    database: any Database
) async throws -> RecordBody? {
    try await RecordBody.query(on: database)
        .filter(\.$hubID == hubID)
        .filter(\.$tableName == tableName)
        .filter(\.$recordID == recordID)
        .first()
}

private func response(for body: RecordBody?, recordID: String) -> RecordBodyResponse {
    RecordBodyResponse(
        recordID: recordID,
        markdown: body?.markdown ?? "",
        revision: body?.revision ?? 0,
        updatedAt: body?.updatedAt
    )
}

private func normalizeRecordBodyLineEndings(_ markdown: String) -> String {
    markdown.replacingOccurrences(of: "\r\n", with: "\n")
        .replacingOccurrences(of: "\r", with: "\n")
}

private func recordBodyPlainText(_ markdown: String) -> String {
    var text = markdown
    let replacements: [(String, String)] = [
        (#"(?m)^[ \t]*```[^\n]*\n?"#, ""),
        (#"!\[([^\]]*)\]\([^)]*\)"#, "$1"),
        (#"\[([^\]]+)\]\([^)]*\)"#, "$1"),
        (#"(?m)^[ \t]{0,3}#{1,3}[ \t]+"#, ""),
        (#"(?m)^[ \t]{0,3}>[ \t]?"#, ""),
        (#"(?m)^[ \t]*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?"#, ""),
        (#"(?m)^[ \t]*(?:[-*_][ \t]*){3,}$"#, ""),
        (#"<[^>]+>"#, ""),
        (#"[`*_~|]"#, ""),
    ]
    for (pattern, replacement) in replacements {
        text = text.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
    }
    return text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
}
