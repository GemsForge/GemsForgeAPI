import Vapor

func registerSupabaseAuthenticationRoutes(
    _ app: Application,
    configuration: SupabaseAuthenticationConfiguration? = .fromEnvironment(),
    tokenValidator: (any SupabaseAccessTokenValidating)? = nil
) {
    app.post("auth", "supabase") { request async throws -> SupabaseSessionResponse in
        guard let configuration else {
            throw Abort(.serviceUnavailable, reason: "Supabase authentication is not configured for the private owner account.")
        }
        guard let authorization = request.headers.bearerAuthorization,
            !authorization.token.isEmpty else {
            throw Abort(.unauthorized, reason: "A Supabase access token is required.")
        }

        do {
            return try await SupabaseAuthenticationService(
                configuration: configuration,
                tokenValidator: tokenValidator
            ).signIn(accessToken: authorization.token, on: request.db)
        } catch SupabaseAuthenticationError.invalidToken {
            throw Abort(.unauthorized, reason: "The Supabase access token is invalid or expired.")
        } catch SupabaseAuthenticationError.ownerNotAllowed {
            throw Abort(.forbidden, reason: "This Supabase account is not provisioned for Gem Life.")
        } catch SupabaseAuthenticationError.identityConflict {
            throw Abort(.conflict, reason: "The configured Supabase identity is linked to a different Gem Life account.")
        } catch SupabaseAuthenticationError.verificationUnavailable {
            throw Abort(.serviceUnavailable, reason: "Supabase identity verification is temporarily unavailable.")
        }
    }

    app.post("auth", "logout") { request async throws -> HTTPStatus in
        guard let authorization = request.headers.bearerAuthorization else {
            throw Abort(.unauthorized, reason: "An API session token is required.")
        }
        try await AuthenticationSessionService().revokeSession(token: authorization.token, on: request.db)
        return .noContent
    }
}
