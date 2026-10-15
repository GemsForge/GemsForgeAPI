import Vapor

/// Registers metadata and explicit image routes for service logos.
func registerServiceLogoRoutes(
    _ app: Application,
    imageConfiguration: LocalImageUploadConfiguration = .fromEnvironment()
) {
    let logos = app.grouped("service-logos")

    logos.get { request async throws -> [ServiceLogoAssetSummary] in
        let assets = try await ServiceLogoService(database: request.db).list()
        return try assets.map(ServiceLogoAssetSummary.init)
    }

    logos.get(":id") { request async throws -> ServiceLogoAssetSummary in
        guard let id = request.parameters.get("id", as: Int.self),
              let asset = try await ServiceLogoService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        return try ServiceLogoAssetSummary(asset)
    }

    logos.get(":id", "image") { request async throws -> Response in
        guard let id = request.parameters.get("id", as: Int.self),
              let asset = try await ServiceLogoService(database: request.db).find(id: id)
        else {
            throw Abort(.notFound)
        }

        if let fileMetadataID = asset.fileMetadataID,
           let metadata = try await FileMetadataService(database: request.db).find(id: fileMetadataID) {
            return try await streamFileMetadataContent(
                metadata,
                request: request,
                configuration: imageConfiguration
            )
        }

        let mediaTypeParts = asset.mimeType.split(separator: "/", maxSplits: 1)
        guard mediaTypeParts.count == 2 else {
            throw Abort(.internalServerError, reason: "Stored logo MIME type is invalid.")
        }

        let response = Response(status: .ok)
        response.headers.contentType = HTTPMediaType(
            type: String(mediaTypeParts[0]),
            subType: String(mediaTypeParts[1])
        )
        response.body = .init(data: asset.logo)
        return response
    }
}
