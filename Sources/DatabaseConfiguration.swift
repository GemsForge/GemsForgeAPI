import Fluent
import FluentSQLiteDriver
import Vapor

extension Application {
    /// Registers the SQLite database used by the local development environment.
    ///
    /// `DATABASE_PATH` can override the default database filename without
    /// requiring a source-code change.
    func configureDatabase() {
        databases.use(
            .sqlite(
                .file(
                    Environment.get("DATABASE_PATH")
                        ?? "/Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite"
                )
            ),
            as: .sqlite
        )

    }
}
