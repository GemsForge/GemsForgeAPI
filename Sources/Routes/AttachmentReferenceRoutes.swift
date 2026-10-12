import Vapor

/// Request used by the console when attaching, replacing, or removing a file.
struct AttachmentReferenceRequest: Content {
    let fileMetadataID: String?
}

/// Registers small PATCH endpoints so clients do not need to resend an entire
/// owner record just to change its image or document reference.
func registerAttachmentReferenceRoutes(_ app: Application) {
    app.patch("addresses", ":id", "attachment") { request async throws -> AddressDetailResponse in
        guard let id = request.parameters.get("id"),
              let address = try await AddressService(database: request.db).find(id: id)
        else { throw Abort(.notFound) }

        let input = try request.content.decode(AttachmentReferenceRequest.self)
        try await AttachmentReferenceService(database: request.db).replace(
            oldMetadataID: address.imageFileMetadataID,
            newMetadataID: input.fileMetadataID,
            ownerType: "Address",
            ownerID: id
        )
        address.imageFileMetadataID = input.fileMetadataID
        try await AddressService(database: request.db).save(address)
        return AddressDetailResponse(address)
    }

    app.patch("transactions", ":id", "image") { request async throws -> ExpenseTransaction in
        guard let id = request.parameters.get("id"),
              let transaction = try await ExpenseTransactionService(database: request.db).find(id: id)
        else { throw Abort(.notFound) }

        let input = try request.content.decode(AttachmentReferenceRequest.self)
        try await AttachmentReferenceService(database: request.db).replace(
            oldMetadataID: transaction.image,
            newMetadataID: input.fileMetadataID,
            ownerType: "ExpenseTransaction",
            ownerID: id
        )
        transaction.image = input.fileMetadataID
        try await ExpenseTransactionService(database: request.db).save(transaction)
        return transaction
    }

    app.patch("home-inventory", ":id", "attachment") { request async throws -> HomeInventory in
        guard let id = request.parameters.get("id"),
              let inventory = try await HomeInventoryService(database: request.db).find(id: id)
        else { throw Abort(.notFound) }

        let input = try request.content.decode(AttachmentReferenceRequest.self)
        try await AttachmentReferenceService(database: request.db).replace(
            oldMetadataID: inventory.imageFileMetadataID,
            newMetadataID: input.fileMetadataID,
            ownerType: "HomeInventory",
            ownerID: id
        )
        inventory.imageFileMetadataID = input.fileMetadataID
        try await HomeInventoryService(database: request.db).save(inventory)
        return inventory
    }
}
