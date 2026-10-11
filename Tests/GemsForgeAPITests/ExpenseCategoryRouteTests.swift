import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class ExpenseCategoryRouteTests: XCTestCase {
    func testExpenseCategoryCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateBudgetCategories())
            try await app.autoMigrate()
            registerExpenseCategoryRoutes(app)
        }) { app in
            let payload = ExpenseCategoryRequest(id: nil, name: "Housing")

            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let category = try response.content.decode(ExpenseCategory.self)
                XCTAssertEqual(category.id, 1)
                XCTAssertEqual(category.name, "Housing")
            }

            try await app.test(.GET, "expense-categories") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let categories = try response.content.decode([ExpenseCategory].self)
                XCTAssertEqual(categories.map(\.name), ["Housing"])
            }

            try await app.test(.GET, "expense-categories/1") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let category = try response.content.decode(ExpenseCategory.self)
                XCTAssertEqual(category.name, "Housing")
            }

            let updatedPayload = ExpenseCategoryRequest(id: 1, name: "Home")
            try await app.test(.PUT, "expense-categories/1", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let category = try response.content.decode(ExpenseCategory.self)
                XCTAssertEqual(category.name, "Home")
            }

            try await app.test(.DELETE, "expense-categories/1") { response in
                XCTAssertEqual(response.status, .noContent)
            }
        }
    }

    func testExpenseCategoryRejectsInvalidAndDuplicateRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateBudgetCategories())
            try await app.autoMigrate()
            registerExpenseCategoryRoutes(app)
        }) { app in
            let emptyPayload = ExpenseCategoryRequest(id: nil, name: "   ")
            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(emptyPayload)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let payload = ExpenseCategoryRequest(id: 7, name: "Health")
            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            let duplicateName = ExpenseCategoryRequest(id: nil, name: "health")
            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(duplicateName)
            }) { response in
                XCTAssertEqual(response.status, .conflict)
            }

            try await app.test(.GET, "expense-categories/999") { response in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "expense-categories/999") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
