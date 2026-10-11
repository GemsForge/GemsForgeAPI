import Vapor

struct ExpenseCategoryRequest: Content {
    let id: Int?
    let name: String
}

private func validate(_ input: ExpenseCategoryRequest) throws {
    guard !input.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Category name is required.")
    }
}

/// Registers CRUD endpoints for the existing BudgetCategories reference table.
func registerExpenseCategoryRoutes(_ app: Application) {
    let categories = app.grouped("expense-categories")

    categories.get { request async throws -> [ExpenseCategory] in
        try await ExpenseCategoryService(database: request.db).list()
    }

    categories.post { request async throws -> ExpenseCategory in
        let input = try request.content.decode(ExpenseCategoryRequest.self)
        try validate(input)

        if let id = input.id,
           try await ExpenseCategoryService(database: request.db).find(id: id) != nil
        {
            throw Abort(.conflict, reason: "An expense category with this ID already exists.")
        }

        if try await ExpenseCategoryService(database: request.db)
            .list()
            .contains(where: { $0.name.caseInsensitiveCompare(input.name.trimmingCharacters(in: .whitespacesAndNewlines)) == .orderedSame })
        {
            throw Abort(.conflict, reason: "An expense category with this name already exists.")
        }

        let category = ExpenseCategory(
            id: input.id,
            name: input.name.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        try await ExpenseCategoryService(database: request.db).save(category)
        return category
    }

    categories.get(":id") { request async throws -> ExpenseCategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let category = try await ExpenseCategoryService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return category
    }

    categories.put(":id") { request async throws -> ExpenseCategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let category = try await ExpenseCategoryService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ExpenseCategoryRequest.self)
        try validate(input)
        category.name = input.name.trimmingCharacters(in: .whitespacesAndNewlines)
        try await ExpenseCategoryService(database: request.db).save(category)
        return category
    }

    categories.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id", as: Int.self),
              try await ExpenseCategoryService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        do {
            try await ExpenseCategoryService(database: request.db).delete(id: id)
        } catch {
            throw Abort(.conflict, reason: "Referenced expense categories cannot be deleted.")
        }

        return .noContent
    }
}
