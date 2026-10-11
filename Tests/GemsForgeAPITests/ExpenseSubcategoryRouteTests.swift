import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class ExpenseSubcategoryRouteTests: XCTestCase {
    func testExpenseSubcategoryCRUDAndCategoryFilter() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateBudgetCategories())
            app.migrations.add(CreateBudgetSubcategories())
            try await app.autoMigrate()
            registerExpenseCategoryRoutes(app)
            registerExpenseSubcategoryRoutes(app)
        }) { app in
            let category = ExpenseCategoryRequest(id: 1, name: "Housing")
            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(category)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            let payload = ExpenseSubcategoryRequest(id: nil, categoryID: 1, name: "Rent")
            try await app.test(.POST, "expense-subcategories", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let subcategory = try response.content.decode(ExpenseSubcategory.self)
                XCTAssertEqual(subcategory.id, 1)
                XCTAssertEqual(subcategory.categoryID, 1)
                XCTAssertEqual(subcategory.name, "Rent")
            }

            try await app.test(.GET, "expense-subcategories?categoryID=1") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let subcategories = try response.content.decode([ExpenseSubcategory].self)
                XCTAssertEqual(subcategories.map(\.name), ["Rent"])
            }

            try await app.test(.GET, "expense-subcategories/1") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let subcategory = try response.content.decode(ExpenseSubcategory.self)
                XCTAssertEqual(subcategory.name, "Rent")
            }

            let updatedPayload = ExpenseSubcategoryRequest(id: 1, categoryID: 1, name: "Mortgage")
            try await app.test(.PUT, "expense-subcategories/1", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let subcategory = try response.content.decode(ExpenseSubcategory.self)
                XCTAssertEqual(subcategory.name, "Mortgage")
            }

            try await app.test(.DELETE, "expense-subcategories/1") { response in
                XCTAssertEqual(response.status, .noContent)
            }
        }
    }

    func testExpenseSubcategoryRequiresValidParentAndUniqueName() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateBudgetCategories())
            app.migrations.add(CreateBudgetSubcategories())
            try await app.autoMigrate()
            registerExpenseCategoryRoutes(app)
            registerExpenseSubcategoryRoutes(app)
        }) { app in
            let category = ExpenseCategoryRequest(id: 1, name: "Life")
            try await app.test(.POST, "expense-categories", beforeRequest: { request in
                try request.content.encode(category)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            let missingParent = ExpenseSubcategoryRequest(id: nil, categoryID: 999, name: "Unknown")
            try await app.test(.POST, "expense-subcategories", beforeRequest: { request in
                try request.content.encode(missingParent)
            }) { response in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            let payload = ExpenseSubcategoryRequest(id: 4, categoryID: 1, name: "Utilities")
            try await app.test(.POST, "expense-subcategories", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            let duplicate = ExpenseSubcategoryRequest(id: nil, categoryID: 1, name: "utilities")
            try await app.test(.POST, "expense-subcategories", beforeRequest: { request in
                try request.content.encode(duplicate)
            }) { response in
                XCTAssertEqual(response.status, .conflict)
            }

            let emptyName = ExpenseSubcategoryRequest(id: nil, categoryID: 1, name: "   ")
            try await app.test(.POST, "expense-subcategories", beforeRequest: { request in
                try request.content.encode(emptyName)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
        }
    }
}
