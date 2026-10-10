import Vapor

@main
enum EntryPoint {
    static func main() async throws {
        let app = try await Application.make(.detect())

        app.configureDatabase()

        app.get("health") { _ async in
            "ok"
        }

        registerDomainRoutes(app)

        try await app.execute()
        try await app.asyncShutdown()
    }
}
