import Fluent
import FluentSQLiteDriver
import Vapor

extension Application {
    /// Registers the SQLite database selected by the local environment.
    ///
    /// The application requires `DATABASE_PATH` so it cannot silently connect
    /// to a different SQLite file.
    func configureDatabase() throws {
        guard let databasePath = Environment.get("DATABASE_PATH"),
              !databasePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw DatabaseConfigurationError.missingDatabasePath
        }

        databases.use(
            .sqlite(.file(databasePath)),
            as: .sqlite
        )
    }
}

enum DatabaseConfigurationError: Error, CustomStringConvertible {
    case missingDatabasePath

    var description: String {
        "DATABASE_PATH is required. Configure it in the Xcode Scheme or export it before starting the API."
    }
}
