import Fluent
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

/// Create-only payload. The expanded address relationship and audit fields
/// are response/server concerns, not client-controlled input.
struct EmploymentCreateRequest: Content {
    let value: EmploymentRequest

    init(from decoder: Decoder) throws {
        try CreateContractValidation.rejectUnknownFields(in: decoder, allowed: [
            "id", "employerName", "employerType", "industry", "website", "positionTitle",
            "employmentType", "startDate", "endDate", "employmentStatus", "workAddressID",
            "employerContact", "employerContactNumber", "employerContactEmail", "notes"
        ])
        value = try EmploymentRequest(from: decoder)
    }
}

/// API response that expands the work-address relationship for client rendering.
struct EmploymentResponse: Content {
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
    let address: AddressReferenceResponse?
    let employerContact: String?
    let employerContactNumber: String?
    let employerContactEmail: String?
    let notes: String?

    init(_ record: Employment, address: AddressReferenceResponse?) {
        id = record.id
        employerName = record.employerName
        employerType = record.employerType
        industry = record.industry
        website = record.website
        positionTitle = record.positionTitle
        employmentType = record.employmentType
        startDate = record.startDate
        endDate = record.endDate
        employmentStatus = record.employmentStatus
        self.address = address
        employerContact = record.employerContact
        employerContactNumber = record.employerContactNumber
        employerContactEmail = record.employerContactEmail
        notes = record.notes
    }
}

private func employmentResponse(_ record: Employment, on database: any Database) async throws -> EmploymentResponse {
    let address: Address?
    if let id = record.workAddressID {
        address = try await Address.find(id, on: database)
    } else {
        address = nil
    }
    return EmploymentResponse(record, address: address.map(AddressReferenceResponse.init))
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

    employment.get { request async throws -> [EmploymentResponse] in
        // Returns Life-area employment records without assigning them to a domain.
        let records = try await EmploymentService(database: request.db).list()
        var responses: [EmploymentResponse] = []
        for record in records {
            responses.append(try await employmentResponse(record, on: request.db))
        }
        return responses
    }

    employment.post { request async throws -> EmploymentResponse in
        let input = try request.content.decode(EmploymentCreateRequest.self).value
        try validate(input, requiresID: true)

        let id = input.id!.trimmingCharacters(in: .whitespacesAndNewlines)
        if try await EmploymentService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "An employment record with this ID already exists.")
        }

        if let addressID = input.workAddressID,
           try await AddressService(database: request.db).find(id: addressID) == nil
        {
            throw Abort(.unprocessableEntity, reason: "workAddressID must reference an existing address.")
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
        return try await employmentResponse(record, on: request.db)
    }

    employment.get(":id") { request async throws -> EmploymentResponse in
        let (_, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EmploymentService(database: request.db).find(id: $0)
        }

        // Returns one employment record by its stable EmploymentID.
        return try await employmentResponse(record, on: request.db)
    }

    employment.patch(":id") { request async throws -> EmploymentResponse in
        let (_, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EmploymentService(database: request.db).find(id: $0)
        }

        let payload = try request.content.decode([String: String?].self)
        try PropertyPatchValidation.requireNonEmpty(payload)
        try PropertyPatchValidation.requireKnownProperties(payload, allowed: [
            "employerName", "employerType", "industry", "website", "positionTitle",
            "employmentType", "startDate", "endDate", "employmentStatus", "workAddressID",
            "employerContact", "employerContactNumber", "employerContactEmail", "notes",
        ])

        let value: (String, String?) -> String? = { key, current in
            PropertyPatchValidation.value(key, in: payload, current: current)
        }
        let employerName = value("employerName", record.employerName)
        let positionTitle = value("positionTitle", record.positionTitle)
        let employmentStatus = value("employmentStatus", record.employmentStatus)
        guard let employerName, !employerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let positionTitle, !positionTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let employmentStatus, !employmentStatus.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw Abort(.unprocessableEntity, reason: "Employer name, position title, and employment status cannot be empty.")
        }

        let workAddressID = value("workAddressID", record.workAddressID)
        if let workAddressID,
           try await AddressService(database: request.db).find(id: workAddressID) == nil
        {
            throw Abort(.unprocessableEntity, reason: "workAddressID must reference an existing address.")
        }

        record.employerName = employerName
        record.employerType = value("employerType", record.employerType) ?? ""
        record.industry = value("industry", record.industry)
        record.website = value("website", record.website)
        record.positionTitle = positionTitle
        record.employmentType = value("employmentType", record.employmentType) ?? ""
        record.startDate = value("startDate", record.startDate)
        record.endDate = value("endDate", record.endDate)
        record.employmentStatus = employmentStatus
        record.workAddressID = workAddressID
        record.employerContact = value("employerContact", record.employerContact)
        record.employerContactNumber = value("employerContactNumber", record.employerContactNumber)
        record.employerContactEmail = value("employerContactEmail", record.employerContactEmail)
        record.notes = value("notes", record.notes)
        try await EmploymentService(database: request.db).save(record)
        return try await employmentResponse(record, on: request.db)
    }

    employment.put(":id") { request async throws -> EmploymentResponse in
        let (_, record) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EmploymentService(database: request.db).find(id: $0)
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
        return try await employmentResponse(record, on: request.db)
    }

    employment.delete(":id") { request async throws -> HTTPStatus in
        let (id, _) = try await requireRouteRecord(request.parameters.get("id")) {
            try await EmploymentService(database: request.db).find(id: $0)
        }

        try await EmploymentService(database: request.db).delete(id: id)
        return .noContent
    }
}
