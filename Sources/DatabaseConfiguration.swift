import Fluent
import FluentSQLiteDriver
import Vapor

extension Application {
    /// Registers the SQLite database selected by the local environment.
    ///
    /// The application requires `DATABASE_PATH` so it cannot silently connect
    /// to a different SQLite file.
    func configureDatabase() throws {
        let configuration = try DatabaseEnvironment.resolve { Environment.get($0) }

        databases.use(
            .sqlite(.file(configuration.databasePath)),
            as: .sqlite
        )
        logger.info("Configured Gem Life database environment: \(configuration.environment.rawValue)")
        logger.info("Gem Life database identity: \(configuration.databasePath)")
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

    static func resolve(_ value: String? = nil, variables: [String: String?] = [:]) throws -> DatabaseEnvironmentConfiguration {
        try resolve(value: value, lookup: { variables[$0] ?? nil })
    }

    static func resolve(value: String? = nil, lookup: (String) -> String?) throws -> DatabaseEnvironmentConfiguration {
        let environment = try fromEnvironment(value ?? lookup("GEMLIFE_ENVIRONMENT"))
        let databasePath = try requiredValue(for: environment.databasePathKey, lookup: lookup)
        let backupDirectory = try requiredValue(for: environment.backupDirectoryKey, lookup: lookup)

        let databaseURL = URL(fileURLWithPath: databasePath).standardizedFileURL
        let backupURL = URL(fileURLWithPath: backupDirectory).standardizedFileURL
        if environment == .prod && databaseURL == backupURL {
            throw DatabaseConfigurationError.productionBackupCollision
        }

        return DatabaseEnvironmentConfiguration(
            environment: environment,
            databasePath: databasePath,
            backupDirectory: backupDirectory
        )
    }

    private static func requiredValue(for key: String, lookup: (String) -> String?) throws -> String {
        guard let value = lookup(key)?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            throw DatabaseConfigurationError.missingConfiguration(key)
        }
        return value
    }

    var databasePathKey: String {
        self == .dev ? "DATABASE_PATH" : "DATABASE_PATH_\(rawValue.uppercased())"
    }

    var backupDirectoryKey: String {
        self == .dev ? "LIVE_DATABASE_BACKUP_DIRECTORY" : "LIVE_DATABASE_BACKUP_DIRECTORY_\(rawValue.uppercased())"
    }
}

struct DatabaseEnvironmentConfiguration: Equatable, Sendable {
    let environment: DatabaseEnvironment
    let databasePath: String
    let backupDirectory: String
}

enum DatabaseConfigurationError: Error, CustomStringConvertible, Equatable {
    case missingConfiguration(String)
    case invalidEnvironment(String)
    case productionBackupCollision

    var description: String {
        switch self {
        case let .missingConfiguration(key):
            "\(key) is required for the selected Gem Life environment. Configure it in the Xcode Scheme or .env file."
        case let .invalidEnvironment(value):
            "GEMLIFE_ENVIRONMENT must be one of dev, fit, or prod; received '\(value)'."
        case .productionBackupCollision:
            "The production database path and backup directory must be different locations."
        }
    }
}
