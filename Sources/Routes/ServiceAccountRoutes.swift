import Vapor

/// The fields accepted when creating or replacing a Service Account.
struct ServiceAccountRequest: Content {
    let id: Int?
    let service: String
    let logoKey: String?
    let type: String?
    let expenseGroup: String?
    let monthlyAmount: Double?
    let interestRate: Double?
    let apr: Double?
    let due: String?
    let occurrence: String?
    let status: String?
    let since: String?
    let website: String?
    let notes: String?
    let notionPage: String?
    let paymentMethod: String?
    let accountNumber: String?
    let emailUpdated: String?
    let associatedAddress: String?
    let serviceKey: String?
    var logoFileMetadataID: String? = nil
}

struct ServiceAccountPatchRequest: Content {
    let service: String?
    let monthlyAmount: Double?
    let status: String?
    let notes: String?
    let logoFileMetadataID: String?
}

private func validate(_ input: ServiceAccountRequest) throws {
    guard !input.service.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Service name is required.")
    }

    let numericValues = [input.monthlyAmount, input.interestRate, input.apr]
    guard numericValues.compactMap({ $0 }).allSatisfy({ $0 >= 0 }) else {
        throw Abort(.badRequest, reason: "Service amounts and rates cannot be negative.")
    }
}

private func makeServiceAccount(from input: ServiceAccountRequest, id: Int?) -> ServiceAccount {
    ServiceAccount(
        id: id,
        service: input.service,
        logoKey: input.logoKey,
        type: input.type,
        expenseGroup: input.expenseGroup,
        monthlyAmount: input.monthlyAmount,
        interestRate: input.interestRate,
        apr: input.apr,
        due: input.due,
        occurrence: input.occurrence,
        status: input.status,
        since: input.since,
        website: input.website,
        notes: input.notes,
        notionPage: input.notionPage,
        paymentMethod: input.paymentMethod,
        accountNumber: input.accountNumber,
        emailUpdated: input.emailUpdated,
        associatedAddress: input.associatedAddress,
        serviceKey: input.serviceKey,
        logoFileMetadataID: input.logoFileMetadataID
    )
}

/// Registers CRUD endpoints for the existing Services table under its
/// user-facing Service Account concept.
func registerServiceAccountRoutes(_ app: Application) {
    let accounts = app.grouped("service-accounts")

    accounts.get { request async throws -> [ServiceAccount] in
        // Returns recurring service accounts, not individual expense transactions.
        try await ServiceAccountService(database: request.db).list()
    }

    accounts.post { request async throws -> ServiceAccount in
        let input = try request.content.decode(ServiceAccountRequest.self)
        try validate(input)

        if let id = input.id,
           try await ServiceAccountService(database: request.db).find(id: id) != nil {
            throw Abort(.conflict, reason: "A Service Account with this ID already exists.")
        }

        let account = makeServiceAccount(from: input, id: input.id)
        try await ServiceAccountService(database: request.db).save(account)
        if let id = account.id {
            _ = try await AttachmentReferenceService(database: request.db).attach(metadataID: account.logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
            try await ServiceAccountService(database: request.db).save(account)
        }
        return account
    }

    accounts.get(":id") { request async throws -> ServiceAccount in
        guard let id = request.parameters.get("id", as: Int.self),
              let account = try await ServiceAccountService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        // Returns one recurring service account by its stable ServiceID.
        return account
    }

    accounts.patch(":id") { request async throws -> ServiceAccount in
        guard let id = request.parameters.get("id", as: Int.self),
              let account = try await ServiceAccountService(database: request.db).find(id: id)
        else { throw Abort(.notFound) }
        let input = try request.content.decode(ServiceAccountPatchRequest.self)
        guard input.service != nil || input.monthlyAmount != nil || input.status != nil || input.notes != nil || input.logoFileMetadataID != nil else {
            throw Abort(.unprocessableEntity, reason: "At least one editable field is required.")
        }
        let service = input.service ?? account.service
        guard !service.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Abort(.unprocessableEntity, reason: "Service name cannot be empty.") }
        let monthlyAmount = input.monthlyAmount ?? account.monthlyAmount
        if let monthlyAmount, monthlyAmount < 0 { throw Abort(.unprocessableEntity, reason: "Monthly amount cannot be negative.") }
        let logoFileMetadataID = input.logoFileMetadataID ?? account.logoFileMetadataID
        try await AttachmentReferenceService(database: request.db).replace(oldMetadataID: account.logoFileMetadataID, newMetadataID: logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
        account.service = service
        account.monthlyAmount = monthlyAmount
        account.status = input.status ?? account.status
        account.notes = input.notes ?? account.notes
        account.logoFileMetadataID = logoFileMetadataID
        try await ServiceAccountService(database: request.db).save(account)
        return account
    }

    accounts.put(":id") { request async throws -> ServiceAccount in
        guard let id = request.parameters.get("id", as: Int.self),
              let account = try await ServiceAccountService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(ServiceAccountRequest.self)
        try validate(input)
        let replacement = makeServiceAccount(from: input, id: id)
        try await AttachmentReferenceService(database: request.db).replace(oldMetadataID: account.logoFileMetadataID, newMetadataID: replacement.logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
        account.service = replacement.service
        account.logoKey = replacement.logoKey
        account.type = replacement.type
        account.expenseGroup = replacement.expenseGroup
        account.monthlyAmount = replacement.monthlyAmount
        account.interestRate = replacement.interestRate
        account.apr = replacement.apr
        account.due = replacement.due
        account.occurrence = replacement.occurrence
        account.status = replacement.status
        account.since = replacement.since
        account.website = replacement.website
        account.notes = replacement.notes
        account.notionPage = replacement.notionPage
        account.paymentMethod = replacement.paymentMethod
        account.accountNumber = replacement.accountNumber
        account.emailUpdated = replacement.emailUpdated
        account.associatedAddress = replacement.associatedAddress
        account.serviceKey = replacement.serviceKey
        account.logoFileMetadataID = replacement.logoFileMetadataID
        try await ServiceAccountService(database: request.db).save(account)
        return account
    }

    accounts.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id", as: Int.self),
              try await ServiceAccountService(database: request.db).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await ServiceAccountService(database: request.db).delete(id: id)
        return .noContent
    }
}
