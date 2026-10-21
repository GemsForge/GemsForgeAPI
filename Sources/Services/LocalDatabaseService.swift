import Fluent
import FluentSQLiteDriver
import Vapor

enum LocalDatabaseProfile: String, Codable, CaseIterable, Sendable {
    case gemLifeDevelopment = "gem-life-development"

    var displayName: String {
        switch self {
        case .gemLifeDevelopment:
            return "Gem Life development database"
        }
    }

    var migrationNames: [String] {
        [
            "CreateAuthenticationSchema",
            "CreateHubs",
            "CreateAddresses",
            "AllowSchoolAddressType",
            "CreateDomains",
            "CreateEducation",
            "CreateEmployment",
            "CreateBudgetCategories",
            "CreateBudgetSubcategories",
            "CreateExpenseTransactions",
            "AddTransactionImage",
            "CreateEmojiLabelDefinitions",
            "CreateFileMetadata",
            "CreateServiceAccounts",
            "CreateServiceLogoAssets",
            "CreateForgeKeeper",
            "CreateGemHues",
            "CreateGemHueImages",
            "AddGemHueImageFileMetadataReference",
            "AddServiceLogoFileMetadataReference",
            "CreateHomeInventory",
            "AddAddressAttachmentReference",
            "AddServiceAccountAttachmentReference",
            "MakeServiceAccountEmailUpdatedBoolean",
            "NormalizeServiceAccountEmailUpdatedValues",
            "AddEducationAttachmentReference",
            "AddHomeInventoryAttachmentReference",
            "AddFileMetadataForeignKeys",
            "AddHubOwnershipFields",
            "MakeAuthenticationProviderAgnostic",
            "CreateTableViews",
            "CreateViewColumnConfigurations",
            "CreateViewQueryConfigurations"
        ]
    }

    func registerMigrations(on app: Application) {
        switch self {
        case .gemLifeDevelopment:
            // Ownership targets must exist before any hub-owned table is created.
            app.migrations.add(CreateAuthenticationSchema())
            app.migrations.add(CreateHubs())
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressUpdatedAt())
            app.migrations.add(AllowSchoolAddressType())
            app.migrations.add(CreateDomains())
            app.migrations.add(CreateEducation())
            app.migrations.add(AddEducationUpdatedAt())
            app.migrations.add(CreateEmployment())
            app.migrations.add(AddEmploymentUpdatedAt())
            app.migrations.add(CreateBudgetCategories())
            app.migrations.add(CreateBudgetSubcategories())
            app.migrations.add(CreateExpenseTransactions())
            app.migrations.add(AddTransactionImage())
            app.migrations.add(CreateEmojiLabelDefinitions())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(CreateServiceAccounts())
            app.migrations.add(CreateServiceLogoAssets())
            app.migrations.add(AddServiceLogoFileMetadataReference())
            app.migrations.add(CreateForgeKeeper())
            app.migrations.add(CreateGemHues())
            app.migrations.add(CreateGemHueImages())
            app.migrations.add(AddGemHueImageFileMetadataReference())
            app.migrations.add(CreateHomeInventory())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(AddServiceAccountAttachmentReference())
            app.migrations.add(MakeServiceAccountEmailUpdatedBoolean())
            app.migrations.add(NormalizeServiceAccountEmailUpdatedValues())
            app.migrations.add(AddEducationAttachmentReference())
            app.migrations.add(AddHomeInventoryAttachmentReference())
            app.migrations.add(AddFileMetadataForeignKeys())
            app.migrations.add(AddHubOwnershipFields())
            app.migrations.add(MakeAuthenticationProviderAgnostic())
            // View metadata is additive and must follow the finalized Hub
            // schema. Child configuration tables follow their parent view.
            app.migrations.add(CreateTableViews())
            app.migrations.add(CreateViewColumnConfigurations())
            app.migrations.add(CreateViewQueryConfigurations())
        }
    }
}

struct LocalDatabaseCreationRequest: Content {
    let databaseName: String
    let profile: String
    let confirmCreation: Bool
}

struct LocalDatabaseProfileResponse: Content {
    let id: String
    let name: String
    let migrations: [String]
}

struct LocalDatabaseCapabilitiesResponse: Content {
    let enabled: Bool
    let ready: Bool
    let profiles: [LocalDatabaseProfileResponse]
    let safetyRules: [String]
}

struct LocalDatabaseCreationResponse: Content {
    let databaseName: String
    let profile: String
    let migrationCount: Int
    let status: String
}

/// Creates isolated local SQLite databases and applies only approved migrations.
struct LocalDatabaseService: Sendable {
    private let configuration: LocalDatabaseConfiguration

    init(configuration: LocalDatabaseConfiguration) {
        self.configuration = configuration
    }

    func capabilities() -> LocalDatabaseCapabilitiesResponse {
        LocalDatabaseCapabilitiesResponse(
            enabled: configuration.enabled,
            ready: configuration.isReady,
            profiles: LocalDatabaseProfile.allCases.map {
                LocalDatabaseProfileResponse(id: $0.rawValue, name: $0.displayName, migrations: $0.migrationNames)
            },
            safetyRules: [
                "Only simple .sqlite filenames are accepted.",
                "Existing files cannot be replaced.",
                "The configured personal database path is protected.",
                "Only approved migration profiles can be applied.",
                "This feature is disabled unless explicitly enabled for local development."
            ]
        )
    }

    func create(request: LocalDatabaseCreationRequest) async throws -> LocalDatabaseCreationResponse {
        guard request.confirmCreation else {
            throw LocalDatabaseError.confirmationRequired
        }

        guard let profile = LocalDatabaseProfile(rawValue: request.profile) else {
            throw LocalDatabaseError.unsupportedProfile
        }

        let targetURL = try configuration.targetURL(for: request.databaseName)
        guard FileManager.default.createFile(atPath: targetURL.path, contents: nil) else {
            throw LocalDatabaseError.databaseAlreadyExists
        }

        let databaseApp = try await Application.make(.testing)
        databaseApp.databases.use(.sqlite(.file(targetURL.path)), as: .sqlite)
        profile.registerMigrations(on: databaseApp)

        do {
            try await databaseApp.autoMigrate()
            try await databaseApp.asyncShutdown()
        } catch {
            try? await databaseApp.asyncShutdown()
            throw LocalDatabaseError.migrationFailed(error.localizedDescription)
        }

        return LocalDatabaseCreationResponse(
            databaseName: targetURL.lastPathComponent,
            profile: profile.rawValue,
            migrationCount: profile.migrationNames.count,
            status: "created-and-migrated"
        )
    }
}
