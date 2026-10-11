import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ExpenseTransactionRouteTests: XCTestCase {
    func testExpenseTransactionCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateExpenseTransactions())
            try await app.autoMigrate()
            registerExpenseTransactionRoutes(app)
        }) { app in
            let payload = ExpenseTransactionRequest(
                id: "TRX-0001",
                receiptID: "REC-0001",
                item: "Test groceries",
                firstReceiptItem: true,
                categoryID: 10,
                subcategoryID: 4,
                merchantCode: "TEST",
                transactionDate: "2026-10-10",
                quantity: 2,
                regularPrice: 8.00,
                paidPrice: 7.50,
                total: 15.00,
                discount: 1.00,
                notes: "Test transaction."
            )

            try await app.test(.POST, "transactions", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(record.id, "TRX-0001")
                XCTAssertEqual(record.item, "Test groceries")
                XCTAssertEqual(record.total, 15.00)
            }

            try await app.test(.GET, "transactions") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let records = try response.content.decode([ExpenseTransaction].self)
                XCTAssertEqual(records.count, 1)
                XCTAssertEqual(records.first?.categoryID, 10)
            }

            try await app.test(.GET, "transactions/TRX-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(record.receiptID, "REC-0001")
                XCTAssertEqual(record.subcategoryID, 4)
            }

            let updatedPayload = ExpenseTransactionRequest(
                id: "TRX-0001",
                receiptID: "REC-0001",
                item: "Updated groceries",
                firstReceiptItem: true,
                categoryID: 10,
                subcategoryID: 4,
                merchantCode: "TEST",
                transactionDate: "2026-10-10",
                quantity: 2,
                regularPrice: 8.00,
                paidPrice: 7.00,
                total: 14.00,
                discount: 2.00,
                notes: "Updated transaction."
            )

            try await app.test(.PUT, "transactions/TRX-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(record.item, "Updated groceries")
                XCTAssertEqual(record.total, 14.00)
            }

            try await app.test(.DELETE, "transactions/TRX-0001") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "transactions/TRX-0001") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testExpenseTransactionRejectsInvalidPayloadAndMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateExpenseTransactions())
            try await app.autoMigrate()
            registerExpenseTransactionRoutes(app)
        }) { app in
            let invalidPayload = ExpenseTransactionRequest(
                id: "TRX-0001",
                receiptID: nil,
                item: "",
                firstReceiptItem: false,
                categoryID: 0,
                subcategoryID: nil,
                merchantCode: nil,
                transactionDate: nil,
                quantity: 0,
                regularPrice: nil,
                paidPrice: -1,
                total: nil,
                discount: nil,
                notes: nil
            )

            try await app.test(.POST, "transactions", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "transactions/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.PUT, "transactions/MISSING", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "transactions/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
