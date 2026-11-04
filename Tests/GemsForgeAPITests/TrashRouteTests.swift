import Foundation
import Crypto
import Fluent
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class TrashRouteTests: XCTestCase {
    func testTrashIsHubScopedRestorableAndPermanentlyDeletesOnlyArchivedRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressUpdatedAt())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateRecordPresentations())
            app.migrations.add(CreateTrashEntries())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerTrashRoutes(app)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            let tokenB = try await self.seedSession(on: app.db, accountID: "account-b", hubID: "hub-b")
            try await AddressService(database: app.db, hubID: "hub-a").save(
                Address(id: "ADDR-A", city: "Boston", addressStatus: "Current")
            )
            try await AddressService(database: app.db, hubID: "hub-b").save(
                Address(id: "ADDR-B", city: "Salem", addressStatus: "Current")
            )

            let entry = TrashEntryRequest(
                tableName: "Addresses",
                recordID: "ADDR-A",
                title: "Boston home",
                snapshot: #"{"id":"ADDR-A","city":"Boston"}"#
            )
            try await app.test(.POST, "trash", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TrashEntryRequest(
                    tableName: "Addresses",
                    recordID: "ADDR-A",
                    title: "Spoofed snapshot",
                    snapshot: #"{"id":"ADDR-B","city":"Salem"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
            try await app.test(.POST, "trash", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(entry)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let saved = try response.content.decode(TrashEntryResponse.self)
                XCTAssertEqual(saved.tableName, "Addresses")
                XCTAssertEqual(saved.recordID, "ADDR-A")
            }

            try await app.test(.GET, "trash", beforeRequest: { $0.headers.bearerAuthorization = .init(token: tokenB) }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertTrue(try response.content.decode([TrashEntryResponse].self).isEmpty)
            }

            try await app.test(.POST, "trash", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TrashEntryRequest(
                    tableName: "Addresses",
                    recordID: "ADDR-B",
                    title: "Other hub address",
                    snapshot: #"{"id":"ADDR-B"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }

            let savedEntryResult = try await TrashEntry.query(on: app.db).filter(\.$hubID == "hub-a").first()
            let savedEntry = try XCTUnwrap(savedEntryResult)
            let savedID = try XCTUnwrap(savedEntry.id)
            try await app.test(.POST, "trash/\(savedID)/restore", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let restoredAddress = try await AddressService(database: app.db, hubID: "hub-a").find(id: "ADDR-A")
            XCTAssertNotNil(restoredAddress)

            let secondEntry = TrashEntryRequest(
                tableName: "Addresses",
                recordID: "ADDR-A",
                title: "Boston home",
                snapshot: #"{"id":"ADDR-A","city":"Boston"}"#
            )
            try await app.test(.POST, "trash", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(secondEntry)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }
            let permanentEntry = try await TrashEntry.query(on: app.db).filter(\.$hubID == "hub-a").first()
            let permanentID = try XCTUnwrap(permanentEntry?.id)
            try await app.test(.DELETE, "trash/\(permanentID)", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let deletedAddress = try await AddressService(database: app.db, hubID: "hub-a").find(id: "ADDR-A")
            XCTAssertNil(deletedAddress)
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "trash-session-\(accountID)"
        let digest = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: digest,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
