import Fluent
import Vapor

private struct LocalLoginRequest: Content { let username: String; let password: String }

func registerLocalAuthenticationRoutes(_ app: Application) {
    app.post("auth", "local") { request async throws -> SupabaseSessionResponse in
        guard let username = Environment.get("LOCAL_AUTH_USERNAME"),
              let password = Environment.get("LOCAL_AUTH_PASSWORD"),
              let accountID = Environment.get("GEM_LIFE_OPERATOR_ACCOUNT_ID"),
              !username.isEmpty, !password.isEmpty, !accountID.isEmpty else {
            throw Abort(.serviceUnavailable, reason: "Local authentication is not configured.")
        }
        let input = try request.content.decode(LocalLoginRequest.self)
        guard input.username == username, input.password == password else {
            throw Abort(.unauthorized, reason: "Username or password is incorrect.")
        }
        if try await AuthenticationAccount.find(accountID, on: request.db) == nil {
            try await AuthenticationAccount(id: accountID).save(on: request.db)
        }
        if try await Hub.query(on: request.db).filter(\Hub.$accountID == accountID).first() == nil {
            try await Hub(accountID: accountID).save(on: request.db)
        }
        let issued = try await AuthenticationSessionService.issue(accountID: accountID, on: request.db)
        return SupabaseSessionResponse(sessionToken: issued.token, expiresAt: issued.expiresAt)
    }
}
