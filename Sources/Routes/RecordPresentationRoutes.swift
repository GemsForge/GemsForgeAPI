import Foundation
import Fluent
import SQLKit
import Vapor

struct RecordPresentationResponse: Content, Sendable {
    let recordID: String
    let presentation: String
}

struct RecordPresentationRequest: Content, Sendable {
    let presentation: String
}

/// Persists Hub-scoped presentation state independently from domain records.
func registerRecordPresentationRoutes(_ app: Application) {
    let presentations = app.grouped("record-presentations")

    presentations.get(":tableName") { request async throws -> [RecordPresentationResponse] in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        let records = try await RecordPresentation.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .all()
        return records.map { RecordPresentationResponse(recordID: $0.recordID, presentation: $0.presentation) }
    }

    presentations.put(":tableName", ":recordID") { request async throws -> RecordPresentationResponse in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        guard let recordID = request.parameters.get("recordID"), !recordID.isEmpty else {
            throw Abort(.badRequest, reason: "A record ID is required.")
        }
        let input = try request.content.decode(RecordPresentationRequest.self)
        guard let data = input.presentation.data(using: .utf8),
              let presentation = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw Abort(.badRequest, reason: "Presentation must be a JSON object.")
        }
        try await validateOwnedHubRecord(tableName: tableName, recordID: recordID, hubID: hubID, database: request.db)
        try await validateCoverReference(
            presentation: presentation,
            tableName: tableName,
            recordID: recordID,
            hubID: hubID,
            database: request.db
        )

        let record = try await RecordPresentation.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$recordID == recordID)
            .first() ?? RecordPresentation(hubID: hubID, tableName: tableName, recordID: recordID, presentation: input.presentation)
        record.presentation = input.presentation
        try await record.save(on: request.db)
        return RecordPresentationResponse(recordID: recordID, presentation: record.presentation)
    }

    presentations.delete(":tableName", ":recordID") { request async throws -> HTTPStatus in
        let hubID = try requireHubID(request)
        let tableName = try requireTableName(request)
        guard let recordID = request.parameters.get("recordID"), !recordID.isEmpty else {
            throw Abort(.badRequest, reason: "A record ID is required.")
        }
        try await validateOwnedHubRecord(tableName: tableName, recordID: recordID, hubID: hubID, database: request.db)
        try await RecordPresentation.query(on: request.db)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$recordID == recordID)
            .delete()
        return .noContent
    }
}

private func requireHubID(_ request: Request) throws -> String {
    guard let hubID = request.authenticatedHubID else { throw Abort(.unauthorized) }
    return hubID
}

private func requireTableName(_ request: Request) throws -> String {
    guard let tableName = request.parameters.get("tableName"), !tableName.isEmpty else {
        throw Abort(.badRequest, reason: "A table name is required.")
    }
    return tableName
}

func validateOwnedHubRecord(
    tableName: String,
    recordID: String,
    hubID: String,
    database: any Database
) async throws {
    let physicalTableName = tableName == "ExpenseTransaction" ? "Transactions" : tableName
    guard AddHubOwnershipFields.ownedTables.contains(physicalTableName) else {
        throw Abort(.notFound, reason: "The record is unavailable in this Hub.")
    }
    guard let sql = database as? SQLDatabase else { throw Abort(.serviceUnavailable) }
    let columns = try await sql.raw("PRAGMA table_info(\(ident: physicalTableName))").all()
    let names = try columns.map { try $0.decode(column: "name", as: String.self) }
    guard names.contains("HubID"),
          let primaryKeyColumn = try columns.first(where: { try $0.decode(column: "pk", as: Int.self) > 0 }),
          let primaryKey = try? primaryKeyColumn.decode(column: "name", as: String.self),
          let primaryKeyType = try? primaryKeyColumn.decode(column: "type", as: String.self) else {
        throw Abort(.notFound, reason: "The record is unavailable in this Hub.")
    }
    let rowExists: Bool
    if primaryKeyType.uppercased().contains("INT") {
        guard let integerID = Int64(recordID) else {
            throw Abort(.notFound, reason: "The record is unavailable in this Hub.")
        }
        rowExists = try await sql.raw(
            "SELECT 1 AS \(ident: "present") FROM \(ident: physicalTableName) WHERE \(ident: primaryKey) = \(bind: integerID) AND \(ident: "HubID") = \(bind: hubID) LIMIT 1"
        ).first() != nil
    } else {
        rowExists = try await sql.raw(
            "SELECT 1 AS \(ident: "present") FROM \(ident: physicalTableName) WHERE \(ident: primaryKey) = \(bind: recordID) AND \(ident: "HubID") = \(bind: hubID) LIMIT 1"
        ).first() != nil
    }
    guard rowExists else { throw Abort(.notFound, reason: "The record is unavailable in this Hub.") }
}

func validateWorkspaceSelection(_ state: String, tableName: String, hubID: String, database: any Database) async throws {
    guard let data = state.data(using: .utf8),
          let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
        throw Abort(.badRequest, reason: "Workspace state must be a JSON object.")
    }
    guard let selection = object["selectedRecordId"] else { return }
    if selection is NSNull { return }
    guard let recordID = selection as? String, !recordID.isEmpty else {
        throw Abort(.badRequest, reason: "Selected record ID must be a string or null.")
    }
    let physicalTableName = tableName == "ExpenseTransaction" ? "Transactions" : tableName
    if AddHubOwnershipFields.ownedTables.contains(physicalTableName) {
        try await validateOwnedHubRecord(tableName: tableName, recordID: recordID, hubID: hubID, database: database)
        return
    }

    let service = SchemaPageService(database: database, hubID: hubID)
    guard try await service.containsRecord(recordID, in: tableName) else {
        throw Abort(.notFound, reason: "The record is unavailable in this Hub.")
    }
}

private func validateCoverReference(
    presentation: [String: Any],
    tableName: String,
    recordID: String,
    hubID: String,
    database: any Database
) async throws {
    guard let source = presentation["source"] as? String,
          ["color", "gradient", "gallery", "upload", "url"].contains(source) else {
        throw Abort(.badRequest, reason: "A supported cover source is required.")
    }
    if source == "upload" {
        guard let metadataID = presentation["fileMetadataID"] as? String,
              let metadata = try await FileMetadata.query(on: database)
                .filter(\.$id == metadataID)
                .filter(\.$hubID == hubID)
                .first(),
              metadata.mimeType.lowercased().hasPrefix("image/"),
              metadata.ownerType == "RecordPresentation.\(tableName)",
              metadata.ownerID == recordID else {
            throw Abort(.unprocessableEntity, reason: "The cover file must be an image owned by this Hub and record.")
        }
    }
    if source == "url" {
        guard let imageURL = presentation["imageUrl"] as? String,
              let url = URL(string: imageURL),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
            throw Abort(.badRequest, reason: "Cover URLs must use HTTP or HTTPS.")
        }
    }
}
