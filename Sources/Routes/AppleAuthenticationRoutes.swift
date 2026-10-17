import Vapor

func registerAppleAuthenticationRoutes(
    _ app: Application,
    configuration: AppleAuthenticationConfiguration? = .fromEnvironment(),
    tokenValidator: (any AppleIdentityTokenValidating)? = nil
) {
    app.post("auth", "apple", "challenges") { request async throws -> AppleChallengeResponse in
        guard let configuration else {
            throw Abort(.serviceUnavailable, reason: "Apple authentication is not configured.")
        }
        return try await AppleAuthenticationService(
            configuration: configuration, tokenValidator: tokenValidator
        )
        .createChallenge(on: request.db)
    }

    app.post("auth", "apple") { request async throws -> AppleSessionResponse in
        guard let configuration else {
            throw Abort(.serviceUnavailable, reason: "Apple authentication is not configured.")
        }
        let input = try request.content.decode(AppleSignInRequest.self)
        let service = AppleAuthenticationService(
            configuration: configuration, tokenValidator: tokenValidator)
        do { return try await service.signIn(input, on: request.db) } catch AppleAuthenticationError
            .invalidChallenge
        {
            throw Abort(.unauthorized, reason: "The sign-in challenge is invalid or expired.")
        } catch AppleAuthenticationError.invalidIdentityToken {
            throw Abort(.unauthorized, reason: "The Apple identity token could not be verified.")
        } catch AppleAuthenticationError.verificationUnavailable {
            throw Abort(
                .serviceUnavailable, reason: "Apple token verification is temporarily unavailable.")
        }
    }

    app.post("auth", "logout") { request async throws -> HTTPStatus in
        guard let configuration else {
            throw Abort(.serviceUnavailable, reason: "Apple authentication is not configured.")
        }
        guard let authorization = request.headers.bearerAuthorization else {
            throw Abort(.unauthorized, reason: "A bearer session token is required.")
        }
        try await AppleAuthenticationService(
            configuration: configuration, tokenValidator: tokenValidator
        )
        .revokeSession(token: authorization.token, on: request.db)
        return .noContent
    }
}
