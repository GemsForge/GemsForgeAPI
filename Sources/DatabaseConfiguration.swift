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
                .file(Environment.get("DATABASE_PATH") ?? "GemsForgeAPI.sqlite")
            ),
            as: .sqlite
        )

        // Fluent runs migrations in the order they are registered. The order
        // matters because each child table references its parent table.
        migrations.add(CreateDomains())
        migrations.add(CreateForgeKeeper())
    }
}
