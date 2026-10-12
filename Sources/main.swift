import Foundation
import Vapor

@main
enum EntryPoint {
    static func main() async throws {
        let app = try await Application.make(.detect())

        // Xcode launches from DerivedData by default. Point Vapor back to the
        // project directory so the local testing UI in Public/ is discoverable.
        let projectDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .path
        app.directory = .init(workingDirectory: projectDirectory)
        app.middleware.use(
            FileMiddleware(
                publicDirectory: app.directory.publicDirectory,
                defaultFile: "index.html"
            )
        )

        try app.configureDatabase()
        registerLocalDatabaseRoutes(app, configuration: .fromEnvironment())
        registerLiveSchemaRoutes(app)
        registerLiveMigrationRoutes(app, backupConfiguration: .fromEnvironment())
        registerSchemaBuilderGuidanceRoutes(app)

        app.get("health") { _ async in
            "ok"
        }

        registerDomainRoutes(app)
        registerAddressRoutes(app)
        registerEducationRoutes(app)
        registerEmploymentRoutes(app)
        registerExpenseTransactionRoutes(app)
        registerExpenseCategoryRoutes(app)
        registerExpenseSubcategoryRoutes(app)
        registerEmojiLabelDefinitionRoutes(app)
        registerFileMetadataRoutes(app)
        registerAttachmentReferenceRoutes(app)
        let imageConfiguration = LocalImageUploadConfiguration.fromEnvironment()
        registerLocalImageUploadRoutes(app, configuration: imageConfiguration)
        registerFileContentRoutes(app, configuration: imageConfiguration)
        registerServiceAccountRoutes(app)
        registerServiceLogoRoutes(app)
        registerForgeKeeperRoutes(app)
        registerGemHueRoutes(app)
        registerHomeInventoryRoutes(app)
        registerHomeInventoryCSVRoutes(app)

        try await app.execute()
        try await app.asyncShutdown()
    }
}
