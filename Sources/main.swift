import Fluent
import FluentSQLiteDriver
import Vapor

@main
enum EntryPoint {
    static func main() async throws {
        let app = try await Application.make(.detect())

        app.databases.use(
            .sqlite(
                .file(Environment.get("DATABASE_PATH") ?? "GemsForgeAPI.sqlite")
            ),
            as: .sqlite
        )

        app.get("health") { _ async in
            "ok"
        }

        try await app.execute()
        try await app.asyncShutdown()
    }
}
