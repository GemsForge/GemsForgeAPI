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
        let input = try request.content.decode(AddressCreateRequest.self)
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
        let (_, address) = try await requireRouteRecord(request.parameters.get("id")) {
            try await AddressService(database: request.db).find(id: $0)
        }

        // Full address details are returned only for an explicitly requested ID.
        return AddressDetailResponse(address)
    }

    addresses.patch(":id") { request async throws -> AddressDetailResponse in
        let (id, address) = try await requireRouteRecord(request.parameters.get("id")) {
            try await AddressService(database: request.db).find(id: $0)
        }

        let payload = try request.content.decode([String: String?].self)
        try PropertyPatchValidation.requireNonEmpty(payload)
        let editable = Set([
            "addressType", "addressLine1", "addressLine2", "city", "state", "postalCode",
            "country", "startDate", "endDate", "addressStatus", "notes", "imageFileMetadataID",
        ])
        try PropertyPatchValidation.requireKnownProperties(payload, allowed: editable)
        let value: (String, String?) -> String? = { key, current in
            PropertyPatchValidation.value(key, in: payload, current: current)
        }

        let status = value("addressStatus", address.addressStatus)
        guard let status, !status.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw Abort(.unprocessableEntity, reason: "addressStatus cannot be cleared.")
        }

        let metadataID = value("imageFileMetadataID", address.imageFileMetadataID)
        try await AttachmentReferenceService(database: request.db).replace(
            oldMetadataID: address.imageFileMetadataID,
            newMetadataID: metadataID,
            ownerType: "Address",
            ownerID: id
        )
        address.addressType = value("addressType", address.addressType) ?? "Residence"
        address.addressLine1 = value("addressLine1", address.addressLine1)
        address.addressLine2 = value("addressLine2", address.addressLine2)
        address.city = value("city", address.city)
        address.state = value("state", address.state)
        address.postalCode = value("postalCode", address.postalCode)
        address.country = value("country", address.country) ?? "US"
        address.startDate = value("startDate", address.startDate)
        address.endDate = value("endDate", address.endDate)
        address.addressStatus = status
        address.notes = value("notes", address.notes)
        address.imageFileMetadataID = metadataID
        try await AddressService(database: request.db).save(address)
        return AddressDetailResponse(address)
    }

    addresses.put(":id") { request async throws -> AddressDetailResponse in
        let (id, address) = try await requireRouteRecord(request.parameters.get("id")) {
            try await AddressService(database: request.db).find(id: $0)
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
        let (id, _) = try await requireRouteRecord(request.parameters.get("id")) {
            try await AddressService(database: request.db).find(id: $0)
        }

        try await AddressService(database: request.db).delete(id: id)
        return .noContent
    }
}
