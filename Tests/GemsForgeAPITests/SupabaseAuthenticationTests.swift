import FluentSQLiteDriver
import JWTKit
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class SupabaseAuthenticationTests: XCTestCase {
    func testMigrationPreservesExistingAccountIdentityAndHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            try await app.autoMigrate()
            try await AppleAccount(id: "owner-account", appleSubject: "owner-subject").save(on: app.db)
            try await Hub(id: "owner-hub", accountID: "owner-account", name: "My Hub").save(on: app.db)
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
        }) { app in
            let maybeAccount = try await AuthenticationAccount.find("owner-account", on: app.db)
            let maybeHub = try await Hub.find("owner-hub", on: app.db)
            let maybeIdentity = try await AuthenticationIdentity.query(on: app.db)
                .filter(\.$subject == "owner-subject").first()
            let account = try XCTUnwrap(maybeAccount)
            let hub = try XCTUnwrap(maybeHub)
            let identity = try XCTUnwrap(maybeIdentity)
            XCTAssertEqual(account.id, "owner-account")
            XCTAssertEqual(hub.accountID, "owner-account")
            XCTAssertEqual(identity.issuer, "https://appleid.apple.com")
        }
    }

    func testOwnerIdentityExchangesForApiSessionAndRejectsOtherIdentity() async throws {
        let configuration = SupabaseAuthenticationConfiguration(
            issuer: "https://project.supabase.co/auth/v1",
            jwksURL: URL(string: "https://project.supabase.co/auth/v1/.well-known/jwks.json")!,
            ownerSubject: "owner-subject",
            ownerAccountID: "owner-account",
            sessionLifetime: 3_600
        )
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
            registerSupabaseAuthenticationRoutes(
                app,
                configuration: configuration,
                tokenValidator: StubSupabaseValidator(subject: "owner-subject")
            )
        }) { app in
            try await app.test(.POST, "auth/supabase", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: "supabase-owner-token")
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let session = try response.content.decode(SupabaseSessionResponse.self)
                let accountCount = try await AuthenticationAccount.query(on: app.db).count()
                let hubCount = try await Hub.query(on: app.db).count()
                let sessionAccount = try await AuthenticationSessionService.validAccountID(forSessionToken: session.sessionToken, on: app.db)
                XCTAssertEqual(accountCount, 1)
                XCTAssertEqual(hubCount, 1)
                XCTAssertEqual(sessionAccount, "owner-account")

                try await app.test(.POST, "auth/logout", beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: session.sessionToken)
                }) { response in
                    XCTAssertEqual(response.status, .noContent)
                }
                let revokedAccount = try await AuthenticationSessionService.validAccountID(forSessionToken: session.sessionToken, on: app.db)
                XCTAssertNil(revokedAccount)
            }
        }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
            registerSupabaseAuthenticationRoutes(
                app,
                configuration: configuration,
                tokenValidator: StubSupabaseValidator(subject: "unapproved-subject")
            )
        }) { app in
            try await app.test(.POST, "auth/supabase", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: "supabase-other-token")
            }) { response in
                XCTAssertEqual(response.status, .forbidden)
                let accountCount = try await AuthenticationAccount.query(on: app.db).count()
                XCTAssertEqual(accountCount, 0)
            }
        }
    }

    func testConfigurationRequiresHttpsOwnerAndValidLifetime() {
        let values = [
            "SUPABASE_URL": "https://project.supabase.co/",
            "SUPABASE_OWNER_SUBJECT": "owner-subject",
            "GEM_LIFE_OPERATOR_ACCOUNT_ID": "owner-account",
        ]
        let configuration = SupabaseAuthenticationConfiguration.fromEnvironment { values[$0] }
        XCTAssertEqual(configuration?.issuer, "https://project.supabase.co/auth/v1")
        XCTAssertEqual(configuration?.jwksURL.absoluteString, "https://project.supabase.co/auth/v1/.well-known/jwks.json")
        XCTAssertNil(SupabaseAuthenticationConfiguration.fromEnvironment { key in
            key == "SUPABASE_URL" ? "http://project.supabase.co" : values[key]
        })
        XCTAssertNil(SupabaseAuthenticationConfiguration.fromEnvironment { key in
            key == "API_SESSION_LIFETIME_SECONDS" ? "10" : values[key]
        })
    }

    func testSupabaseTokenVerifierChecksSignatureIssuerAudienceAndExpiry() async throws {
        let fixture = try SupabaseTokenFixture()
        let configuration = SupabaseAuthenticationConfiguration(
            issuer: "https://project.supabase.co/auth/v1",
            jwksURL: URL(string: "https://project.supabase.co/auth/v1/.well-known/jwks.json")!,
            ownerSubject: "owner-subject",
            ownerAccountID: "owner-account",
            sessionLifetime: 3_600
        )
        let verifier = SupabaseAccessTokenVerifier(configuration: configuration, jwksJSON: fixture.jwks)
        let valid = try await fixture.token()
        let identity = try await verifier.verify(accessToken: valid)
        XCTAssertEqual(identity.subject, "owner-subject")
        XCTAssertEqual(identity.issuer, configuration.issuer)

        let wrongIssuer = try await fixture.token(issuer: "https://attacker.invalid/auth/v1")
        do {
            _ = try await verifier.verify(accessToken: wrongIssuer)
            XCTFail("An unexpected issuer must be rejected.")
        } catch SupabaseAuthenticationError.invalidToken {
            // Expected.
        }

        let expired = try await fixture.token(expiresAt: .now - 60)
        do {
            _ = try await verifier.verify(accessToken: expired)
            XCTFail("An expired token must be rejected.")
        } catch SupabaseAuthenticationError.invalidToken {
            // Expected.
        }

        let wrongAudience = try await fixture.token(audience: "anon")
        do {
            _ = try await verifier.verify(accessToken: wrongAudience)
            XCTFail("A token for a different audience must be rejected.")
        } catch SupabaseAuthenticationError.invalidToken {
            // Expected.
        }

        let attacker = try SupabaseTokenFixture(keyID: "attacker-key")
        let forged = try await attacker.token()
        do {
            _ = try await verifier.verify(accessToken: forged)
            XCTFail("A token with a signature outside the trusted JWKS must be rejected.")
        } catch SupabaseAuthenticationError.invalidToken {
            // Expected.
        }
    }

    func testVerifierFailsClosedWhenJWKSIsUnavailableAndRouteWhenConfigurationIsMissing() async throws {
        let fixture = try SupabaseTokenFixture()
        let configuration = SupabaseAuthenticationConfiguration(
            issuer: "https://project.supabase.co/auth/v1",
            jwksURL: URL(string: "https://project.supabase.co/auth/v1/.well-known/jwks.json")!,
            ownerSubject: "owner-subject",
            ownerAccountID: "owner-account",
            sessionLifetime: 3_600
        )
        let cache = SupabaseJWKSCache(url: configuration.jwksURL, fetcher: { throw TestJWKSFetchError.offline })
        let verifier = SupabaseAccessTokenVerifier(configuration: configuration, jwksCache: cache)
        let token = try await fixture.token()
        do {
            _ = try await verifier.verify(accessToken: token)
            XCTFail("JWKS fetch failure must not permit sign-in.")
        } catch SupabaseAuthenticationError.verificationUnavailable {
            // Expected.
        }

        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
            registerSupabaseAuthenticationRoutes(app, configuration: nil)
        }) { app in
            try await app.test(.POST, "auth/supabase", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: "unused")
            }) { response in
                XCTAssertEqual(response.status, .serviceUnavailable)
            }
        }
    }
}

private struct StubSupabaseValidator: SupabaseAccessTokenValidating {
    let subject: String

    func verify(accessToken: String) async throws -> VerifiedSupabaseIdentity {
        VerifiedSupabaseIdentity(issuer: "https://project.supabase.co/auth/v1", subject: subject)
    }
}

private struct SupabaseTokenFixture {
    let keyID: String
    let privateKey: JWTKit.Insecure.RSA.PrivateKey
    let jwks: String

    init(keyID: String = "test-supabase-key") throws {
        self.keyID = keyID
        privateKey = try JWTKit.Insecure.RSA.PrivateKey(backing: .init(keySize: .bits2048))
        let primitives = try privateKey.publicKey.getKeyPrimitives()
        jwks = #"{"keys":[{"kty":"RSA","kid":"\#(keyID)","use":"sig","alg":"RS256","n":"\#(primitives.modulus.base64URLEncoded)","e":"\#(primitives.publicExponent.base64URLEncoded)"}]}"#
    }

    func token(
        issuer: String = "https://project.supabase.co/auth/v1",
        audience: String = "authenticated",
        expiresAt: Date = .now + 600
    ) async throws -> String {
        let signer = await JWTKeyCollection().add(
            rsa: privateKey,
            digestAlgorithm: .sha256,
            kid: JWKIdentifier(string: keyID)
        )
        return try await signer.sign(
            SupabaseTestToken(
                issuer: .init(value: issuer),
                subject: .init(value: "owner-subject"),
                audience: .init(value: [audience]),
                expiration: .init(value: expiresAt),
                issuedAt: .init(value: .now)
            ),
            kid: JWKIdentifier(string: keyID)
        )
    }
}

private enum TestJWKSFetchError: Error {
    case offline
}

private struct SupabaseTestToken: JWTPayload {
    let issuer: IssuerClaim
    let subject: SubjectClaim
    let audience: AudienceClaim
    let expiration: ExpirationClaim
    let issuedAt: IssuedAtClaim

    enum CodingKeys: String, CodingKey {
        case issuer = "iss"
        case subject = "sub"
        case audience = "aud"
        case expiration = "exp"
        case issuedAt = "iat"
    }

    func verify(using _: some JWTAlgorithm) throws {}
}

private extension Data {
    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

