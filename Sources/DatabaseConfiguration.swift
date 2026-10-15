import Fluent
import FluentSQLiteDriver
import Vapor

extension Application {
    /// Registers the SQLite database selected by the local environment.
    ///
    /// The application requires `DATABASE_PATH` so it cannot silently connect
    /// to a different SQLite file.
    func configureDatabase() throws {
        let environment = try DatabaseEnvironment.fromEnvironment()
        guard let databasePath = Environment.get("DATABASE_PATH"),
              !databasePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw DatabaseConfigurationError.missingDatabasePath
        }

        databases.use(
            .sqlite(.file(databasePath)),
            as: .sqlite
        )
        logger.info("Configured Gem Life database environment: \(environment.rawValue)")
    }
}

enum DatabaseEnvironment: String, CaseIterable, Sendable {
    case dev
    case fit
    case prod

    static func fromEnvironment(_ value: String? = Environment.get("GEMLIFE_ENVIRONMENT")) throws -> Self {
        let normalized = (value ?? "dev").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let environment = Self(rawValue: normalized) else {
            throw DatabaseConfigurationError.invalidEnvironment(normalized)
        }
        return environment
    }
}

enum DatabaseConfigurationError: Error, CustomStringConvertible, Equatable {
    case missingDatabasePath
    case invalidEnvironment(String)

    var description: String {
        switch self {
        case .missingDatabasePath:
            "DATABASE_PATH is required. Configure it in the Xcode Scheme or export it before starting the API."
        case let .invalidEnvironment(value):
            "GEMLIFE_ENVIRONMENT must be one of dev, fit, or prod; received '\(value)'."
        }
    }
}
