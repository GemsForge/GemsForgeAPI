import Vapor

/// Registers migration preview and confirmation without executing schema changes.
func registerLiveMigrationRoutes(_ app: Application, backupConfiguration: LiveDatabaseBackupConfiguration? = .fromEnvironment()) {
    let service = LiveMigrationPreviewService()
    let tableCreationService = LiveTableCreationService(
        previewService: service,
        backupConfiguration: backupConfiguration
    )
    let migrations = app.grouped("live-database", "migrations")
    let schemaChanges = app.grouped("live-database", "schema-changes")
    let approvedChanges = ApprovedSchemaChangeService(backupConfiguration: backupConfiguration)

    migrations.post("preview") { request async throws -> LiveMigrationPlan in
        do {
            let input = try request.content.decode(LiveMigrationPreviewRequest.self)
            return try await service.preview(request: input)
        } catch let error as LiveMigrationPreviewError {
            throw Abort(.badRequest, reason: error.description)
        }
    }

    migrations.post("confirm") { request async throws -> LiveMigrationPlan in
        do {
            let input = try request.content.decode(LiveMigrationConfirmationRequest.self)
            return try await service.confirm(input)
        } catch let error as LiveMigrationPreviewError {
            throw Abort(.conflict, reason: error.description)
        }
    }

    migrations.post("execute") { request async throws -> LiveTableCreationResponse in
        do {
            let input = try request.content.decode(LiveTableCreationRequest.self)
            return try await tableCreationService.execute(input, using: request.db)
        } catch let error as LiveMigrationPreviewError {
            throw Abort(.conflict, reason: error.description)
        } catch let error as LiveTableCreationError {
            switch error {
            case .backupNotConfigured:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .tableAlreadyExists:
                throw Abort(.conflict, reason: error.description)
            case .unsupportedTable:
                throw Abort(.badRequest, reason: error.description)
            case .migrationFailed, .verificationFailed:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        }
    }

    schemaChanges.post("preview") { request async throws -> ApprovedSchemaChangePreview in
        do {
            let input = try request.content.decode(ApprovedSchemaChangePreviewRequest.self)
            return try await approvedChanges.preview(input)
        } catch let error as ApprovedSchemaChangeError {
            throw Abort(.badRequest, reason: error.description)
        }
    }

    schemaChanges.post("execute") { request async throws -> ApprovedSchemaChangeExecutionResponse in
        do {
            let input = try request.content.decode(LiveTableCreationRequest.self)
            return try await approvedChanges.execute(input, using: request.db)
        } catch let error as ApprovedSchemaChangeError {
            switch error {
            case .expiredOrUnknownToken, .alreadyApplied:
                throw Abort(.conflict, reason: error.description)
            case .unsupportedChange:
                throw Abort(.badRequest, reason: error.description)
            case .backupNotConfigured:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .sqliteDatabaseRequired, .migrationFailed, .verificationFailed:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        }
    }
}
