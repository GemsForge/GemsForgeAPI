import Vapor

/// The fields accepted when creating or replacing an employment record.
struct EmploymentRequest: Content {
    let id: String?
    let employerName: String
    let employerType: String
    let industry: String?
    let website: String?
    let positionTitle: String
    let employmentType: String
    let startDate: String?
    let endDate: String?
    let employmentStatus: String
    let workAddressID: String?
    let employerContact: String?
    let employerContactNumber: String?
    let employerContactEmail: String?
    let notes: String?
}

private func validate(_ input: EmploymentRequest, requiresID: Bool = false) throws {
    let employerName = input.employerName.trimmingCharacters(in: .whitespacesAndNewlines)
    let positionTitle = input.positionTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    let employmentStatus = input.employmentStatus.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !employerName.isEmpty, !positionTitle.isEmpty, !employmentStatus.isEmpty else {
        throw Abort(.badRequest, reason: "Employer name, position title, and employment status are required.")
    }

    if requiresID {
        guard let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else {
            throw Abort(.badRequest, reason: "EmploymentID is required when creating an employment record.")
        }
    }
}

/// Registers CRUD endpoints for the existing Employment table.
func registerEmploymentRoutes(_ app: Application) {
    let employment = app.grouped("employment")

    employment.get { request async throws -> [Employment] in
        // Returns Life-area employment records without assigning them to a domain.
        try await EmploymentService(database: request.db).list()
    }

    employment.post { request async throws -> Employment in
        let input = try request.content.decode(EmploymentRequest.self)
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await EmploymentService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "An employment record with this ID already exists.")
        }

        let record = Employment(
            id: id,
            employerName: input.employerName,
            employerType: input.employerType,
            industry: input.industry,
            website: input.website,
            positionTitle: input.positionTitle,
            employmentType: input.employmentType,
            startDate: input.startDate,
            endDate: input.endDate,
            employmentStatus: input.employmentStatus,
            workAddressID: input.workAddressID,
            employerContact: input.employerContact,
            employerContactNumber: input.employerContactNumber,
            employerContactEmail: input.employerContactEmail,
            notes: input.notes
        )

        try await EmploymentService(database: request.db).save(record)
        return record
    }

    employment.get(":id") { request async throws -> Employment in
        guard let id = request.parameters.get("id"),
              let record = try await EmploymentService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Returns one employment record by its stable EmploymentID.
        return record
    }

    employment.put(":id") { request async throws -> Employment in
        guard let id = request.parameters.get("id"),
              let record = try await EmploymentService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(EmploymentRequest.self)
        try validate(input)
        record.employerName = input.employerName
        record.employerType = input.employerType
        record.industry = input.industry
        record.website = input.website
        record.positionTitle = input.positionTitle
        record.employmentType = input.employmentType
        record.startDate = input.startDate
        record.endDate = input.endDate
        record.employmentStatus = input.employmentStatus
        record.workAddressID = input.workAddressID
        record.employerContact = input.employerContact
        record.employerContactNumber = input.employerContactNumber
        record.employerContactEmail = input.employerContactEmail
        record.notes = input.notes
        try await EmploymentService(database: request.db).save(record)
        return record
    }

    employment.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id"),
              try await EmploymentService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await EmploymentService(database: request.db).delete(id: id)
        return .noContent
    }
}
