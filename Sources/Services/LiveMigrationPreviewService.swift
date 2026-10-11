import Foundation
import Vapor

/// A schema operation requested by the testing console. The operation is a
/// structured value, not executable SQL, so the API can validate it safely.
struct LiveMigrationOperationRequest: Content, Sendable {
    let operation: String
    let table: String
    let columns: [String]
}

struct LiveMigrationPreviewRequest: Content, Sendable {
    let operations: [LiveMigrationOperationRequest]
}

struct LiveMigrationOperationPlan: Content, Sendable {
    let operation: String
    let table: String
    let columns: [String]
    let warnings: [String]
}

struct LiveMigrationPlan: Content, Sendable {
    let operations: [LiveMigrationOperationPlan]
    let warnings: [String]
    let confirmationToken: String
    let expiresAt: Date
    let status: String
}

struct LiveMigrationConfirmationRequest: Content, Sendable {
    let confirmationToken: String
}

enum LiveMigrationPreviewError: Error, CustomStringConvertible {
    case noOperations
    case tooManyOperations
    case unsupportedOperation(String)
    case destructiveOperation(String)
    case invalidIdentifier(String)
    case duplicateOperation
    case expiredOrUnknownToken

    var description: String {
        switch self {
        case .noOperations: return "At least one schema operation is required."
        case .tooManyOperations: return "A migration preview may contain at most 20 operations."
        case .unsupportedOperation(let operation): return "The schema operation is not approved: \(operation)."
        case .destructiveOperation(let operation): return "Destructive schema operations are not allowed: \(operation)."
        case .invalidIdentifier(let identifier): return "The schema identifier is invalid: \(identifier)."
        case .duplicateOperation: return "The migration preview contains a duplicate operation."
        case .expiredOrUnknownToken: return "The confirmation token is unknown or expired."
        }
    }
}

/// Holds short-lived migration approvals in memory. Confirming a token only
/// authorizes the plan; a later issue is responsible for applying the schema.
actor LiveMigrationApprovalStore {
    private struct Approval: Sendable {
        let plan: LiveMigrationPlan
        let expiresAt: Date
    }

    private var approvals: [String: Approval] = [:]

    func issue(plan: LiveMigrationPlan) {
        approvals[plan.confirmationToken] = Approval(plan: plan, expiresAt: plan.expiresAt)
    }

    func confirm(token: String, now: Date = Date()) throws -> LiveMigrationPlan {
        guard let approval = approvals.removeValue(forKey: token), approval.expiresAt > now else {
            throw LiveMigrationPreviewError.expiredOrUnknownToken
        }

        return LiveMigrationPlan(
            operations: approval.plan.operations,
            warnings: approval.plan.warnings,
            confirmationToken: token,
            expiresAt: approval.expiresAt,
            status: "confirmed-not-applied"
        )
    }
}

/// Builds safe, reviewable migration plans without executing schema changes.
struct LiveMigrationPreviewService: Sendable {
    static let tokenLifetime: TimeInterval = 5 * 60
    let approvals: LiveMigrationApprovalStore

    init(approvals: LiveMigrationApprovalStore = LiveMigrationApprovalStore()) {
        self.approvals = approvals
    }

    func preview(request: LiveMigrationPreviewRequest, now: Date = Date()) async throws -> LiveMigrationPlan {
        guard !request.operations.isEmpty else { throw LiveMigrationPreviewError.noOperations }
        guard request.operations.count <= 20 else { throw LiveMigrationPreviewError.tooManyOperations }

        var seen: Set<String> = []
        var plans: [LiveMigrationOperationPlan] = []
        for operation in request.operations {
            try validate(operation: operation)
            let key = "\(operation.operation):\(operation.table):\(operation.columns.joined(separator: ","))"
            guard seen.insert(key).inserted else { throw LiveMigrationPreviewError.duplicateOperation }

            plans.append(LiveMigrationOperationPlan(
                operation: operation.operation,
                table: operation.table,
                columns: operation.columns,
                warnings: ["This plan changes schema only after a separate execution step and explicit confirmation."]
            ))
        }

        let plan = LiveMigrationPlan(
            operations: plans,
            warnings: [
                "The preview does not execute SQL or change the live database.",
                "A backup must be created before an approved plan is executed."
            ],
            confirmationToken: UUID().uuidString,
            expiresAt: now.addingTimeInterval(Self.tokenLifetime),
            status: "preview"
        )
        await approvals.issue(plan: plan)
        return plan
    }

    func confirm(_ request: LiveMigrationConfirmationRequest) async throws -> LiveMigrationPlan {
        try await approvals.confirm(token: request.confirmationToken)
    }

    private func validate(operation: LiveMigrationOperationRequest) throws {
        switch operation.operation {
        case "create-table", "add-column": break
        case "drop-table", "drop-column", "delete-data", "raw-sql":
            throw LiveMigrationPreviewError.destructiveOperation(operation.operation)
        default:
            throw LiveMigrationPreviewError.unsupportedOperation(operation.operation)
        }

        try validateIdentifier(operation.table)
        guard !operation.columns.isEmpty, operation.columns.count <= 50 else {
            throw LiveMigrationPreviewError.invalidIdentifier("columns")
        }
        for column in operation.columns { try validateIdentifier(column) }
    }

    private func validateIdentifier(_ identifier: String) throws {
        guard let first = identifier.first, (first.isLetter || first == "_"),
              identifier.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }),
              !identifier.hasPrefix("sqlite_"), !identifier.hasPrefix("_fluent_") else {
            throw LiveMigrationPreviewError.invalidIdentifier(identifier)
        }
    }
}
