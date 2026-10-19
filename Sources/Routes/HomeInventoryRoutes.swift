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

struct HomeInventoryCreateRequest: Content {
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        let allowed = Set(["id", "itemName", "category", "itemDescription", "quantity", "purchaseDate", "purchasePrice", "currentValue", "condition", "location", "notes"])
        if let unknown = container.allKeys.first(where: { !allowed.contains($0.stringValue) }) {
            throw DecodingError.dataCorruptedError(forKey: unknown, in: container, debugDescription: "Unknown create field: \(unknown.stringValue).")
        }
        id = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "id"))
        itemName = try container.decode(String.self, forKey: DynamicCodingKey(stringValue: "itemName"))
        category = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "category"))
        itemDescription = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "itemDescription"))
        quantity = try container.decode(Int.self, forKey: DynamicCodingKey(stringValue: "quantity"))
        purchaseDate = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "purchaseDate"))
        purchasePrice = try container.decodeIfPresent(Double.self, forKey: DynamicCodingKey(stringValue: "purchasePrice"))
        currentValue = try container.decodeIfPresent(Double.self, forKey: DynamicCodingKey(stringValue: "currentValue"))
        condition = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "condition"))
        location = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "location"))
        notes = try container.decodeIfPresent(String.self, forKey: DynamicCodingKey(stringValue: "notes"))
    }
}

private struct DynamicCodingKey: CodingKey, Hashable {
    let stringValue: String
    let intValue: Int? = nil
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
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
        try await HomeInventoryService(database: request.db, hubID: request.authenticatedHubID).list()
    }

    inventory.post { request async throws -> HomeInventory in
        let createInput = try request.content.decode(HomeInventoryCreateRequest.self)
        let input = HomeInventoryRequest(
            id: createInput.id,
            itemName: createInput.itemName,
            category: createInput.category,
            itemDescription: createInput.itemDescription,
            quantity: createInput.quantity,
            purchaseDate: createInput.purchaseDate,
            purchasePrice: createInput.purchasePrice,
            currentValue: createInput.currentValue,
            condition: createInput.condition,
            location: createInput.location,
            notes: createInput.notes
        )
        try validate(input)

        let suppliedID = input.id?.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = suppliedID.flatMap { $0.isEmpty ? nil : $0 } ?? HomeInventoryIdentifier.generate()
        let service = HomeInventoryService(database: request.db, hubID: request.authenticatedHubID)
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
              let record = try await HomeInventoryService(database: request.db, hubID: request.authenticatedHubID).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return record
    }
}
