import Foundation
import Fluent
import SQLKit
import Vapor

struct TrashEntryRequest: Content, Sendable {
    let tableName: String
    let recordID: String
    let title: String
    let snapshot: String
}

struct TrashEntryResponse: Content, Sendable {
    let entryID: String
    let tableName: String
    let recordID: String
    let title: String
    let snapshot: String
    let trashedAt: Date?

    init(_ entry: TrashEntry) throws {
        guard let entryID = entry.id else { throw TrashServiceError.invalidStoredEntry }
        self.entryID = entryID
        self.tableName = entry.tableName
        self.recordID = entry.recordID
        self.title = entry.title
        self.snapshot = entry.snapshot
        self.trashedAt = entry.trashedAt
    }
}

enum TrashServiceError: Error {
    case invalidTable
    case invalidRequest
    case alreadyArchived
    case entryNotFound
    case invalidStoredEntry
    case databaseUnavailable
}

/// Owns the Hub-scoped archive lifecycle for wireframe collection records.
struct TrashService: Sendable {
    private let database: any Database
    private let hubID: String

    init(database: any Database, hubID: String) {
        self.database = database
        self.hubID = hubID
    }

    func list() async throws -> [TrashEntryResponse] {
        try await TrashEntry.query(on: database)
            .filter(\.$hubID == hubID)
            .sort(\.$trashedAt, .descending)
            .all()
            .map(TrashEntryResponse.init)
    }

    func archive(_ input: TrashEntryRequest) async throws -> TrashEntryResponse {
        guard TrashRecordTable(rawValue: input.tableName) != nil else { throw TrashServiceError.invalidTable }
        let title = input.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.recordID.isEmpty,
              !title.isEmpty,
              title.count <= 240,
              input.snapshot.utf8.count <= 1_000_000,
              let data = input.snapshot.data(using: .utf8),
              let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let snapshotID = snapshotRecordID(snapshot["id"]),
              snapshotID == input.recordID
        else { throw TrashServiceError.invalidRequest }

        try await validateOwnedHubRecord(
            tableName: input.tableName,
            recordID: input.recordID,
            hubID: hubID,
            database: database
        )

        if try await find(tableName: input.tableName, recordID: input.recordID) != nil {
            throw TrashServiceError.alreadyArchived
        }

        let entry = TrashEntry(
            hubID: hubID,
            tableName: input.tableName,
            recordID: input.recordID,
            title: title,
            snapshot: input.snapshot
        )
        try await entry.save(on: database)
        return try TrashEntryResponse(entry)
    }

    func restore(entryID: String) async throws {
        guard let entry = try await TrashEntry.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$id == entryID)
            .first() else { throw TrashServiceError.entryNotFound }
        try await entry.delete(on: database)
    }

    func permanentlyDelete(entryID: String) async throws {
        try await database.transaction { transaction in
            guard let entry = try await TrashEntry.query(on: transaction)
                .filter(\.$hubID == hubID)
                .filter(\.$id == entryID)
                .first() else { throw TrashServiceError.entryNotFound }
            guard let table = TrashRecordTable(rawValue: entry.tableName) else {
                throw TrashServiceError.invalidStoredEntry
            }

            try await validateOwnedHubRecord(
                tableName: entry.tableName,
                recordID: entry.recordID,
                hubID: hubID,
                database: transaction
            )

            guard let sql = transaction as? SQLDatabase else { throw TrashServiceError.databaseUnavailable }
            let columns = try await sql.raw("PRAGMA table_info(\(ident: table.physicalName))").all()
            guard let primaryKeyColumn = try columns.first(where: {
                try $0.decode(column: "pk", as: Int.self) > 0
            }), let primaryKey = try? primaryKeyColumn.decode(column: "name", as: String.self) else {
                throw TrashServiceError.invalidStoredEntry
            }

            try await sql.raw(
                "DELETE FROM \(ident: table.physicalName) WHERE CAST(\(ident: primaryKey) AS TEXT) = \(bind: entry.recordID) AND \(ident: "HubID") = \(bind: hubID)"
            ).run()
            try await RecordPresentation.query(on: transaction)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == entry.tableName)
                .filter(\.$recordID == entry.recordID)
                .delete()
            try await entry.delete(on: transaction)
        }
    }

    private func find(tableName: String, recordID: String) async throws -> TrashEntry? {
        try await TrashEntry.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$recordID == recordID)
            .first()
    }

    private func snapshotRecordID(_ value: Any?) -> String? {
        if let value = value as? String { return value }
        if let value = value as? NSNumber { return value.stringValue }
        return nil
    }
}

private enum TrashRecordTable: String {
    case addresses = "Addresses"
    case education = "Education"
    case employment = "Employment"
    case transactions = "ExpenseTransaction"
    case services = "Services"
    case gemHues = "GemHues"

    var physicalName: String {
        switch self {
        case .transactions: "Transactions"
        default: rawValue
        }
    }
}
