import Crypto
import Fluent
import FluentSQLiteDriver
import Vapor
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class RecordPresentationRouteTests: XCTestCase {
    func testRecordPresentationIsHubScopedAndValidatesOwnedRecordAndImageReference() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressUpdatedAt())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
            app.migrations.add(AddTableViewWorkspaceState())
            app.migrations.add(CreateRecordPresentations())
            try await app.autoMigrate()
            app.middleware.use(SessionAuthenticationMiddleware(operatorAccountID: "account-a"))
            registerRecordPresentationRoutes(app)
            registerTableViewRoutes(app)
            registerLiveMigrationRoutes(app, backupConfiguration: nil)
        }) { app in
            let tokenA = try await self.seedSession(on: app.db, accountID: "account-a", hubID: "hub-a")
            let tokenB = try await self.seedSession(on: app.db, accountID: "account-b", hubID: "hub-b")
            try await AddressService(database: app.db, hubID: "hub-a").save(
                Address(id: "ADDR-A", city: "Owned by A", addressStatus: "Current")
            )
            try await AddressService(database: app.db, hubID: "hub-b").save(
                Address(id: "ADDR-B", city: "Owned by B", addressStatus: "Current")
            )
            let fileA = FileMetadata(
                id: "FILE-A", relativePath: "uploads/a.png", fileName: "a.png",
                fileKind: "image", mimeType: "image/png", ownerType: "RecordPresentation.Addresses", ownerID: "ADDR-A"
            )
            fileA.hubID = "hub-a"
            try await fileA.save(on: app.db)
            let fileB = FileMetadata(
                id: "FILE-B", relativePath: "uploads/b.png", fileName: "b.png",
                fileKind: "image", mimeType: "image/png", ownerType: "RecordPresentation.Addresses", ownerID: "ADDR-B"
            )
            fileB.hubID = "hub-b"
            try await fileB.save(on: app.db)

            let valid = RecordPresentationRequest(
                presentation: #"{"source":"upload","fileMetadataID":"FILE-A","position":{"x":50,"y":50}}"#
            )
            try await app.test(.PUT, "record-presentations/Addresses/ADDR-A", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(valid)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(RecordPresentationResponse.self).recordID, "ADDR-A")
            }

            let workspace = #"{"activeViewId":"gallery","selectedRecordId":"ADDR-A","galleryCardSize":"medium","galleryFillMedia":false}"#
            try await app.test(.PUT, "table-views/Addresses/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(
                    workspaceState: #"{"activeViewId":"gallery","selectedRecordId":"ADDR-B"}"#
                ))
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }
            try await app.test(.PUT, "table-views/Addresses/Gallery/workspace-state", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewWorkspaceStateRequest(workspaceState: workspace))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertEqual(try response.content.decode(TableViewResponse.self).workspaceState, workspace)
            }
            try await app.test(.GET, "table-views/Addresses/Gallery", beforeRequest: { $0.headers.bearerAuthorization = .init(token: tokenA) }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let saved = try response.content.decode(SavedTableViewResponse.self)
                XCTAssertEqual(saved.view.workspaceState, workspace)
            }
            let savedView = try await TableView.query(on: app.db).filter(\.$tableName == "Addresses").first()
            let viewID = try XCTUnwrap(savedView?.id)
            try await ViewQueryConfiguration(
                viewID: viewID,
                nodeType: .condition,
                columnName: "City",
                comparisonOperator: .contains,
                valueType: .text,
                value: "Boston"
            ).save(on: app.db)
            try await app.test(.PUT, "table-views/Addresses/Gallery/columns", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(TableViewColumnsRequest(columns: [
                    SavedTableColumnRequest(columnName: "City", isVisible: true, sortOrder: 0, width: 180),
                ]))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let saved = try response.content.decode(SavedTableViewResponse.self)
                XCTAssertEqual(saved.columns.map(\.columnName), ["City"])
                XCTAssertEqual(saved.queries.count, 1)
                XCTAssertEqual(saved.view.workspaceState, workspace)
            }

            try await app.test(.GET, "record-presentations/Addresses", beforeRequest: { $0.headers.bearerAuthorization = .init(token: tokenB) }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                XCTAssertTrue(try response.content.decode([RecordPresentationResponse].self).isEmpty)
            }

            let foreignFile = RecordPresentationRequest(
                presentation: #"{"source":"upload","fileMetadataID":"FILE-B"}"#
            )
            try await app.test(.PUT, "record-presentations/Addresses/ADDR-A", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(foreignFile)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.PUT, "record-presentations/Addresses/ADDR-B", beforeRequest: { request in
                request.headers.bearerAuthorization = .init(token: tokenA)
                try request.content.encode(RecordPresentationRequest(presentation: #"{"source":"color"}"#))
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "record-presentations/Addresses/ADDR-A", beforeRequest: { $0.headers.bearerAuthorization = .init(token: tokenA) }) { response in
                XCTAssertEqual(response.status, .noContent)
            }
            let count = try await RecordPresentation.query(on: app.db).count()
            XCTAssertEqual(count, 0)

            try await app.test(.POST, "live-database/repository-migrations/preview", beforeRequest: {
                $0.headers.bearerAuthorization = .init(token: tokenA)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let preview = try response.content.decode(LiveRepositoryMigrationPreview.self)
                XCTAssertEqual(preview.status, "preview")
                XCTAssertTrue(preview.migrationNames.contains("AddTableViewWorkspaceState"))
                XCTAssertTrue(preview.migrationNames.contains("CreateRecordPresentations"))
            }
        }
    }

    private func seedSession(on database: any Database, accountID: String, hubID: String) async throws -> String {
        try await AuthenticationAccount(id: accountID).save(on: database)
        try await Hub(id: hubID, accountID: accountID).save(on: database)
        let token = "record-presentation-session-\(accountID)"
        let digest = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try await AuthenticationSession(
            accountID: accountID,
            tokenHash: digest,
            expiresAt: Date().addingTimeInterval(3_600)
        ).save(on: database)
        return token
    }
}
