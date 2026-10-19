import Fluent
import Vapor

private struct AuthenticatedAccountIDKey: StorageKey {
    typealias Value = String
}

private struct AuthenticatedHubIDKey: StorageKey {
    typealias Value = String
}

extension Request {
    var authenticatedAccountID: String? {
        storage[AuthenticatedAccountIDKey.self]
    }

    var authenticatedHubID: String? {
        storage[AuthenticatedHubIDKey.self]
    }

    func requireAuthenticatedAccountID() throws -> String {
        guard let id = authenticatedAccountID else {
            throw Abort(.unauthorized, reason: "A valid bearer session is required.")
        }
        return id
    }

    func requireAuthenticatedHubID() throws -> String {
        guard let id = authenticatedHubID else {
            throw Abort(.unauthorized, reason: "An account-owned hub is required.")
        }
        return id
    }
}

/// Protects every API route except the minimal authentication and health allowlist.
struct SessionAuthenticationMiddleware: AsyncMiddleware {
    private let operatorAccountID: String?

    init(operatorAccountID: String? = Environment.get("GEM_LIFE_OPERATOR_ACCOUNT_ID")) {
        self.operatorAccountID = operatorAccountID?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static let publicRoutes: Set<String> = [
        "GET /health",
        "POST /auth/supabase",
        "POST /auth/local",
    ]

    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        let routeKey = "\(request.method.rawValue) \(request.url.path)"
        if Self.publicRoutes.contains(routeKey) {
            return try await next.respond(to: request)
        }

        guard let authorization = request.headers.bearerAuthorization,
            !authorization.token.isEmpty
        else {
            throw Abort(.unauthorized, reason: "A bearer session token is required.")
        }

        guard let accountID = try await AuthenticationSessionService.validAccountID(
            forSessionToken: authorization.token, on: request.db
        ) else {
            throw Abort(.unauthorized, reason: "The bearer session is invalid or expired.")
        }

        if Self.requiresOperatorAuthorization(method: request.method, path: request.url.path) {
            guard let operatorAccountID, !operatorAccountID.isEmpty,
                  accountID == operatorAccountID
            else {
                throw Abort(.forbidden, reason: "Operator authorization is required for this endpoint.")
            }
        }

        let hubQuery = Hub.query(on: request.db)
        let hub = try await hubQuery.filter(\.$accountID == accountID).first()
        guard let hubID = hub?.id else {
            throw Abort(.unauthorized, reason: "The account does not have an assigned hub.")
        }

        request.storage[AuthenticatedAccountIDKey.self] = accountID
        request.storage[AuthenticatedHubIDKey.self] = hubID
        return try await next.respond(to: request)
    }

    static func requiresOperatorAuthorization(method: HTTPMethod, path: String) -> Bool {
        let normalizedPath = path.hasSuffix("/") && path != "/" ? String(path.dropLast()) : path
        let operatorPrefixes = [
            "/live-database",
            "/local-databases",
            "/schema-builder",
            "/operator",
            "/file-metadata/migrate-legacy",
        ]
        if operatorPrefixes.contains(where: { normalizedPath == $0 || normalizedPath.hasPrefix($0 + "/") }) {
            return true
        }
        return normalizedPath == "/domains" || normalizedPath.hasPrefix("/domains/")
            ? method != .GET && method != .HEAD && method != .OPTIONS
            : false
    }
}
