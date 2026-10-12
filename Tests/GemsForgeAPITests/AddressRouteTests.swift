import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class AddressRouteTests: XCTestCase {
    func testAddressCRUDAndSummaryPrivacy() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressAttachmentReference())
            try await app.autoMigrate()
            registerAddressRoutes(app)
        }) { app in
            let payload = AddressRequest(
                id: "ADDR-0001",
                addressType: "Residence",
                addressLine1: "123 Test Street",
                addressLine2: "Unit 4",
                city: "Atlanta",
                state: "GA",
                postalCode: "30301",
                country: "US",
                startDate: "2026-01-01",
                endDate: nil,
                addressStatus: "Current",
                notes: "Private test address."
            )

            try await app.test(.POST, "addresses", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let address = try response.content.decode(AddressDetailResponse.self)
                XCTAssertEqual(address.id, "ADDR-0001")
                XCTAssertEqual(address.addressLine1, "123 Test Street")
            }

            try await app.test(.GET, "addresses") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let summaries = try response.content.decode([AddressSummaryResponse].self)
                XCTAssertEqual(summaries.count, 1)
                XCTAssertEqual(summaries[0].city, "Atlanta")
                let responseText = String(buffer: response.body)
                XCTAssertFalse(responseText.contains("123 Test Street"))
                XCTAssertFalse(responseText.contains("30301"))
            }

            try await app.test(.GET, "addresses/ADDR-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let address = try response.content.decode(AddressDetailResponse.self)
                XCTAssertEqual(address.postalCode, "30301")
            }

            let updatedPayload = AddressRequest(
                id: "ADDR-0001",
                addressType: "Residence",
                addressLine1: "456 Updated Street",
                addressLine2: nil,
                city: "Decatur",
                state: "GA",
                postalCode: "30030",
                country: "US",
                startDate: "2026-01-01",
                endDate: nil,
                addressStatus: "Current",
                notes: nil
            )

            try await app.test(.PUT, "addresses/ADDR-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let address = try response.content.decode(AddressDetailResponse.self)
                XCTAssertEqual(address.city, "Decatur")
            }

            try await app.test(.DELETE, "addresses/ADDR-0001") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "addresses/ADDR-0001") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testAddressRejectsInvalidPayloadAndMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressAttachmentReference())
            try await app.autoMigrate()
            registerAddressRoutes(app)
        }) { app in
            let invalidPayload = AddressRequest(
                id: "ADDR-0001",
                addressType: nil,
                addressLine1: nil,
                addressLine2: nil,
                city: nil,
                state: nil,
                postalCode: nil,
                country: nil,
                startDate: nil,
                endDate: nil,
                addressStatus: "",
                notes: nil
            )

            try await app.test(.POST, "addresses", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "addresses/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.PUT, "addresses/MISSING", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "addresses/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
