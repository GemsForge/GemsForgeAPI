import Fluent
import SQLKit
import Vapor

struct HubOwnershipMigrationPreview: Content, Sendable {
    let hubID: String
    let unownedCounts: [String: Int]
}

struct HubOwnershipAssignmentRequest: Content, Sendable {
    let confirmation: String
    let expectedUnownedCounts: [String: Int]
}

struct HubOwnershipAssignmentResult: Content, Sendable {
    let hubID: String
    let assignedCounts: [String: Int]
}

enum HubOwnershipMigrationError: Error, CustomStringConvertible {
    case unsupportedDatabase
    case unknownHub
    case confirmationRequired
    case previewMismatch

    var description: String {
        switch self {
        case .unsupportedDatabase: return "Hub ownership assignment requires a supported SQL database."
        case .unknownHub: return "The authenticated account does not have an ownership hub."
        case .confirmationRequired: return "Explicit ownership migration confirmation is required."
        case .previewMismatch: return "Unowned row counts changed; preview the migration again before assigning ownership."
        }
    }
}

/// Supports a reviewed, explicit assignment of legacy unowned rows to the
/// authenticated operator's own hub. No assignment occurs during sign-in or migration.
struct HubOwnershipMigrationService: Sendable {
    static let confirmationPhrase = "assign-unowned-records-to-my-hub"

    private let database: any Database
    private let tables: [String]

    init(database: any Database, tables: [String] = AddHubOwnershipFields.ownedTables) {
        self.database = database
        self.tables = tables
    }

    func preview(hubID: String) async throws -> HubOwnershipMigrationPreview {
        guard try await Hub.find(hubID, on: database) != nil else {
            throw HubOwnershipMigrationError.unknownHub
        }
        return HubOwnershipMigrationPreview(hubID: hubID, unownedCounts: try await counts(on: database))
    }

    func assignUnowned(
        hubID: String,
        request: HubOwnershipAssignmentRequest
    ) async throws -> HubOwnershipAssignmentResult {
        guard request.confirmation == Self.confirmationPhrase else {
            throw HubOwnershipMigrationError.confirmationRequired
        }
        guard try await Hub.find(hubID, on: database) != nil else {
            throw HubOwnershipMigrationError.unknownHub
        }

        let assigned = try await database.transaction { transaction in
            let currentCounts = try await self.counts(on: transaction)
            guard request.expectedUnownedCounts == currentCounts else {
                throw HubOwnershipMigrationError.previewMismatch
            }
            guard let sql = transaction as? SQLDatabase else {
                throw HubOwnershipMigrationError.unsupportedDatabase
            }
            for table in self.tables {
                try await sql.raw(
                    "UPDATE \(ident: table) SET \"HubID\" = \(bind: hubID) WHERE \"HubID\" IS NULL"
                ).run()
            }
            return currentCounts
        }

        return HubOwnershipAssignmentResult(hubID: hubID, assignedCounts: assigned)
    }

    private func counts(on database: any Database) async throws -> [String: Int] {
        guard let sql = database as? SQLDatabase else {
            throw HubOwnershipMigrationError.unsupportedDatabase
        }
        var result: [String: Int] = [:]
        for table in tables {
            let row = try await sql.raw(
                "SELECT COUNT(*) AS \"rowCount\" FROM \(ident: table) WHERE \"HubID\" IS NULL"
            ).first()
            guard let row else { throw HubOwnershipMigrationError.unsupportedDatabase }
            result[table] = try row.decode(column: "rowCount", as: Int.self)
        }
        return result
    }
}
