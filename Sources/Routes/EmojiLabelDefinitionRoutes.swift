import Fluent
import Vapor

struct EmojiLabelDefinitionRequest: Content {
    let id: Int?
    let label: String
    let emoji: String
    let description: String?
    let isActive: Bool
}

struct EmojiLabelDefinitionCreateRequest: Content {
    let value: EmojiLabelDefinitionRequest

    init(from decoder: Decoder) throws {
        try CreateContractValidation.rejectUnknownFields(in: decoder, allowed: ["id", "label", "emoji", "description", "isActive"])
        value = try EmojiLabelDefinitionRequest(from: decoder)
    }
}

private func validate(_ input: EmojiLabelDefinitionRequest) throws {
    guard !input.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Emoji label name is required.")
    }

    guard !input.emoji.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Abort(.badRequest, reason: "Emoji value is required.")
    }
}

private func makeDefinition(from input: EmojiLabelDefinitionRequest, id: Int?) -> EmojiLabelDefinition {
    EmojiLabelDefinition(
        id: id,
        label: input.label.trimmingCharacters(in: .whitespacesAndNewlines),
        emoji: input.emoji.trimmingCharacters(in: .whitespacesAndNewlines),
        description: input.description?.trimmingCharacters(in: .whitespacesAndNewlines),
        isActive: input.isActive
    )
}

private func ensureLabelIsAvailable(
    _ label: String,
    excludingID: Int? = nil,
    hubID: String?,
    database: any Database
) async throws {
    let normalizedLabel = label.trimmingCharacters(in: .whitespacesAndNewlines)
    let definitions = try await EmojiLabelDefinitionService(database: database, hubID: hubID).list(includeInactive: true)

    if definitions.contains(where: {
        $0.id != excludingID && $0.label.caseInsensitiveCompare(normalizedLabel) == .orderedSame
    }) {
        throw Abort(.conflict, reason: "An emoji label with this name already exists.")
    }
}

/// Registers CRUD endpoints for reusable emoji label definitions.
func registerEmojiLabelDefinitionRoutes(_ app: Application) {
    let labels = app.grouped("emoji-labels")

    labels.get { request async throws -> [EmojiLabelDefinition] in
        let includeInactive = request.query[Bool.self, at: "includeInactive"] ?? false
        return try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID)
            .list(includeInactive: includeInactive)
    }

    labels.post { request async throws -> EmojiLabelDefinition in
        let input = try request.content.decode(EmojiLabelDefinitionCreateRequest.self).value
        try validate(input)
        try await ensureLabelIsAvailable(input.label, hubID: request.authenticatedHubID, database: request.db)

        if let id = input.id,
           try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).find(id: id) != nil
        {
            throw Abort(.conflict, reason: "An emoji label with this ID already exists.")
        }

        let definition = makeDefinition(from: input, id: input.id)
        try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).save(definition)
        return definition
    }

    labels.get(":id") { request async throws -> EmojiLabelDefinition in
        guard let id = request.parameters.get("id", as: Int.self),
              let definition = try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return definition
    }

    labels.put(":id") { request async throws -> EmojiLabelDefinition in
        guard let id = request.parameters.get("id", as: Int.self),
              let definition = try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).find(id: id)
        else {
            throw Abort(.notFound)
        }

        let input = try request.content.decode(EmojiLabelDefinitionRequest.self)
        try validate(input)
        try await ensureLabelIsAvailable(input.label, excludingID: id, hubID: request.authenticatedHubID, database: request.db)

        let replacement = makeDefinition(from: input, id: id)
        definition.label = replacement.label
        definition.emoji = replacement.emoji
        definition.description = replacement.description
        definition.isActive = replacement.isActive
        try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).save(definition)
        return definition
    }

    labels.delete(":id") { request async throws -> HTTPStatus in
        guard let id = request.parameters.get("id", as: Int.self),
              try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).find(id: id) != nil
        else {
            throw Abort(.notFound)
        }

        try await EmojiLabelDefinitionService(database: request.db, hubID: request.authenticatedHubID).delete(id: id)
        return .noContent
    }
}
