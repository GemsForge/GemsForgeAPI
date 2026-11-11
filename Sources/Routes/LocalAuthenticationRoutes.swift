import Fluent
import Vapor

private struct LocalLoginRequest: Content { let username: String; let password: String }

struct LocalAuthenticationConfiguration: Sendable {
    let username: String
    let password: String
    let accountID: String

    static func fromEnvironment() -> Self? {
        guard let username = Environment.get("LOCAL_AUTH_USERNAME"),
              let password = Environment.get("LOCAL_AUTH_PASSWORD"),
              let accountID = Environment.get("GEM_LIFE_OPERATOR_ACCOUNT_ID"),
              !username.isEmpty, !password.isEmpty, !accountID.isEmpty else { return nil }
        return Self(username: username, password: password, accountID: accountID)
    }
}

func registerLocalAuthenticationRoutes(
    _ app: Application,
    configuration: @escaping @Sendable () -> LocalAuthenticationConfiguration? = LocalAuthenticationConfiguration.fromEnvironment
) {
    app.post("auth", "local") { request async throws -> AuthenticationSessionResponse in
        guard let configuration = configuration() else {
            throw Abort(.serviceUnavailable, reason: "Local authentication is not configured.")
        }
        let input = try request.content.decode(LocalLoginRequest.self)
        guard input.username == configuration.username, input.password == configuration.password else {
            throw Abort(.unauthorized, reason: "Username or password is incorrect.")
        }
        if try await AuthenticationAccount.find(configuration.accountID, on: request.db) == nil {
            try await AuthenticationAccount(id: configuration.accountID).save(on: request.db)
        }
        if try await Hub.query(on: request.db).filter(\Hub.$accountID == configuration.accountID).first() == nil {
            try await Hub(accountID: configuration.accountID).save(on: request.db)
        }
        let issued = try await AuthenticationSessionService.issue(accountID: configuration.accountID, on: request.db)
        return AuthenticationSessionResponse(sessionToken: issued.token, expiresAt: issued.expiresAt)
    }

    app.post("auth", "logout") { request async throws -> HTTPStatus in
        guard let authorization = request.headers.bearerAuthorization else {
            throw Abort(.unauthorized, reason: "An API session token is required.")
        }
        try await AuthenticationSessionService().revokeSession(token: authorization.token, on: request.db)
        return .noContent
    }
}
