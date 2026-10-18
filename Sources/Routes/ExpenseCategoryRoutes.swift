import Vapor

struct ExpenseCategoryRequest: Content {
    let id: Int?
    let name: String
}

struct ExpenseCategoryCreateRequest: Content {
    let id: Int?
    let name: String

    init(id: Int?, name: String) {
        self.id = id
        self.name = name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        let allowed = Set(["id", "name"])
        guard let unknown = container.allKeys.first(where: { !allowed.contains($0.stringValue) }) else {
            id = try container.decodeIfPresent(Int.self, forKey: DynamicCodingKey(stringValue: "id"))
            name = try container.decode(String.self, forKey: DynamicCodingKey(stringValue: "name"))
            return
        }
        throw DecodingError.dataCorruptedError(forKey: unknown, in: container, debugDescription: "Unknown create field: \(unknown.stringValue).")
    }
}

private struct DynamicCodingKey: CodingKey, Hashable {
    let stringValue: String
    let intValue: Int? = nil
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
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
        try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).list()
    }

    categories.post { request async throws -> ExpenseCategory in
        let createInput = try request.content.decode(ExpenseCategoryCreateRequest.self)
        let input = ExpenseCategoryRequest(id: createInput.id, name: createInput.name)
        try validate(input)

        if let id = input.id,
           try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).find(id: id) != nil
        {
            throw Abort(.conflict, reason: "An expense category with this ID already exists.")
        }

        if try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID)
            .list()
            .contains(where: { $0.name.caseInsensitiveCompare(input.name.trimmingCharacters(in: .whitespacesAndNewlines)) == .orderedSame })
        {
            throw Abort(.conflict, reason: "An expense category with this name already exists.")
        }

        let category = ExpenseCategory(
            id: input.id,
            name: input.name.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).save(category)
        return category
    }

    categories.get(":id") { request async throws -> ExpenseCategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let category = try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return category
    }

    categories.put(":id") { request async throws -> ExpenseCategory in
        guard let id = request.parameters.get("id", as: Int.self),
              let category = try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ExpenseCategoryRequest.self)
        try validate(input)
        category.name = input.name.trimmingCharacters(in: .whitespacesAndNewlines)
        try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).save(category)
        return category
    }

    categories.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id", as: Int.self),
              try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        do {
            try await ExpenseCategoryService(database: request.db, hubID: request.authenticatedHubID).delete(id: id)
        } catch {
            throw Abort(.conflict, reason: "Referenced expense categories cannot be deleted.")
        }

        return .noContent
    }
}
