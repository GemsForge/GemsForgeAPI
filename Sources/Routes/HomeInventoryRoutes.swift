import Vapor

/// The fields accepted when manually adding a HomeInventory record.
struct HomeInventoryRequest: Content {
    let id: String?
    let itemName: String
    let category: String?
    let itemDescription: String?
    let quantity: Int
    let purchaseDate: String?
    let purchasePrice: Double?
    let currentValue: Double?
    let condition: String?
    let location: String?
    let notes: String?
}

private func validate(_ input: HomeInventoryRequest) throws {
    if let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty,
       !HomeInventoryIdentifier.isValid(id) {
        throw Abort(.badRequest, reason: "InventoryID must be a valid UUID when supplied.")
    }

    guard !input.itemName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "ItemName is required.")
    }

    guard input.quantity > 0 else {
        throw Abort(.badRequest, reason: "Quantity must be greater than zero.")
    }

    let values = [input.purchasePrice, input.currentValue]
    guard values.compactMap({ $0 }).allSatisfy({ $0 >= 0 }) else {
        throw Abort(.badRequest, reason: "PurchasePrice and CurrentValue cannot be negative.")
    }
}

/// Registers manual HomeInventory entry and read endpoints for the testing console.
func registerHomeInventoryRoutes(_ app: Application) {
    let inventory = app.grouped("home-inventory")

    inventory.get { request async throws -> [HomeInventory] in
        // The testing console can confirm manually entered rows without SQL access.
        try await HomeInventoryService(database: request.db).list()
    }

    inventory.post { request async throws -> HomeInventory in
        let input = try request.content.decode(HomeInventoryRequest.self)
        try validate(input)

        let suppliedID = input.id?.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = suppliedID.flatMap { $0.isEmpty ? nil : $0 } ?? HomeInventoryIdentifier.generate()
        let service = HomeInventoryService(database: request.db)
        guard try await service.find(id: id) == nil else {
            throw Abort(.conflict, reason: "A HomeInventory record with this InventoryID already exists.")
        }

        let record = HomeInventory(
            id: id,
            itemName: input.itemName.trimmingCharacters(in: .whitespacesAndNewlines),
            category: input.category,
            itemDescription: input.itemDescription,
            quantity: input.quantity,
            purchaseDate: input.purchaseDate,
            purchasePrice: input.purchasePrice,
            currentValue: input.currentValue,
            condition: input.condition,
            location: input.location,
            notes: input.notes
        )
        try await service.save(record)
        return record
    }

    inventory.get(":id") { request async throws -> HomeInventory in
        guard let id = request.parameters.get("id"),
              let record = try await HomeInventoryService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return record
    }
}
