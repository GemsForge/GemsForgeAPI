import Crypto
import CryptoExtras
import FluentSQLiteDriver
import JWTKit
import VaporTesting
import XCTest

@testable import GemsForgeAPI

final class AppleAuthenticationTests: XCTestCase {
    func testAppleIdentityTokenValidatesSignatureIssuerAudienceExpiryAndNonce() async throws {
        let fixture = try AppleTokenFixture()
        let verifier = AppleIdentityTokenVerifier(
            clientID: "com.example.gemlife", jwksJSON: fixture.jwks)
        let nonce = "single-use-random-nonce"
        let expectedNonceHash = sha256Hex(nonce)

        let validToken = try await fixture.token(nonce: nonce)
        let identity = try await verifier.verify(
            identityToken: validToken, expectedNonceHash: expectedNonceHash)
        XCTAssertEqual(identity.subject, "apple-subject-1")

        let wrongAudience = try await fixture.token(nonce: nonce, audience: "another.client")
        await assertRejected(verifier, token: wrongAudience, nonceHash: expectedNonceHash)

        let wrongIssuer = try await fixture.token(nonce: nonce, issuer: "https://attacker.example")
        await assertRejected(verifier, token: wrongIssuer, nonceHash: expectedNonceHash)

        let expired = try await fixture.token(nonce: nonce, expiresAt: .now - 60)
        await assertRejected(verifier, token: expired, nonceHash: expectedNonceHash)

        await assertRejected(verifier, token: validToken, nonceHash: sha256Hex("different-nonce"))

        var tokenParts = validToken.split(separator: ".").map(String.init)
        var signature = Array(tokenParts[2])
        let signatureIndex = signature.count / 2
        signature[signatureIndex] = signature[signatureIndex] == "a" ? "b" : "a"
        tokenParts[2] = String(signature)
        await assertRejected(verifier, token: tokenParts.joined(separator: "."), nonceHash: expectedNonceHash)
    }

    func testAppleIdentityTokenRejectsUnknownKeyAndAcceptsRefreshedKeySet() async throws {
        let original = try AppleTokenFixture(keyID: "old-key")
        let rotated = try AppleTokenFixture(keyID: "rotated-key")
        let token = try await rotated.token(nonce: "rotation-nonce")
        let staleVerifier = AppleIdentityTokenVerifier(
            clientID: "com.example.gemlife", jwksJSON: original.jwks)
        await assertRejected(staleVerifier, token: token, nonceHash: sha256Hex("rotation-nonce"))

        let provider = RotatingJWKSProvider(responses: [original.jwks, rotated.jwks])
        let cache = AppleJWKSCache(fetcher: { try await provider.next() })
        let refreshedVerifier = AppleIdentityTokenVerifier(
            clientID: "com.example.gemlife", jwksCache: cache)
        let identity = try await refreshedVerifier.verify(
            identityToken: token,
            expectedNonceHash: sha256Hex("rotation-nonce")
        )
        XCTAssertEqual(identity.subject, "apple-subject-1")
        let fetchCount = await provider.fetchCount
        XCTAssertEqual(fetchCount, 2)
    }

    func testChallengeIsSingleUseAndSessionsAreHashedExpiringAndRevocable() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            try await app.autoMigrate()
        }) { app in
            let now = Date()
            let service = AppleAuthenticationService(
                configuration: .init(
                    clientID: "com.example.gemlife", sessionLifetime: 60, challengeLifetime: 300),
                tokenValidator: StubAppleIdentityValidator()
            )
            let challenge = try await service.createChallenge(on: app.db, now: now)
            XCTAssertEqual(challenge.nonce.count, 43)

            let session = try await service.signIn(
                .init(challengeID: challenge.challengeID, identityToken: "valid-token"),
                on: app.db,
                now: now
            )
            let activeAccountID = try await service.validAccountID(
                forSessionToken: session.sessionToken, on: app.db, now: now)
            let expiredAccountID = try await service.validAccountID(
                forSessionToken: session.sessionToken, on: app.db, now: now.addingTimeInterval(61))
            XCTAssertEqual(activeAccountID, session.accountID)
            XCTAssertNil(expiredAccountID)

            let storedSessionValue = try await AuthenticationSession.query(on: app.db).first()
            let storedSession = try XCTUnwrap(storedSessionValue)
            XCTAssertNotEqual(storedSession.tokenHash, session.sessionToken)
            XCTAssertNil(storedSession.revokedAt)

            do {
                _ = try await service.signIn(
                    .init(challengeID: challenge.challengeID, identityToken: "valid-token"),
                    on: app.db,
                    now: now
                )
                XCTFail("A consumed challenge must not issue another session.")
            } catch AppleAuthenticationError.invalidChallenge {
                // Expected: the persisted challenge was consumed atomically.
            }

            try await service.revokeSession(token: session.sessionToken, on: app.db, now: now)
            let revokedAccountID = try await service.validAccountID(
                forSessionToken: session.sessionToken, on: app.db, now: now)
            let revokedSession = try await AuthenticationSession.query(on: app.db).first()
            XCTAssertNil(revokedAccountID)
            XCTAssertNotNil(revokedSession?.revokedAt)

            let secondChallenge = try await service.createChallenge(on: app.db, now: now)
            _ = try await service.signIn(
                .init(challengeID: secondChallenge.challengeID, identityToken: "valid-token"),
                on: app.db,
                now: now
            )
            let accountCount = try await AppleAccount.query(on: app.db).count()
            XCTAssertEqual(accountCount, 1)
        }
    }

    func testExpiredChallengeCannotBeUsed() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            try await app.autoMigrate()
        }) { app in
            let service = AppleAuthenticationService(
                configuration: .init(
                    clientID: "com.example.gemlife", sessionLifetime: 60, challengeLifetime: 300),
                tokenValidator: StubAppleIdentityValidator()
            )
            let expiredChallenge = try await service.createChallenge(
                on: app.db, now: Date().addingTimeInterval(-301))
            do {
                _ = try await service.signIn(
                    .init(challengeID: expiredChallenge.challengeID, identityToken: "valid-token"),
                    on: app.db
                )
                XCTFail("An expired challenge must not create an account or session.")
            } catch AppleAuthenticationError.invalidChallenge {
                let accountCount = try await AppleAccount.query(on: app.db).count()
                let sessionCount = try await AuthenticationSession.query(on: app.db).count()
                XCTAssertEqual(accountCount, 0)
                XCTAssertEqual(sessionCount, 0)
            }
        }
    }

    func testAppleAuthenticationRoutesIssueAndRevokeSessions() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            try await app.autoMigrate()
            registerAppleAuthenticationRoutes(
                app,
                configuration: .init(
                    clientID: "com.example.gemlife", sessionLifetime: 60, challengeLifetime: 300),
                tokenValidator: StubAppleIdentityValidator()
            )
        }) { app in
            var challenge: AppleChallengeResponse?
            try await app.test(.POST, "auth/apple/challenges") { response async throws in
                XCTAssertEqual(response.status, .ok)
                challenge = try response.content.decode(AppleChallengeResponse.self)
            }
            let createdChallenge = try XCTUnwrap(challenge)

            var session: AppleSessionResponse?
            try await app.test(
                .POST, "auth/apple",
                beforeRequest: { request in
                    try request.content.encode(
                        AppleSignInRequest(
                            challengeID: createdChallenge.challengeID,
                            identityToken: "valid-token"
                        ))
                }
            ) { response async throws in
                XCTAssertEqual(response.status, .ok)
                session = try response.content.decode(AppleSessionResponse.self)
            }
            let createdSession = try XCTUnwrap(session)

            try await app.test(
                .POST, "auth/logout",
                beforeRequest: { request in
                    request.headers.bearerAuthorization = .init(token: createdSession.sessionToken)
                }
            ) { response in
                XCTAssertEqual(response.status, .noContent)
            }

            let revokedSession = try await serviceSession(createdSession.sessionToken, on: app.db)
            XCTAssertNotNil(revokedSession?.revokedAt)
        }
    }

    func testAppleAuthenticationIsUnavailableWithoutExplicitClientConfiguration() async throws {
        try await withApp(configure: { app in
            registerAppleAuthenticationRoutes(app, configuration: nil)
        }) { app in
            try await app.test(.POST, "auth/apple/challenges") { response in
                XCTAssertEqual(response.status, .serviceUnavailable)
            }
        }
    }

    private func serviceSession(_ token: String, on database: any Database) async throws
        -> AuthenticationSession?
    {
        let tokenHash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }
            .joined()
        return try await AuthenticationSession.query(on: database)
            .filter(\.$tokenHash == tokenHash).first()
    }

    private func assertRejected(
        _ verifier: AppleIdentityTokenVerifier,
        token: String,
        nonceHash: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        do {
            _ = try await verifier.verify(identityToken: token, expectedNonceHash: nonceHash)
            XCTFail("Expected the identity token to be rejected.", file: file, line: line)
        } catch {
            // All externally supplied identity-token failures are rejected.
        }
    }

    private func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private struct StubAppleIdentityValidator: AppleIdentityTokenValidating {
    func verify(identityToken: String, expectedNonceHash: String) async throws
        -> VerifiedAppleIdentity
    {
        guard identityToken == "valid-token", !expectedNonceHash.isEmpty else {
            throw AppleAuthenticationError.invalidIdentityToken
        }
        return VerifiedAppleIdentity(subject: "apple-subject-1")
    }
}

private struct AppleTokenFixture {
    let keyID: String
    let privateKey: JWTKit.Insecure.RSA.PrivateKey
    let jwks: String

    init(keyID: String = "test-key") throws {
        self.keyID = keyID
        self.privateKey = try JWTKit.Insecure.RSA.PrivateKey(backing: .init(keySize: .bits2048))
        let primitives = try privateKey.publicKey.getKeyPrimitives()
        jwks = """
            {"keys":[{"kty":"RSA","kid":"\(keyID)","use":"sig","alg":"RS256","n":"\(primitives.modulus.base64URLEncoded)","e":"\(primitives.publicExponent.base64URLEncoded)"}]}
            """
    }

    func token(
        nonce: String,
        issuer: String = "https://appleid.apple.com",
        audience: String = "com.example.gemlife",
        expiresAt: Date = .now + 600
    ) async throws -> String {
        let signer = await JWTKeyCollection().add(
            rsa: privateKey,
            digestAlgorithm: .sha256,
            kid: JWKIdentifier(string: keyID)
        )
        let payload = AppleIdentityToken(
            issuer: .init(value: issuer),
            audience: .init(value: audience),
            expires: .init(value: expiresAt),
            issuedAt: .init(value: .now),
            subject: .init(value: "apple-subject-1"),
            nonceSupported: true,
            nonce: nonce
        )
        return try await signer.sign(payload, kid: JWKIdentifier(string: keyID))
    }
}

private actor RotatingJWKSProvider {
    private var responses: [String]
    private(set) var fetchCount = 0

    init(responses: [String]) {
        self.responses = responses
    }

    func next() throws -> String {
        fetchCount += 1
        guard !responses.isEmpty else { throw AppleAuthenticationError.verificationUnavailable }
        return responses.removeFirst()
    }
}

extension Data {
    fileprivate var base64URLEncoded: String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
