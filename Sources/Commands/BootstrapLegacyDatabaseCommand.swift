import Foundation
import Vapor

struct BootstrapLegacyDatabaseCommand: AsyncCommand {
    struct Signature: CommandSignature {
        @Option(
            name: "confirm-database-filename",
            help: "Must exactly match the configured existing DEV or FIT database filename."
        )
        var confirmationFilename: String?

        init() {}
    }

    let help = "Backs up and applies the repository schema to an existing DEV or FIT database before first sign-in."

    func run(using context: CommandContext, signature: Signature) async throws {
        guard let confirmationFilename = signature.confirmationFilename else {
            throw LegacyDatabaseBootstrapError.confirmationRequired
        }
        let environment = try DatabaseEnvironment.fromEnvironment()
        let result = try await LegacyDatabaseBootstrapService(
            environment: environment,
            backupConfiguration: .fromEnvironment()
        ).execute(
            using: context.application,
            confirmationFilename: confirmationFilename
        )
        context.console.print("Database: \(confirmationFilename)")
        context.console.print("Backup: \(result.backupFileName) (\(result.backupSizeBytes) bytes)")
        context.console.print("Status: \(result.status)")
        context.console.print("Next: sign in, review the unassigned ownership preview, then explicitly confirm any assignment.")
    }
}
