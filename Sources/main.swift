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

        app.get("health") { _ async in
            "ok"
        }

        registerDomainRoutes(app)
        registerEducationRoutes(app)
        registerForgeKeeperRoutes(app)
        registerGemHueRoutes(app)

        try await app.execute()
        try await app.asyncShutdown()
    }
}
