import Fluent
import Vapor

/// The fields accepted when creating or replacing an education record.
struct EducationRequest: Content {
    let id: String?
    let educationType: String
    let institutionName: String
    let program: String?
    let fieldOfStudy: String?
    let credential: String?
    let credentialID: String?
    let startDate: String?
    let endDate: String?
    let awardedDate: String?
    let status: String
    let locationAddressID: String?
    let website: String?
    let notes: String?
    var documentFileMetadataID: String? = nil
}

/// Create-only payload. Relationship responses and audit fields remain
/// server-owned and are intentionally absent from this contract.
struct EducationCreateRequest: Content {
    let value: EducationRequest

    init(from decoder: Decoder) throws {
        try CreateContractValidation.rejectUnknownFields(in: decoder, allowed: [
            "id", "educationType", "institutionName", "program", "fieldOfStudy", "credential",
            "credentialID", "startDate", "endDate", "awardedDate", "status", "locationAddressID",
            "website", "notes", "documentFileMetadataID"
        ])
        value = try EducationRequest(from: decoder)
    }
}

/// API response that expands the address relationship for client rendering.
struct EducationResponse: Content {
    let id: String?
    let educationType: String
    let institutionName: String
    let program: String?
    let fieldOfStudy: String?
    let credential: String?
    let credentialID: String?
    let startDate: String?
    let endDate: String?
    let awardedDate: String?
    let status: String
    let address: AddressReferenceResponse?
    let website: String?
    let notes: String?
    let documentFileMetadataID: String?
    let updatedAt: String?

    init(_ record: Education, address: AddressReferenceResponse?) {
        id = record.id
        educationType = record.educationType
        institutionName = record.institutionName
        program = record.program
        fieldOfStudy = record.fieldOfStudy
        credential = record.credential
        credentialID = record.credentialID
        startDate = record.startDate
        endDate = record.endDate
        awardedDate = record.awardedDate
        status = record.status
        self.address = address
        website = record.website
        notes = record.notes
        documentFileMetadataID = record.documentFileMetadataID
        updatedAt = record.updatedAt
    }
}

private func educationResponse(_ record: Education, on database: any Database) async throws -> EducationResponse {
    let address: Address?
    if let id = record.locationAddressID {
        // The optional relationship is expanded only when the referenced address exists.
        address = try await AddressService(database: database, hubID: record.hubID).find(id: id)
    } else {
        address = nil
    }
    return EducationResponse(record, address: address.map(AddressReferenceResponse.init))
}

private func validate(_ input: EducationRequest, requiresID: Bool = false) throws {
    let educationType = input.educationType.trimmingCharacters(in: .whitespacesAndNewlines)
    let institutionName = input.institutionName.trimmingCharacters(in: .whitespacesAndNewlines)
    let status = input.status.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !educationType.isEmpty, !institutionName.isEmpty, !status.isEmpty else {
        throw Abort(.badRequest, reason: "Education type, institution name, and status are required.")
    }

    if requiresID {
        guard let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else {
            throw Abort(.badRequest, reason: "EducationID is required when creating an education record.")
        }
    }
}

/// Registers CRUD endpoints for the existing Education table.
func registerEducationRoutes(_ app: Application) {
    let education = app.grouped("education")

    education.get { request async throws -> [EducationResponse] in
        // Returns Life-area education records without assigning them to a domain.
        let records = try await EducationService(database: request.db, hubID: request.authenticatedHubID).list()
        var responses: [EducationResponse] = []
        for record in records {
            responses.append(try await educationResponse(record, on: request.db))
        }
        return responses
    }

    education.post { request async throws -> EducationResponse in
        let input = try request.content.decode(EducationCreateRequest.self).value
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await EducationService(database: request.db, hubID: request.authenticatedHubID).find(id: id) != nil {
            throw Abort(.conflict, reason: "An education record with this ID already exists.")
        }

        if let addressID = input.locationAddressID,
           try await AddressService(database: request.db, hubID: request.authenticatedHubID).find(id: addressID) == nil
        {
            throw Abort(.unprocessableEntity, reason: "locationAddressID must reference an existing address.")
        }

        let record = Education(
            id: id,
            educationType: input.educationType,
            institutionName: input.institutionName,
            program: input.program,
            fieldOfStudy: input.fieldOfStudy,
            credential: input.credential,
            credentialID: input.credentialID,
            startDate: input.startDate,
            endDate: input.endDate,
            awardedDate: input.awardedDate,
            status: input.status,
            locationAddressID: input.locationAddressID,
            website: input.website,
            notes: input.notes,
            documentFileMetadataID: input.documentFileMetadataID
        )

        _ = try await AttachmentReferenceService(database: request.db, hubID: request.authenticatedHubID).attach(metadataID: record.documentFileMetadataID, ownerType: "Education", ownerID: id)
        try await EducationService(database: request.db, hubID: request.authenticatedHubID).save(record)
        return try await educationResponse(record, on: request.db)
    }

    education.get(":id") { request async throws -> EducationResponse in
        let (_, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EducationService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        // Returns one education record by its stable EducationID.
        return try await educationResponse(record, on: request.db)
    }

    education.patch(":id") { request async throws -> EducationResponse in
        let (id, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EducationService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        let payload = try request.content.decode([String: String?].self)
        try PropertyPatchValidation.requireNonEmpty(payload)
        try PropertyPatchValidation.requireKnownProperties(payload, allowed: [
            "educationType", "institutionName", "program", "fieldOfStudy", "credential",
            "credentialID", "startDate", "endDate", "awardedDate", "status", "locationAddressID",
            "website", "notes", "documentFileMetadataID",
        ])
        let value: (String, String?) -> String? = { key, current in
            PropertyPatchValidation.value(key, in: payload, current: current)
        }
        let educationType = value("educationType", record.educationType)
        let institutionName = value("institutionName", record.institutionName)
        let status = value("status", record.status)
        guard let educationType, !educationType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let institutionName, !institutionName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let status, !status.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw Abort(.unprocessableEntity, reason: "Education type, institution name, and status cannot be empty.")
        }
        let locationAddressID = value("locationAddressID", record.locationAddressID)
        if let locationAddressID,
           try await AddressService(database: request.db, hubID: request.authenticatedHubID).find(id: locationAddressID) == nil
        {
            throw Abort(.unprocessableEntity, reason: "locationAddressID must reference an existing address.")
        }
        let documentFileMetadataID = value("documentFileMetadataID", record.documentFileMetadataID)
        try await AttachmentReferenceService(database: request.db, hubID: request.authenticatedHubID).replace(
            oldMetadataID: record.documentFileMetadataID,
            newMetadataID: documentFileMetadataID,
            ownerType: "Education",
            ownerID: id
        )
        record.educationType = educationType
        record.institutionName = institutionName
        record.program = value("program", record.program)
        record.fieldOfStudy = value("fieldOfStudy", record.fieldOfStudy)
        record.credential = value("credential", record.credential)
        record.credentialID = value("credentialID", record.credentialID)
        record.startDate = value("startDate", record.startDate)
        record.endDate = value("endDate", record.endDate)
        record.awardedDate = value("awardedDate", record.awardedDate)
        record.status = status
        record.locationAddressID = locationAddressID
        record.website = value("website", record.website)
        record.notes = value("notes", record.notes)
        record.documentFileMetadataID = documentFileMetadataID
        record.updatedAt = RecordTimestamp.now()
        try await EducationService(database: request.db, hubID: request.authenticatedHubID).save(record)
        return try await educationResponse(record, on: request.db)
    }

    education.put(":id") { request async throws -> EducationResponse in
        let (id, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EducationService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        let input = try request.content.decode(EducationRequest.self)
        try validate(input)
        record.educationType = input.educationType
        record.institutionName = input.institutionName
        record.program = input.program
        record.fieldOfStudy = input.fieldOfStudy
        record.credential = input.credential
        record.credentialID = input.credentialID
        record.startDate = input.startDate
        record.endDate = input.endDate
        record.awardedDate = input.awardedDate
        record.status = input.status
        record.locationAddressID = input.locationAddressID
        record.website = input.website
        record.notes = input.notes
        try await AttachmentReferenceService(database: request.db, hubID: request.authenticatedHubID).replace(oldMetadataID: record.documentFileMetadataID, newMetadataID: input.documentFileMetadataID, ownerType: "Education", ownerID: id)
        record.documentFileMetadataID = input.documentFileMetadataID
        try await EducationService(database: request.db, hubID: request.authenticatedHubID).save(record)
        return try await educationResponse(record, on: request.db)
    }

    education.delete(":id") { request async throws -> HTTPStatus in
        let (id, _) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EducationService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        try await EducationService(database: request.db, hubID: request.authenticatedHubID).delete(id: id)
        return .noContent
    }
}
