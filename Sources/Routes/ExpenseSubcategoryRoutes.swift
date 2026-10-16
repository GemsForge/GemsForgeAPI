import Fluent
import Vapor

struct ExpenseSubcategoryRequest: Content {
    let id: Int?
    let categoryID: Int
    let name: String
}

typealias ExpenseSubcategoryCreateRequest = ExpenseSubcategoryRequest

private func validate(_ input: ExpenseSubcategoryRequest) throws {
    guard input.categoryID > 0 else {
        throw Abort(.badRequest, reason: "CategoryID must be greater than zero.")
    }

    guard !input.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Subcategory name is required.")
    }
}

private func makeSubcategory(from input: ExpenseSubcategoryRequest, id: Int?) -> ExpenseSubcategory {
    ExpenseSubcategory(
        id: id,
        categoryID: input.categoryID,
        name: input.name.trimmingCharacters(in: .whitespacesAndNewlines)
    )
}

private func ensureCategoryExists(_ categoryID: Int, database: any Database) async throws {
    guard try await ExpenseCategoryService(database: database).find(id: categoryID) != nil else {
        throw Abort(.unprocessableEntity, reason: "The parent expense category does not exist.")
    }
}

private func ensureNameIsAvailable(
    _ name: String,
    categoryID: Int,
    excludingID: Int? = nil,
    database: any Database
) async throws {
    let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    let matches = try await ExpenseSubcategoryService(database: database).list(categoryID: categoryID)

    if matches.contains(where: {
        $0.id != excludingID && $0.name.caseInsensitiveCompare(normalizedName) == .orderedSame
    }) {
        throw Abort(.conflict, reason: "A subcategory with this name already exists in the category.")
    }
}

/// Registers CRUD endpoints for the existing BudgetSubcategories reference table.
func registerExpenseSubcategoryRoutes(_ app: Application) {
    let subcategories = app.grouped("expense-subcategories")

    subcategories.get { request async throws -> [ExpenseSubcategory] in
        let categoryID = request.query[Int.self, at: "categoryID"]
        return try await ExpenseSubcategoryService(database: request.db).list(categoryID: categoryID)
    }

    subcategories.post { request async throws -> ExpenseSubcategory in
        let input = try request.content.decode(ExpenseSubcategoryCreateRequest.self)
        try validate(input)
        try await ensureCategoryExists(input.categoryID, database: request.db)
        try await ensureNameIsAvailable(input.name, categoryID: input.categoryID, database: request.db)

        if let id = input.id,
           try await ExpenseSubcategoryService(database: request.db).find(id: id) != nil
        {
            throw Abort(.conflict, reason: "An expense subcategory with this ID already exists.")
        }

        let subcategory = makeSubcategory(from: input, id: input.id)
        try await ExpenseSubcategoryService(database: request.db).save(subcategory)
        return subcategory
    }

    subcategories.get(":id") { request async throws -> ExpenseSubcategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let subcategory = try await ExpenseSubcategoryService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return subcategory
    }

    subcategories.put(":id") { request async throws -> ExpenseSubcategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let subcategory = try await ExpenseSubcategoryService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ExpenseSubcategoryRequest.self)
        try validate(input)
        try await ensureCategoryExists(input.categoryID, database: request.db)
        try await ensureNameIsAvailable(input.name, categoryID: input.categoryID, excludingID: id, database: request.db)

        let replacement = makeSubcategory(from: input, id: id)
        subcategory.categoryID = replacement.categoryID
        subcategory.name = replacement.name
        try await ExpenseSubcategoryService(database: request.db).save(subcategory)
        return subcategory
    }

    subcategories.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id", as: Int.self),
              try await ExpenseSubcategoryService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        do {
            try await ExpenseSubcategoryService(database: request.db).delete(id: id)
        } catch {
            throw Abort(.conflict, reason: "Referenced expense subcategories cannot be deleted.")
        }

        return .noContent
    }
}
