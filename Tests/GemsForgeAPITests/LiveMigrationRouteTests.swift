import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class LiveMigrationRouteTests: XCTestCase {
    func testPreviewAndConfirmationAreExplicitAndDoNotChangeSchema() async throws {
        try await withApp(configure: { app in registerLiveMigrationRoutes(app) }) { app in
            let preview = LiveMigrationPreviewRequest(operations: [
                LiveMigrationOperationRequest(operation: "create-table", table: "NewLifeTable", columns: ["ID", "Title"])
            ])
            var token = ""

            try await app.test(.POST, "live-database/migrations/preview", beforeRequest: { request in
                try request.content.encode(preview)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let plan = try response.content.decode(LiveMigrationPlan.self)
                token = plan.confirmationToken
                XCTAssertEqual(plan.status, "preview")
                XCTAssertEqual(plan.operations[0].table, "NewLifeTable")
                XCTAssertTrue(plan.warnings.contains { $0.contains("does not execute") })
            }

            let confirmation = LiveMigrationConfirmationRequest(confirmationToken: token)
            try await app.test(.POST, "live-database/migrations/confirm", beforeRequest: { request in
                try request.content.encode(confirmation)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let plan = try response.content.decode(LiveMigrationPlan.self)
                XCTAssertEqual(plan.status, "confirmed-not-applied")
            }

            try await app.test(.POST, "live-database/migrations/confirm", beforeRequest: { request in
                try request.content.encode(confirmation)
            }) { response in XCTAssertEqual(response.status, .conflict) }
        }
    }

    func testPreviewRejectsArbitrarySqlDestructiveOperationsAndInvalidIdentifiers() async throws {
        try await withApp(configure: { app in registerLiveMigrationRoutes(app) }) { app in
            let rejectedRequests = [
                LiveMigrationPreviewRequest(operations: [
                    LiveMigrationOperationRequest(operation: "raw-sql", table: "Domains", columns: ["DROP TABLE Domains"])
                ]),
                LiveMigrationPreviewRequest(operations: [
                    LiveMigrationOperationRequest(operation: "drop-table", table: "Domains", columns: ["ID"])
                ]),
                LiveMigrationPreviewRequest(operations: [
                    LiveMigrationOperationRequest(operation: "create-table", table: "bad-name", columns: ["ID"])
                ])
            ]

            for rejectedRequest in rejectedRequests {
                try await app.test(.POST, "live-database/migrations/preview", beforeRequest: { request in
                    try request.content.encode(rejectedRequest)
                }) { response in XCTAssertEqual(response.status, .badRequest) }
            }
        }
    }
}
