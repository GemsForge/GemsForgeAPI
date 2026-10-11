import Vapor

/// The fields accepted when creating or replacing an expense transaction.
struct ExpenseTransactionRequest: Content {
    let id: String?
    let receiptID: String?
    let item: String
    let firstReceiptItem: Bool
    let categoryID: Int
    let subcategoryID: Int?
    let merchantCode: String?
    let transactionDate: String?
    let quantity: Double
    let regularPrice: Double?
    let paidPrice: Double?
    let total: Double?
    let discount: Double?
    let notes: String?
}

private func validate(_ input: ExpenseTransactionRequest, requiresID: Bool = false) throws {
    guard !input.item.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Transaction item is required.")
    }

    guard input.categoryID > 0 else {
        throw Abort(.badRequest, reason: "CategoryID must be greater than zero.")
    }

    guard input.quantity > 0 else {
        throw Abort(.badRequest, reason: "Quantity must be greater than zero.")
    }

    let prices = [input.regularPrice, input.paidPrice, input.total, input.discount]
    guard prices.compactMap({ $0 }).allSatisfy({ $0 >= 0 }) else {
        throw Abort(.badRequest, reason: "Transaction prices and discounts cannot be negative.")
    }

    if requiresID {
        guard let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else {
            throw Abort(.badRequest, reason: "TransactionID is required when creating a transaction.")
        }
    }
}

private func makeTransaction(from input: ExpenseTransactionRequest, id: String?) -> ExpenseTransaction {
    ExpenseTransaction(
        id: id,
        receiptID: input.receiptID,
        item: input.item,
        firstReceiptItem: input.firstReceiptItem,
        categoryID: input.categoryID,
        subcategoryID: input.subcategoryID,
        merchantCode: input.merchantCode,
        transactionDate: input.transactionDate,
        quantity: input.quantity,
        regularPrice: input.regularPrice,
        paidPrice: input.paidPrice,
        total: input.total,
        discount: input.discount,
        notes: input.notes
    )
}

/// Registers CRUD endpoints for the existing Transactions table.
func registerExpenseTransactionRoutes(_ app: Application) {
    let transactions = app.grouped("transactions")

    transactions.get { request async throws -> [ExpenseTransaction] in
        // List documented expenses without loading image data or future related records.
        try await ExpenseTransactionService(database: request.db).list()
    }

    transactions.post { request async throws -> ExpenseTransaction in
        let input = try request.content.decode(ExpenseTransactionRequest.self)
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await ExpenseTransactionService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "A transaction with this ID already exists.")
        }

        let transaction = makeTransaction(from: input, id: id)
        try await ExpenseTransactionService(database: request.db).save(transaction)
        return transaction
    }

    transactions.get(":id") { request async throws -> ExpenseTransaction in
        guard let id = request.parameters.get("id"),
              let transaction = try await ExpenseTransactionService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Return one documented expense by its stable TransactionID.
        return transaction
    }

    transactions.put(":id") { request async throws -> ExpenseTransaction in
        guard let id = request.parameters.get("id"),
              let transaction = try await ExpenseTransactionService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ExpenseTransactionRequest.self)
        try validate(input)
        let replacement = makeTransaction(from: input, id: id)
        transaction.receiptID = replacement.receiptID
        transaction.item = replacement.item
        transaction.firstReceiptItem = replacement.firstReceiptItem
        transaction.categoryID = replacement.categoryID
        transaction.subcategoryID = replacement.subcategoryID
        transaction.merchantCode = replacement.merchantCode
        transaction.transactionDate = replacement.transactionDate
        transaction.quantity = replacement.quantity
        transaction.regularPrice = replacement.regularPrice
        transaction.paidPrice = replacement.paidPrice
        transaction.total = replacement.total
        transaction.discount = replacement.discount
        transaction.notes = replacement.notes
        try await ExpenseTransactionService(database: request.db).save(transaction)
        return transaction
    }

    transactions.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await ExpenseTransactionService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await ExpenseTransactionService(database: request.db).delete(id: id)
        return .noContent
    }
}
