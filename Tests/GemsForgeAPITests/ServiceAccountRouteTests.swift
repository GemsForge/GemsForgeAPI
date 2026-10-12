import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ServiceAccountRouteTests: XCTestCase {
    func testServiceAccountCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateServiceAccounts())
            app.migrations.add(AddServiceAccountAttachmentReference())
            try await app.autoMigrate()
            registerServiceAccountRoutes(app)
        }) { app in
            let payload = ServiceAccountRequest(
                id: nil,
                service: "Example Streaming",
                logoKey: "example-streaming",
                type: "Subscription",
                expenseGroup: "Fixed Bills (Obligations)",
                monthlyAmount: 15.99,
                interestRate: nil,
                apr: nil,
                due: "15th",
                occurrence: "Monthly",
                status: "Active",
                since: "2025-01-01",
                website: "https://example.com",
                notes: "Test service account.",
                notionPage: nil,
                paymentMethod: "Card",
                accountNumber: nil,
                emailUpdated: nil,
                associatedAddress: nil,
                serviceKey: "EXAMPLE_STREAMING"
            )

            try await app.test(.POST, "service-accounts", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let account = try response.content.decode(ServiceAccount.self)
                XCTAssertNotNil(account.id)
                XCTAssertEqual(account.service, "Example Streaming")
            }

            try await app.test(.GET, "service-accounts") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let accounts = try response.content.decode([ServiceAccount].self)
                XCTAssertEqual(accounts.count, 1)
                XCTAssertEqual(accounts.first?.monthlyAmount, 15.99)
            }

            try await app.test(.GET, "service-accounts/1") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let account = try response.content.decode(ServiceAccount.self)
                XCTAssertEqual(account.serviceKey, "EXAMPLE_STREAMING")
            }

            let updatedPayload = ServiceAccountRequest(
                id: 1,
                service: "Example Streaming",
                logoKey: "example-streaming",
                type: "Subscription",
                expenseGroup: "Fixed Bills (Obligations)",
                monthlyAmount: 17.99,
                interestRate: nil,
                apr: nil,
                due: "15th",
                occurrence: "Monthly",
                status: "Paused",
                since: "2025-01-01",
                website: "https://example.com",
                notes: "Updated test service account.",
                notionPage: nil,
                paymentMethod: "Card",
                accountNumber: nil,
                emailUpdated: nil,
                associatedAddress: nil,
                serviceKey: "EXAMPLE_STREAMING"
            )

            try await app.test(.PUT, "service-accounts/1", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let account = try response.content.decode(ServiceAccount.self)
                XCTAssertEqual(account.monthlyAmount, 17.99)
                XCTAssertEqual(account.status, "Paused")
            }

            try await app.test(.DELETE, "service-accounts/1") { response in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "service-accounts/1") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testServiceAccountRejectsInvalidPayloadAndMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateServiceAccounts())
            app.migrations.add(AddServiceAccountAttachmentReference())
            try await app.autoMigrate()
            registerServiceAccountRoutes(app)
        }) { app in
            let invalidPayload = ServiceAccountRequest(
                id: nil,
                service: " ",
                logoKey: nil,
                type: nil,
                expenseGroup: nil,
                monthlyAmount: -1,
                interestRate: nil,
                apr: nil,
                due: nil,
                occurrence: nil,
                status: nil,
                since: nil,
                website: nil,
                notes: nil,
                notionPage: nil,
                paymentMethod: nil,
                accountNumber: nil,
                emailUpdated: nil,
                associatedAddress: nil,
                serviceKey: nil
            )

            try await app.test(.POST, "service-accounts", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "service-accounts/MISSING") { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.PUT, "service-accounts/999", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "service-accounts/999") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
