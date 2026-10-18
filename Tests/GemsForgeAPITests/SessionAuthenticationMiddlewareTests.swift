import Crypto
import FluentSQLiteDriver
import Vapor
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class SessionAuthenticationMiddlewareTests: XCTestCase {
    func testProtectedRouteRejectsMissingBearerToken() async throws {
        try await withApp(configure: { app in try await self.configureTestApp(app) }) { app in
            try await app.test(.GET, "private") { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testProtectedRouteResolvesAccountAndHubFromValidSession() async throws {
        try await withApp(configure: { app in try await self.configureTestApp(app) }) { app in
            let token = try await seedSession(on: app.db)
            try await app.test(.GET, "private", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: token)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(response.body.string, "account-1:hub-1")
            }
        }
    }

    func testAuthenticatedAccountCannotListOrFetchAnotherHubsAddresses() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app)
            registerAddressRoutes(app)
        }) { app in
            let accountAToken = try await seedSession(on: app.db)
            let accountBToken = try await seedSession(
                on: app.db, id: "account-b-session", accountID: "account-2", hubID: "hub-2"
            )
            try await AddressService(database: app.db, hubID: "hub-1").save(
                Address(id: "ADDR-A", city: "Account A", addressStatus: "Current")
            )
            try await AddressService(database: app.db, hubID: "hub-2").save(
                Address(id: "ADDR-B", city: "Account B", addressStatus: "Current")
            )
            try await Address(id: "ADDR-LEGACY", city: "Unowned legacy", addressStatus: "Former")
                .save(on: app.db)

            try await app.test(.GET, "addresses", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: accountAToken)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let addresses = try response.content.decode([AddressSummaryResponse].self)
                XCTAssertEqual(addresses.map(\.city), ["Account A"])
            }

            try await app.test(.GET, "addresses/ADDR-B", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: accountAToken)
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.GET, "addresses/ADDR-B", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: accountBToken)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let address = try response.content.decode(AddressDetailResponse.self)
                XCTAssertEqual(address.city, "Account B")
            }
        }
    }

    func testAdministrativeEndpointsFailClosedWithoutOperatorConfiguration() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app, operatorAccountID: nil)
            app.get("live-database", "schema") { _ async in "admin" }
        }) { app in
            let token = try await seedSession(on: app.db)
            try await app.test(.GET, "live-database/schema", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: token)
            }) { response in
                XCTAssertEqual(response.status, .forbidden)
            }
        }
    }

    func testAdministrativeEndpointsRequireTheConfiguredOperatorAccount() async throws {
        try await withApp(configure: { app in
            try await self.configureTestApp(app, operatorAccountID: "account-1")
            app.get("local-databases", "capabilities") { _ async in "admin" }
        }) { app in
            let operatorToken = try await seedSession(on: app.db)
            let otherAccountToken = try await seedSession(
                on: app.db, id: "account-b-admin-session", accountID: "account-2", hubID: "hub-2"
            )
            try await app.test(.GET, "local-databases/capabilities", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: operatorToken)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            try await app.test(.GET, "local-databases/capabilities", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: otherAccountToken)
            }) { response in
                XCTAssertEqual(response.status, .forbidden)
            }
        }
    }

    func testProtectedRouteRejectsInvalidExpiredAndRevokedSessions() async throws {
        try await withApp(configure: { app in try await self.configureTestApp(app) }) { app in
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

    private func configureTestApp(_ app: Application, operatorAccountID: String? = nil) async throws {
        app.databases.use(.sqlite(.memory), as: .sqlite)
        app.migrations.add(CreateAuthenticationSchema())
        app.migrations.add(CreateHubs())
        app.migrations.add(CreateAddresses())
        app.migrations.add(CreateFileMetadata())
        app.migrations.add(AddAddressAttachmentReference())
        try await app.autoMigrate()
        app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: operatorAccountID))
        app.get("private") { request async throws -> String in
            "\(try request.requireAuthenticatedAccountID()):\(try request.requireAuthenticatedHubID())"
        }
    }

    @discardableResult
    private func seedSession(
        on database: any Database,
        id: String = UUID().uuidString,
        accountID: String = "account-1",
        hubID: String = "hub-1",
        expiresAt: Date = Date().addingTimeInterval(3_600),
        revokedAt: Date? = nil
    ) async throws -> String {
        if try await AppleAccount.find(accountID, on: database) == nil {
            try await AppleAccount(id: accountID, appleSubject: "subject-\(accountID)").save(on: database)
            try await Hub(id: hubID, accountID: accountID).save(on: database)
        }
        let token = "session-\(id)"
        let tokenHash = SHA256.hash(data: Data(token.utf8))
            .map { String(format: "%02x", $0) }.joined()
        let session = AuthenticationSession(
            id: id,
            accountID: accountID,
            tokenHash: tokenHash,
            expiresAt: expiresAt
        )
        session.revokedAt = revokedAt
        try await session.save(on: database)
        return token
    }
}
