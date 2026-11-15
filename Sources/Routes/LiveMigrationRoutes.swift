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
    let userTables = UserTableCreationService(backupConfiguration: backupConfiguration)
    let repositoryMigrations = LiveRepositoryMigrationService(backupConfiguration: backupConfiguration)
    let auditDatabaseIdentity = backupConfiguration?.databaseIdentity ?? "configured Gem Life database"
    let tableDrops = TableDropWorkflowService(backupConfiguration: backupConfiguration, auditDatabaseIdentity: auditDatabaseIdentity)

    app.post("live-database", "repository-migrations", "preview") { _ async throws -> LiveRepositoryMigrationPreview in
        await repositoryMigrations.preview()
    }

    app.post("live-database", "repository-migrations", "execute") { request async throws -> LiveRepositoryMigrationExecution in
        let input = try request.content.decode(LiveRepositoryMigrationRequest.self)
        return try await repositoryMigrations.execute(input, using: request.application)
    }

    migrations.get("history") { request async throws -> [SchemaMigrationAudit] in
        try await LiveMigrationAuditService(
            database: request.db,
            databaseIdentity: auditDatabaseIdentity
        ).history()
    }

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

    app.post("live-database", "tables", "preview") { request async throws -> UserTablePreviewResponse in
        do {
            let input = try request.content.decode(TableBuilderRequest.self)
            return try await userTables.preview(input, using: request.db)
        } catch let error as TableBuilderContractService.ValidationError {
            throw Abort(.badRequest, reason: error.description)
        } catch let error as UserTableCreationError {
            throw Abort(.conflict, reason: error.description)
        }
    }

    app.post("live-database", "tables", "execute") { request async throws -> UserTableCreationResponse in
        do {
            let input = try request.content.decode(LiveTableCreationRequest.self)
            return try await userTables.execute(confirmationToken: input.confirmationToken, using: request.db)
        } catch let error as UserTableCreationError {
            switch error {
            case .expiredOrUnknownToken, .tableAlreadyExists:
                throw Abort(.conflict, reason: error.description)
            case .backupNotConfigured:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .sqliteDatabaseRequired, .migrationFailed, .verificationFailed:
                throw Abort(.unprocessableEntity, reason: error.description)
            }
        }
    }

    let tableDropRoutes = app.grouped("live-schema", "tables", ":tableName")
    tableDropRoutes.post("drop-preview") { request async throws -> TableDropPreviewResponse in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        do {
            return try await tableDrops.preview(tableName: tableName, hubID: hubID, using: request.db)
        } catch let error as TableDropWorkflowError {
            switch error {
            case .tableUnavailable: throw Abort(.notFound, reason: error.description)
            case .sqliteDatabaseRequired, .backupNotConfigured, .backupFailed:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .notEligible, .blocked: throw Abort(.unprocessableEntity, reason: error.description)
            case .expiredOrUnknownToken, .typedNameMismatch, .previewChanged, .dropFailed, .verificationFailed:
                throw Abort(.conflict, reason: error.description)
            }
        }
    }
    tableDropRoutes.post("drop") { request async throws -> Response in
        let hubID = try request.requireAuthenticatedHubID()
        guard let tableName = request.parameters.get("tableName") else { throw Abort(.badRequest) }
        let input = try request.content.decode(TableDropConfirmationRequest.self)
        do {
            let result = try await tableDrops.confirm(
                tableName: tableName,
                hubID: hubID,
                request: input,
                using: request.db
            )
            return try await result.encodeResponse(for: request)
        } catch let error as TableDropWorkflowError {
            if case .previewChanged(let freshPreview) = error {
                let response = Response(status: .conflict)
                try response.content.encode(freshPreview)
                return response
            }
            switch error {
            case .tableUnavailable: throw Abort(.notFound, reason: error.description)
            case .sqliteDatabaseRequired, .backupNotConfigured, .backupFailed:
                throw Abort(.serviceUnavailable, reason: error.description)
            case .blocked, .notEligible: throw Abort(.unprocessableEntity, reason: error.description)
            case .expiredOrUnknownToken, .typedNameMismatch: throw Abort(.conflict, reason: error.description)
            case .dropFailed, .verificationFailed: throw Abort(.unprocessableEntity, reason: error.description)
            case .previewChanged: throw Abort(.conflict, reason: error.description)
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
