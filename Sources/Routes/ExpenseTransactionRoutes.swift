import Fluent
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
    let image: String?
}

/// Strict create payload; database managed fields are absent.
struct ExpenseTransactionCreateRequest: Content {
    let value: ExpenseTransactionRequest

    init(from decoder: Decoder) throws {
        try CreateContractValidation.rejectUnknownFields(in: decoder, allowed: [
            "id", "receiptID", "item", "firstReceiptItem", "categoryID", "subcategoryID",
            "merchantCode", "transactionDate", "quantity", "regularPrice", "paidPrice",
            "total", "discount", "notes", "image"
        ])
        value = try ExpenseTransactionRequest(from: decoder)
    }
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

    if let image = input.image?.trimmingCharacters(in: .whitespacesAndNewlines), image.isEmpty {
        throw Abort(.badRequest, reason: "Image must be a valid FileMetadataID when provided.")
    }
}

private func validateCategoryReferences(_ input: ExpenseTransactionRequest, database: any Database) async throws {
    guard try await ExpenseCategoryService(database: database).find(id: input.categoryID) != nil else {
        throw Abort(.unprocessableEntity, reason: "categoryID must reference an existing expense category.")
    }

    if let subcategoryID = input.subcategoryID {
        guard let subcategory = try await ExpenseSubcategoryService(database: database).find(id: subcategoryID) else {
            throw Abort(.unprocessableEntity, reason: "subcategoryID must reference an existing expense subcategory.")
        }
        guard subcategory.categoryID == input.categoryID else {
            throw Abort(.unprocessableEntity, reason: "subcategoryID must belong to categoryID.")
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
        notes: input.notes,
        image: input.image?.trimmingCharacters(in: .whitespacesAndNewlines)
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
        let input = try request.content.decode(ExpenseTransactionCreateRequest.self).value
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        let service = ExpenseTransactionService(database: request.db)
        if try await service.find(id: id) != nil {
            throw Abort(.conflict, reason: "A transaction with this ID already exists.")
        }

        try await validateCategoryReferences(input, database: request.db)

        let transaction = makeTransaction(from: input, id: id)
        _ = try await AttachmentReferenceService(database: request.db).attach(metadataID: transaction.image, ownerType: "ExpenseTransaction", ownerID: id)
        try await service.save(transaction)
        return transaction
    }

    transactions.get(":id") { request async throws -> ExpenseTransaction in
        let (_, transaction) = try await requireRouteRecord(request.parameters.get("id")) {
            try await ExpenseTransactionService(database: request.db).find(id: $0)
        }

        // Return one documented expense by its stable TransactionID.
        return transaction
    }

    transactions.patch(":id") { request async throws -> ExpenseTransaction in
        let (_, transaction) = try await requireRouteRecord(request.parameters.get("id")) {
            try await ExpenseTransactionService(database: request.db).find(id: $0)
        }
        try PropertyPatchValidation.requireKnownJSONProperties(
            request,
            allowed: ["receiptID", "item", "firstReceiptItem", "merchantCode", "transactionDate", "quantity", "regularPrice", "paidPrice", "total", "discount", "notes"],
            requireNonEmpty: true,
            emptyReason: "At least one editable field is required."
        )
        let payload = try request.content.decode([String: PatchJSONValue].self)
        func string(_ key: String, _ current: String?) throws -> String? {
            guard let value = payload[key] else { return current }
            return try value.string()
        }
        func number(_ key: String, _ current: Double?) throws -> Double? {
            guard let value = payload[key] else { return current }
            return try value.number()
        }
        let item = try string("item", transaction.item)
        guard let item else { throw Abort(.unprocessableEntity, reason: "Transaction item cannot be cleared.") }
        guard !item.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Abort(.unprocessableEntity, reason: "Transaction item cannot be empty.") }
        let quantity = try number("quantity", transaction.quantity) ?? 0
        guard quantity > 0 else { throw Abort(.unprocessableEntity, reason: "Quantity must be greater than zero.") }
        let regularPrice = try number("regularPrice", transaction.regularPrice)
        let paidPrice = try number("paidPrice", transaction.paidPrice)
        let total = try number("total", transaction.total)
        let discount = try number("discount", transaction.discount)
        guard [regularPrice, paidPrice, total, discount].compactMap({ $0 }).allSatisfy({ $0 >= 0 }) else {
            throw Abort(.unprocessableEntity, reason: "Transaction prices and discounts cannot be negative.")
        }
        let firstReceiptItem: Bool
        if let value = payload["firstReceiptItem"] {
            guard case let .bool(parsed) = value else { throw Abort(.unprocessableEntity, reason: "Expected a boolean value.") }
            firstReceiptItem = parsed
        } else { firstReceiptItem = transaction.firstReceiptItem }
        transaction.item = item
        transaction.quantity = quantity
        transaction.receiptID = try string("receiptID", transaction.receiptID)
        transaction.firstReceiptItem = firstReceiptItem
        transaction.merchantCode = try string("merchantCode", transaction.merchantCode)
        transaction.transactionDate = try string("transactionDate", transaction.transactionDate)
        transaction.regularPrice = regularPrice
        transaction.paidPrice = paidPrice
        transaction.total = total
        transaction.discount = discount
        transaction.notes = try string("notes", transaction.notes)
        try await ExpenseTransactionService(database: request.db).save(transaction)
        return transaction
    }

    transactions.put(":id") { request async throws -> ExpenseTransaction in
        let (id, transaction) = try await requireRouteRecord(request.parameters.get("id")) {
            try await ExpenseTransactionService(database: request.db).find(id: $0)
        }

        let input = try request.content.decode(ExpenseTransactionRequest.self)
        try validate(input)
        let replacement = makeTransaction(from: input, id: id)
        try await AttachmentReferenceService(database: request.db).replace(oldMetadataID: transaction.image, newMetadataID: replacement.image, ownerType: "ExpenseTransaction", ownerID: id)
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
        transaction.image = replacement.image
        try await ExpenseTransactionService(database: request.db).save(transaction)
        return transaction
    }

    transactions.get(":id", "image") { request async throws -> FileMetadata in
        let (_, transaction) = try await requireRouteRecord(request.parameters.get("id")) {
            try await ExpenseTransactionService(database: request.db).find(id: $0)
        }

        guard let imageID = transaction.image,
              let metadata = try await FileMetadataService(database: request.db).find(id: imageID)
        else {
            throw Abort(.notFound)
        }

        // FileMetadata exposes only a portable relative path, never raw image bytes.
        return metadata
    }

    transactions.delete(":id") { request async throws -> HTTPStatus in
        let (id, _) = try await requireRouteRecord(request.parameters.get("id")) {
            try await ExpenseTransactionService(database: request.db).find(id: $0)
        }

        try await ExpenseTransactionService(database: request.db).delete(id: id)
        return .noContent
    }
}
