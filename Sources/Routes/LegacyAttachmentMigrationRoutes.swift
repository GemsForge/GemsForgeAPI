import Vapor

struct LegacyAttachmentMigrationRequest: Content {
    let confirm: Bool
}

struct LegacyAttachmentMigrationResponse: Content {
    let gemHueImagesMigrated: Int
    let serviceLogosMigrated: Int
    let filesWritten: Int
}

/// Runs the explicit, local-only legacy blob migration after a backup.
func registerLegacyAttachmentMigrationRoutes(
    _ app: Application,
    configuration: LocalImageUploadConfiguration
) {
    app.post("file-metadata", "migrate-legacy") { request async throws -> LegacyAttachmentMigrationResponse in
        let input = try request.content.decode(LegacyAttachmentMigrationRequest.self)
        guard input.confirm else {
            throw Abort(.badRequest, reason: "Migration requires confirm=true after a verified backup.")
        }
        guard let directory = configuration.directory else {
            throw Abort(.serviceUnavailable, reason: "ASSET_DIRECTORY is not configured.")
        }

        let result = try await LegacyAttachmentMigrationService(
            database: request.db,
            directory: directory
        ).migrate()
        return LegacyAttachmentMigrationResponse(
            gemHueImagesMigrated: result.gemHueImagesMigrated,
            serviceLogosMigrated: result.serviceLogosMigrated,
            filesWritten: result.filesWritten
        )
    }
}
