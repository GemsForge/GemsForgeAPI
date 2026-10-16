import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class ExpenseTransactionRouteTests: XCTestCase {
    func testExpenseTransactionCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateExpenseTransactions())
            app.migrations.add(AddTransactionImage())
            app.migrations.add(CreateFileMetadata())
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
                notes: "Test transaction.",
                image: nil
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
                notes: "Updated transaction.",
                image: nil
            )

            try await app.test(.PUT, "transactions/TRX-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(record.item, "Updated groceries")
                XCTAssertEqual(record.total, 14.00)
            }

            try await app.test(.PATCH, "transactions/TRX-0001", beforeRequest: { request in
                try request.content.encode(ExpenseTransactionPatchRequest(
                    item: "Patched Item",
                    categoryID: nil,
                    quantity: 3.0,
                    total: nil,
                    notes: nil,
                    image: nil
                ))
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(record.quantity, 3.0)
                XCTAssertEqual(record.item, "Patched Item")
            }

            try await app.test(.PATCH, "transactions/TRX-0001", beforeRequest: { request in
                try request.content.encode(["id": "OTHER"])
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.PATCH, "transactions/TRX-0001", beforeRequest: { request in
                try request.content.encode([String: String]())
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
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
            app.migrations.add(AddTransactionImage())
            app.migrations.add(CreateFileMetadata())
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
                notes: nil,
                image: nil
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

    func testExpenseTransactionCanExposeFileMetadataReference() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateExpenseTransactions())
            app.migrations.add(AddTransactionImage())
            app.migrations.add(CreateFileMetadata())
            try await app.autoMigrate()
            registerExpenseTransactionRoutes(app)
        }) { app in
            let metadata = FileMetadata(
                id: "FILE-0001",
                relativePath: "transactions/TRX-0001/receipt.png",
                fileName: "receipt.png",
                fileKind: "receipt",
                mimeType: "image/png",
                byteSize: 128,
                ownerType: "ExpenseTransaction",
                ownerID: "TRX-0001"
            )
            try await metadata.save(on: app.db)

            let payload = ExpenseTransactionRequest(
                id: "TRX-0001",
                receiptID: nil,
                item: "Test receipt",
                firstReceiptItem: true,
                categoryID: 10,
                subcategoryID: nil,
                merchantCode: nil,
                transactionDate: "2026-10-10",
                quantity: 1,
                regularPrice: 12,
                paidPrice: 12,
                total: 12,
                discount: nil,
                notes: nil,
                image: "FILE-0001"
            )

            try await app.test(.POST, "transactions", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let transaction = try response.content.decode(ExpenseTransaction.self)
                XCTAssertEqual(transaction.image, "FILE-0001")
            }

            try await app.test(.GET, "transactions/TRX-0001/image") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let returnedMetadata = try response.content.decode(FileMetadata.self)
                XCTAssertEqual(returnedMetadata.id, "FILE-0001")
                XCTAssertEqual(returnedMetadata.relativePath, "transactions/TRX-0001/receipt.png")
            }

            try await app.test(.POST, "transactions", beforeRequest: { request in
                let invalidReference = ExpenseTransactionRequest(
                    id: "TRX-0002",
                    receiptID: payload.receiptID,
                    item: payload.item,
                    firstReceiptItem: payload.firstReceiptItem,
                    categoryID: payload.categoryID,
                    subcategoryID: payload.subcategoryID,
                    merchantCode: payload.merchantCode,
                    transactionDate: payload.transactionDate,
                    quantity: payload.quantity,
                    regularPrice: payload.regularPrice,
                    paidPrice: payload.paidPrice,
                    total: payload.total,
                    discount: payload.discount,
                    notes: payload.notes,
                    image: "FILE-MISSING"
                )
                try request.content.encode(invalidReference)
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }
        }
    }
}
