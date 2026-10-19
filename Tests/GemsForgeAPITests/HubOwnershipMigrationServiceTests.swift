import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class HubOwnershipMigrationServiceTests: XCTestCase {
    func testLegacyRowsRemainUnownedUntilExplicitReviewedAssignment() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressUpdatedAt())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
            try await AuthenticationAccount(id: "account-1").save(on: app.db)
            try await Hub(id: "hub-1", accountID: "account-1").save(on: app.db)
            try await AddressService(database: app.db, hubID: "hub-1").save(
                Address(id: "ADDR-OWNED", city: "Already assigned", addressStatus: "Current")
            )
            try await Address(id: "ADDR-LEGACY-1", city: "Legacy One", addressStatus: "Former").save(on: app.db)
            try await Address(id: "ADDR-LEGACY-2", city: "Legacy Two", addressStatus: "Former").save(on: app.db)
        }) { app in
            let service = HubOwnershipMigrationService(database: app.db, tables: [Address.schema])
            let preview = try await service.preview(hubID: "hub-1")
            XCTAssertEqual(preview.unownedCounts, [Address.schema: 2])
            let initiallyVisible = try await AddressService(database: app.db, hubID: "hub-1").list()
            XCTAssertEqual(initiallyVisible.compactMap(\.id), ["ADDR-OWNED"])

            let result = try await service.assignUnowned(
                hubID: "hub-1",
                request: HubOwnershipAssignmentRequest(
                    confirmation: HubOwnershipMigrationService.confirmationPhrase,
                    expectedUnownedCounts: preview.unownedCounts
                )
            )
            XCTAssertEqual(result.assignedCounts, [Address.schema: 2])
            let visibleAfterAssignment = try await AddressService(database: app.db, hubID: "hub-1").list()
            XCTAssertEqual(visibleAfterAssignment.count, 3)
            XCTAssertEqual(visibleAfterAssignment.first(where: { $0.id == "ADDR-OWNED" })?.city, "Already assigned")

            do {
                _ = try await service.assignUnowned(
                    hubID: "hub-1",
                    request: HubOwnershipAssignmentRequest(
                        confirmation: HubOwnershipMigrationService.confirmationPhrase,
                        expectedUnownedCounts: preview.unownedCounts
                    )
                )
                XCTFail("A stale preview must not be accepted.")
            } catch HubOwnershipMigrationError.previewMismatch {
                // Expected: operator must re-preview before retrying.
            }
        }
    }

    func testAssignmentRequiresExactConfirmationAndExistingHub() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressUpdatedAt())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            try await app.autoMigrate()
        }) { app in
            let service = HubOwnershipMigrationService(database: app.db, tables: [Address.schema])
            do {
                _ = try await service.assignUnowned(
                    hubID: "missing-hub",
                    request: HubOwnershipAssignmentRequest(
                        confirmation: "yes",
                        expectedUnownedCounts: [Address.schema: 0]
                    )
                )
                XCTFail("Invalid confirmation must fail closed.")
            } catch HubOwnershipMigrationError.confirmationRequired {
                // Expected.
            }

            do {
                _ = try await service.preview(hubID: "missing-hub")
                XCTFail("A missing hub must not receive existing records.")
            } catch HubOwnershipMigrationError.unknownHub {
                // Expected.
            }
        }
    }
}
