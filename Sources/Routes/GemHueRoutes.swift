import Vapor

/// Registers read endpoints for Gem Hues and their stored image blobs.
func registerGemHueRoutes(
    _ app: Application,
    imageConfiguration: LocalImageUploadConfiguration = .fromEnvironment()
) {
    let hues = app.grouped("gemhues")

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
