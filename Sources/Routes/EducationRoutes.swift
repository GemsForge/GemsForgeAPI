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
    }
}

private func educationResponse(_ record: Education, on database: any Database) async throws -> EducationResponse {
    let address: Address?
    if let id = record.locationAddressID {
        // The optional relationship is expanded only when the referenced address exists.
        address = try await Address.find(id, on: database)
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
        let records = try await EducationService(database: request.db).list()
        var responses: [EducationResponse] = []
        for record in records {
            responses.append(try await educationResponse(record, on: request.db))
        }
        return responses
    }

    education.post { request async throws -> EducationResponse in
        let input = try request.content.decode(EducationRequest.self)
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await EducationService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "An education record with this ID already exists.")
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
            notes: input.notes
        )

        try await EducationService(database: request.db).save(record)
        return try await educationResponse(record, on: request.db)
    }

    education.get(":id") { request async throws -> EducationResponse in
        guard let id = request.parameters.get("id"),
              let record = try await EducationService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Returns one education record by its stable EducationID.
        return try await educationResponse(record, on: request.db)
    }

    education.put(":id") { request async throws -> EducationResponse in
        guard let id = request.parameters.get("id"),
              let record = try await EducationService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
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
        try await EducationService(database: request.db).save(record)
        return try await educationResponse(record, on: request.db)
    }

    education.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await EducationService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await EducationService(database: request.db).delete(id: id)
        return .noContent
    }
}
