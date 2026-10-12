import Vapor

private func validate(_ input: AddressRequest, requiresID: Bool = false) throws {
    let status = input.addressStatus.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !status.isEmpty else {
        throw Abort(.badRequest, reason: "Address status is required.")
    }

    if requiresID {
        guard let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else {
            throw Abort(.badRequest, reason: "AddressID is required when creating an address.")
        }
    }
}

private func makeAddress(from input: AddressRequest, id: String?) -> Address {
    Address(
        id: id,
        addressType: input.addressType?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? input.addressType!
            : "Residence",
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? input.country!
            : "US",
        startDate: input.startDate,
        endDate: input.endDate,
        addressStatus: input.addressStatus,
        notes: input.notes,
        imageFileMetadataID: input.imageFileMetadataID
    )
}

/// Registers CRUD endpoints for the existing Addresses table.
func registerAddressRoutes(_ app: Application) {
    let addresses = app.grouped("addresses")

    addresses.get { request async throws -> [AddressSummaryResponse] in
        // List responses intentionally omit street lines, postal codes, and notes.
        try await AddressService(database: request.db).list().map(AddressSummaryResponse.init)
    }

    addresses.post { request async throws -> AddressDetailResponse in
        let input = try request.content.decode(AddressRequest.self)
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await AddressService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "An address with this ID already exists.")
        }

        let address = makeAddress(from: input, id: id)
        _ = try await AttachmentReferenceService(database: request.db).attach(metadataID: address.imageFileMetadataID, ownerType: "Address", ownerID: id)
        try await AddressService(database: request.db).save(address)
        return AddressDetailResponse(address)
    }

    addresses.get(":id") { request async throws -> AddressDetailResponse in
        guard let id = request.parameters.get("id"),
              let address = try await AddressService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Full address details are returned only for an explicitly requested ID.
        return AddressDetailResponse(address)
    }

    addresses.put(":id") { request async throws -> AddressDetailResponse in
        guard let id = request.parameters.get("id"),
              let address = try await AddressService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(AddressRequest.self)
        try validate(input)
        let replacement = makeAddress(from: input, id: id)
        try await AttachmentReferenceService(database: request.db).replace(oldMetadataID: address.imageFileMetadataID, newMetadataID: replacement.imageFileMetadataID, ownerType: "Address", ownerID: id)
        address.addressType = replacement.addressType
        address.addressLine1 = replacement.addressLine1
        address.addressLine2 = replacement.addressLine2
        address.city = replacement.city
        address.state = replacement.state
        address.postalCode = replacement.postalCode
        address.country = replacement.country
        address.startDate = replacement.startDate
        address.endDate = replacement.endDate
        address.addressStatus = replacement.addressStatus
        address.notes = replacement.notes
        address.imageFileMetadataID = replacement.imageFileMetadataID
        try await AddressService(database: request.db).save(address)
        return AddressDetailResponse(address)
    }

    addresses.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await AddressService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await AddressService(database: request.db).delete(id: id)
        return .noContent
    }
}
