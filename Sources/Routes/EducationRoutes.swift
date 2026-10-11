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

    education.get { request async throws -> [Education] in
        // Returns Life-area education records without assigning them to a domain.
        try await EducationService(database: request.db).list()
    }

    education.post { request async throws -> Education in
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
        return record
    }

    education.get(":id") { request async throws -> Education in
        guard let id = request.parameters.get("id"),
              let record = try await EducationService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Returns one education record by its stable EducationID.
        return record
    }

    education.put(":id") { request async throws -> Education in
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
        return record
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
