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

/// Strict POST boundary for service accounts. The wrapped legacy request is
/// retained for PUT compatibility while POST rejects unknown fields.
struct ServiceAccountCreateRequest: Content {
    let value: ServiceAccountRequest

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        let allowed = Set([
            "id", "service", "logoKey", "type", "expenseGroup", "monthlyAmount",
            "interestRate", "apr", "due", "occurrence", "status", "since",
            "website", "notes", "notionPage", "paymentMethod", "accountNumber",
            "emailUpdated", "associatedAddress", "serviceKey", "logoFileMetadataID"
        ])
        if let unknown = container.allKeys.first(where: { !allowed.contains($0.stringValue) }) {
            throw DecodingError.dataCorruptedError(forKey: unknown, in: container, debugDescription: "Unknown create field: \(unknown.stringValue).")
        }
        value = try ServiceAccountRequest(from: decoder)
    }
}

private struct DynamicCodingKey: CodingKey, Hashable {
    let stringValue: String
    let intValue: Int? = nil
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
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
        try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).list()
    }

    accounts.post { request async throws -> ServiceAccount in
        let input = try request.content.decode(ServiceAccountCreateRequest.self).value
        try validate(input)

        let service = ServiceAccountService(database: request.db, hubID: request.authenticatedHubID)
        if let id = input.id, try await service.find(id: id) != nil {
            throw Abort(.conflict, reason: "A Service Account with this ID already exists.")
        }

        if let serviceKey = input.serviceKey?.trimmingCharacters(in: .whitespacesAndNewlines), !serviceKey.isEmpty {
            let normalizedKey = serviceKey.lowercased()
            if try await service.list().contains(where: {
                $0.serviceKey?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedKey
            }) {
                throw Abort(.conflict, reason: "A Service Account with this serviceKey already exists.")
            }
        }

        if let metadataID = input.logoFileMetadataID?.trimmingCharacters(in: .whitespacesAndNewlines), !metadataID.isEmpty,
           try await FileMetadataService(database: request.db, hubID: request.authenticatedHubID).find(id: metadataID) == nil {
            throw Abort(.unprocessableEntity, reason: "The referenced file metadata does not exist.")
        }

        let account = makeServiceAccount(from: input, id: input.id)
        // Production requests have a hub because SessionAuthenticationMiddleware
        // resolves it from the validated account. Nil is retained for the route's
        // isolated legacy unit tests, which do not install authentication middleware.
        let hubID = request.authenticatedHubID
        try await request.db.transaction { database in
            let transactionalService = ServiceAccountService(database: database, hubID: hubID)
            try await transactionalService.save(account)
            if let id = account.id {
                _ = try await AttachmentReferenceService(database: database, hubID: hubID).attach(metadataID: account.logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
                try await transactionalService.save(account)
            }
        }
        return account
    }

    accounts.get(":id") { request async throws -> ServiceAccount in
        let (_, account) = try await requireRouteRecord(request.parameters.get("id", as: Int.self)) {
            try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        // Returns one recurring service account by its stable ServiceID.
        return account
    }

    accounts.patch(":id") { request async throws -> ServiceAccount in
        let (id, account) = try await requireRouteRecord(request.parameters.get("id", as: Int.self)) {
            try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }
        try PropertyPatchValidation.requireKnownJSONProperties(
            request,
            allowed: ["service", "monthlyAmount", "status", "notes", "logoFileMetadataID"],
            requireNonEmpty: true,
            emptyReason: "At least one editable field is required."
        )
        let input = try request.content.decode(ServiceAccountPatchRequest.self)
        let service = input.service ?? account.service
        guard !service.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Abort(.unprocessableEntity, reason: "Service name cannot be empty.") }
        let monthlyAmount = input.monthlyAmount ?? account.monthlyAmount
        if let monthlyAmount, monthlyAmount < 0 { throw Abort(.unprocessableEntity, reason: "Monthly amount cannot be negative.") }
        let logoFileMetadataID = input.logoFileMetadataID ?? account.logoFileMetadataID
        try await AttachmentReferenceService(database: request.db, hubID: request.authenticatedHubID).replace(oldMetadataID: account.logoFileMetadataID, newMetadataID: logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
        account.service = service
        account.monthlyAmount = monthlyAmount
        account.status = input.status ?? account.status
        account.notes = input.notes ?? account.notes
        account.logoFileMetadataID = logoFileMetadataID
        account.updatedAt = RecordTimestamp.now()
        try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).save(account)
        return account
    }

    accounts.put(":id") { request async throws -> ServiceAccount in
        let (id, account) = try await requireRouteRecord(request.parameters.get("id", as: Int.self)) {
            try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        let input = try request.content.decode(ServiceAccountRequest.self)
        try validate(input)
        let replacement = makeServiceAccount(from: input, id: id)
        try await AttachmentReferenceService(database: request.db, hubID: request.authenticatedHubID).replace(oldMetadataID: account.logoFileMetadataID, newMetadataID: replacement.logoFileMetadataID, ownerType: "ServiceAccount", ownerID: String(id))
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
        try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).save(account)
        return account
    }

    accounts.delete(":id") { request async throws -> HTTPStatus in
        let (id, _) = try await requireRouteRecord(request.parameters.get("id", as: Int.self)) {
            try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).find(id: $0)
        }

        try await ServiceAccountService(database: request.db, hubID: request.authenticatedHubID).delete(id: id)
        return .noContent
    }
}
