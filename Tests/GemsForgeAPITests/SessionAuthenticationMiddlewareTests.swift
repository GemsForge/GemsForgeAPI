import Crypto
import FluentSQLiteDriver
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class SessionAuthenticationMiddlewareTests: XCTestCase {
    func testProtectedRouteRejectsMissingBearerToken() async throws {
        try await withApp(configure: configureTestApp) { app in
            try await app.test(.GET, "private") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testProtectedRouteResolvesAccountAndHubFromValidSession() async throws {
        try await withApp(configure: configureTestApp) { app in
            let token = try await seedSession(on: app.db)
            try await app.test(.GET, "private", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: token)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.body.string, "account-1:hub-1")
            }
        }
    }

    func testProtectedRouteRejectsInvalidExpiredAndRevokedSessions() async throws {
        try await withApp(configure: configureTestApp) { app in
            let invalidToken = "not-a-session"
            try await app.test(.GET, "private", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: invalidToken)
            }) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }

            let expiredToken = try await seedSession(
                on: app.db, id: "expired", expiresAt: Date().addingTimeInterval(-1))
            try await app.test(.GET, "private", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: expiredToken)
            }) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }

            let revokedToken = try await seedSession(
                on: app.db, id: "revoked", revokedAt: Date())
            try await app.test(.GET, "private", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: revokedToken)
            }) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testOnlyHealthAndAppleChallengeAndSignInArePublic() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app)
            app.get("health") { _ async in "ok" }
            app.post("auth", "apple", "challenges") { _ async in "challenge" }
            app.post("auth", "apple") { _ async in "signin" }
            app.get("protected") { _ async in "private" }
        }) { app in
            try await app.test(.GET, "health") { XCTAssertEqual($0.status, .ok) }
            try await app.test(.POST, "auth/apple/challenges") {
                XCTAssertEqual($0.status, .ok)
            }
            try await app.test(.POST, "auth/apple") { XCTAssertEqual($0.status, .ok) }
            try await app.test(.GET, "protected") {
                XCTAssertEqual($0.status, .unauthorized)
            }
        }
    }

    private func configureTestApp(_ app: Application) async throws {
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateAuthenticationSchema())
        app.migrations.add(CreateHubs())
        try await app.autoMigrate()
        app.middleware.use(SessionAuthenticationMiddleware())
        app.get("private") { request async throws -> String in
            "\(try request.requireAuthenticatedAccountID()):\(try request.requireAuthenticatedHubID())"
        }
    }

    @discardableResult
    private func seedSession(
        on database: any Database,
        id: String = UUID().uuidString,
        expiresAt: Date = Date().addingTimeInterval(3_600),
        revokedAt: Date? = nil
    ) async throws -> String {
        if try await AppleAccount.find("account-1", on: database) == nil {
            try await AppleAccount(id: "account-1", appleSubject: "subject-1").save(on: database)
            try await Hub(id: "hub-1", accountID: "account-1").save(on: database)
        }
        let token = "session-\(id)"
        let tokenHash = SHA256.hash(data: Data(token.utf8))
            .map { String(format: "%02x", $0) }.joined()
        let session = AuthenticationSession(
            id: id,
            accountID: "account-1",
            tokenHash: tokenHash,
            expiresAt: expiresAt
        )
        session.revokedAt = revokedAt
        try await session.save(on: database)
        return token
    }
}
