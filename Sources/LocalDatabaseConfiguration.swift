import Foundation
import Vapor

/// Configuration for the deliberately local-only database creation feature.
struct LocalDatabaseConfiguration: Sendable {
    let enabled: Bool
    let rootDirectory: URL?
    let protectedDatabaseURL: URL?

    /// Loads the feature from environment variables without enabling it by default.
    ///
    /// `LOCAL_DATABASE_CREATION_ENABLED` must be exactly `true`, and
    /// `LOCAL_DATABASE_DIRECTORY` must point to an existing directory.
    static func fromEnvironment() -> Self {
        let environment = (try? DatabaseEnvironment.fromEnvironment()) ?? .dev
        let enabled = environment != .prod && Environment.get("LOCAL_DATABASE_CREATION_ENABLED") == "true"
        let rootPath = Environment.get("LOCAL_DATABASE_DIRECTORY")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let databasePath = Environment.get("DATABASE_PATH")?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return Self(
            enabled: enabled,
            rootDirectory: rootPath.map { URL(fileURLWithPath: $0).standardizedFileURL },
            protectedDatabaseURL: databasePath.map { URL(fileURLWithPath: $0).standardizedFileURL }
        )
    }

    var isReady: Bool {
        guard enabled, let rootDirectory else { return false }
        let root = rootDirectory.standardizedFileURL

        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory)
            && isDirectory.boolValue
    }

    func targetURL(for databaseName: String) throws -> URL {
        guard isReady, let configuredRootDirectory = rootDirectory else {
            throw LocalDatabaseError.disabled
        }
        let rootDirectory = configuredRootDirectory.standardizedFileURL

        let name = databaseName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard name.count >= 1,
              name.count <= 80,
              name.hasSuffix(".sqlite"),
              !name.contains("/"),
              !name.contains("\\"),
              !name.contains("..")
        else {
            throw LocalDatabaseError.invalidDatabaseName
        }

        let target = rootDirectory.appendingPathComponent(name).standardizedFileURL
        guard target.deletingLastPathComponent() == rootDirectory else {
            throw LocalDatabaseError.invalidDatabaseName
        }

        if let protectedDatabaseURL, target == protectedDatabaseURL.standardizedFileURL {
            throw LocalDatabaseError.protectedDatabase
        }

        guard !FileManager.default.fileExists(atPath: target.path) else {
            throw LocalDatabaseError.databaseAlreadyExists
        }

        return target
    }
}

enum LocalDatabaseError: Error, CustomStringConvertible {
    case disabled
    case invalidDatabaseName
    case protectedDatabase
    case databaseAlreadyExists
    case confirmationRequired
    case unsupportedProfile
    case migrationFailed(String)

    var description: String {
        switch self {
        case .disabled:
            return "Local database creation is disabled or not configured."
        case .invalidDatabaseName:
            return "Database name must be a simple .sqlite filename."
        case .protectedDatabase:
            return "The configured personal database cannot be replaced or targeted."
        case .databaseAlreadyExists:
            return "A database with this name already exists. Choose a new name."
        case .confirmationRequired:
            return "Explicit confirmation is required before creating a database."
        case .unsupportedProfile:
            return "The requested database profile is not supported."
        case .migrationFailed(let details):
            return "Database creation stopped during migration: \(details)"
        }
    }
}
