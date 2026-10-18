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
    private static let publicRoutes: Set<String> = [
        "GET /health",
        "POST /auth/apple/challenges",
        "POST /auth/apple",
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

        guard let accountID = try await AppleAuthenticationService.validAccountID(
            forSessionToken: authorization.token, on: request.db
        ) else {
            throw Abort(.unauthorized, reason: "The bearer session is invalid or expired.")
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
}
