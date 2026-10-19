import Fluent
import Foundation
import Vapor

struct GemHueImportRequest: Content { let rows: [GemHueImportRow]; let confirmImport: Bool }
struct GemHueImportRow: Content { let id: String; let colorName: String; let colorFamily: String?; let hexCode: String; let mood: String?; let palette: String?; let description: String?; let createdDate: String?; let notes: String? }
struct GemHueImportPreview: Content, Sendable { let validRows: [GemHueImportRow]; let invalidRows: [GemHueImportInvalidRow]; let readyToImport: Bool; let warnings: [String] }
struct GemHueImportInvalidRow: Content, Sendable { let rowNumber: Int; let errors: [String] }

struct GemHueImportService: Sendable {
    let database: any Database
    let hubID: String?
    func preview(_ rows: [GemHueImportRow]) async throws -> GemHueImportPreview {
        var seen = Set<String>(); var seenNames = Set<String>(); var valid: [GemHueImportRow] = []; var invalid: [GemHueImportInvalidRow] = []
        for (index, row) in rows.enumerated() {
            var errors: [String] = []
            if row.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append("HueID is required.") }
            if row.colorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append("ColorName is required.") }
            if row.hexCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append("HexCode is required.") }
            if !seen.insert(row.id).inserted { errors.append("HueID is duplicated in this import.") }
            if !seenNames.insert(row.colorName).inserted { errors.append("ColorName is duplicated in this import.") }
            if try await GemHueService(database: database, hubID: hubID).find(id: row.id) != nil { errors.append("HueID already exists in the database.") }
            if try await GemHue.query(on: database).filter(\.$colorName == row.colorName).first() != nil { errors.append("ColorName already exists in the database.") }
            if errors.isEmpty { valid.append(row) } else { invalid.append(.init(rowNumber: index + 1, errors: errors)) }
        }
        return .init(validRows: valid, invalidRows: invalid, readyToImport: !valid.isEmpty && invalid.isEmpty, warnings: ["Preview only: no database rows were changed.", "JSON rows must use Gem Hues table column names."])
    }
    func publish(_ request: GemHueImportRequest) async throws -> Int {
        guard request.confirmImport else { throw Abort(.badRequest, reason: "Import requires explicit confirmation.") }
        let preview = try await preview(request.rows)
        guard preview.readyToImport else { throw Abort(.unprocessableEntity, reason: "The import contains invalid or duplicate rows.") }
        try await database.transaction { db in
            for row in preview.validRows {
                let record = GemHue(id: row.id, colorName: row.colorName, colorFamily: row.colorFamily, hexCode: row.hexCode, mood: row.mood, palette: row.palette, description: row.description, createdDate: row.createdDate, notes: row.notes)
                record.hubID = hubID
                try await record.create(on: db)
            }
        }
        return preview.validRows.count
    }
}
