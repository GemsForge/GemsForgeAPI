import Vapor

/// Registers read endpoints for Gem Hues and their stored image blobs.
func registerGemHueRoutes(
    _ app: Application,
    imageConfiguration: LocalImageUploadConfiguration = .fromEnvironment()
) {
    let hues = app.grouped("gemhues")

    hues.post("import", "preview") { request async throws -> GemHueImportPreview in
        let input = try request.content.decode([GemHueImportRow].self)
        return try await GemHueImportService(database: request.db, hubID: request.authenticatedHubID).preview(input)
    }
    hues.post("import") { request async throws -> [String: Int] in
        let input = try request.content.decode(GemHueImportRequest.self)
        return ["importedCount": try await GemHueImportService(database: request.db, hubID: request.authenticatedHubID).publish(input)]
    }

    hues.post { request async throws -> GemHue in
        let input = try request.content.decode(GemHue.self)
        guard let id = input.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty,
              !input.colorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !input.hexCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw Abort(.badRequest, reason: "HueID, color name, and hex code are required.")
        }
        let service = GemHueService(database: request.db, hubID: request.authenticatedHubID)
        guard try await service.find(id: id) == nil else {
            throw Abort(.conflict, reason: "A Gem Hue with this ID already exists.")
        }
        let record = GemHue(
            id: id, colorName: input.colorName, colorFamily: input.colorFamily,
            hexCode: input.hexCode, mood: input.mood, palette: input.palette,
            description: input.description, createdDate: input.createdDate, notes: input.notes
        )
        record.hubID = request.authenticatedHubID
        try await record.create(on: request.db)
        return record
    }

    hues.get { request async throws -> [GemHue] in
        // Returns the list of Foundation Gem Hues without loading image blobs.
        try await GemHueService(database: request.db, hubID: request.authenticatedHubID).list()
    }

    hues.get(":hueID") { request async throws -> GemHue in
        guard let hueID = request.parameters.get("hueID"),
              let hue = try await GemHueService(database: request.db, hubID: request.authenticatedHubID).find(id: hueID)
        else {
            throw Abort(.notFound)
        }

        // Returns one Gem Hue record without embedding its binary image data.
        return hue
    }

    hues.patch(":hueID") { request async throws -> GemHue in
        guard let hueID = request.parameters.get("hueID"),
              let hue = try await GemHueService(database: request.db, hubID: request.authenticatedHubID).find(id: hueID)
        else { throw Abort(.notFound) }
        let payload = try request.content.decode([String: String?].self)
        try PropertyPatchValidation.requireNonEmpty(payload)
        try PropertyPatchValidation.requireKnownProperties(payload, allowed: ["colorName", "colorFamily", "hexCode", "mood", "palette", "description", "createdDate", "notes"])
        let value: (String, String?) -> String? = { key, current in PropertyPatchValidation.value(key, in: payload, current: current) }
        guard let colorName = value("colorName", hue.colorName), !colorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let hexCode = value("hexCode", hue.hexCode), !hexCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw Abort(.unprocessableEntity, reason: "Color name and hex code cannot be empty.") }
        hue.colorName = colorName
        hue.colorFamily = value("colorFamily", hue.colorFamily)
        hue.hexCode = hexCode
        hue.mood = value("mood", hue.mood)
        hue.palette = value("palette", hue.palette)
        hue.description = value("description", hue.description)
        hue.createdDate = value("createdDate", hue.createdDate)
        hue.notes = value("notes", hue.notes)
        try await GemHueService(database: request.db, hubID: request.authenticatedHubID).save(hue)
        return hue
    }

    hues.get(":hueID", "image") { request async throws -> Response in
        guard let hueID = request.parameters.get("hueID"),
              let image = try await GemHueService(database: request.db, hubID: request.authenticatedHubID).findImage(hueID: hueID)
        else {
            throw Abort(.notFound)
        }

        if let fileMetadataID = image.fileMetadataID,
           let metadata = try await FileMetadataService(database: request.db, hubID: request.authenticatedHubID).find(id: fileMetadataID) {
            return try await streamFileMetadataContent(
                metadata,
                request: request,
                configuration: imageConfiguration
            )
        }

        let mediaTypeParts = image.mimeType.split(separator: "/", maxSplits: 1)
        guard mediaTypeParts.count == 2 else {
            throw Abort(.internalServerError, reason: "Stored image MIME type is invalid.")
        }

        let response = Response(status: .ok)
        response.headers.contentType = HTTPMediaType(
            type: String(mediaTypeParts[0]),
            subType: String(mediaTypeParts[1])
        )
        response.body = .init(data: image.image)
        return response
    }
}
