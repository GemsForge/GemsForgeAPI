import FluentSQLiteDriver
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class LocalAuthenticationTests: XCTestCase {
    func testLocalSignInIssuesProtectedSessionAndLogoutRevokesIt() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app)
            registerLocalAuthenticationRoutes(
                app,
                configuration: { Self.testConfiguration }
            )
            app.get("private") { request throws -> String in
                try request.requireAuthenticatedAccountID()
            }
        }) { app in
            try await app.test(.POST, "auth/local", beforeRequest: { request in
                try request.content.encode(LocalLoginBody(username: "owner", password: "secret"))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let session = try response.content.decode(AuthenticationSessionResponse.self)
                XCTAssertFalse(session.sessionToken.isEmpty)

                try await app.test(.GET, "private", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: session.sessionToken)
                }) { response in
                    XCTAssertEqual(response.status, .ok)
                    XCTAssertEqual(response.body.string, "account-1")
                }

                try await app.test(.POST, "auth/logout", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: session.sessionToken)
                }) { XCTAssertEqual($0.status, .noContent) }

                try await app.test(.GET, "private", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: session.sessionToken)
                }) { XCTAssertEqual($0.status, .unauthorized) }
            }
        }
    }

    func testLocalSignInRejectsIncorrectCredentials() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app)
            registerLocalAuthenticationRoutes(
                app,
                configuration: { Self.testConfiguration }
            )
        }) { app in
            try await app.test(.POST, "auth/local", beforeRequest: { request in
                try request.content.encode(LocalLoginBody(username: "owner", password: "wrong"))
            }) { XCTAssertEqual($0.status, .unauthorized) }
        }
    }

    func testLocalSignInFailsWhenConfigurationIsMissing() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app)
            registerLocalAuthenticationRoutes(app, configuration: { nil })
        }) { app in
            try await app.test(.POST, "auth/local", beforeRequest: { request in
                try request.content.encode(LocalLoginBody(username: "owner", password: "secret"))
            }) { XCTAssertEqual($0.status, .serviceUnavailable) }
        }
    }

    private func configureTestApp(_ app: Application) async throws {
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateAuthenticationSchema())
        app.migrations.add(CreateHubs())
        app.migrations.add(MakeAuthenticationProviderAgnostic())
        app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-1"))
        try await app.autoMigrate()
    }

    private static let testConfiguration = LocalAuthenticationConfiguration(
        username: "owner", password: "secret", accountID: "account-1"
    )
}

private struct LocalLoginBody: Content {
    let username: String
    let password: String
}
