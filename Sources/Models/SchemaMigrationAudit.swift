import Foundation
import Fluent
import Vapor

/// Records one attempted live schema change without storing the database path
/// or any other secret. The audit table is infrastructure metadata, not a
/// copy of the migration's data.
final class SchemaMigrationAudit: Model, Content, @unchecked Sendable {
    static let schema = "SchemaMigrationAudits"

    @ID(custom: "AuditID")
    var id: String?

    @Field(key: "MigrationName")
    var migrationName: String

    @Timestamp(key: "AppliedAt", on: .none)
    var appliedAt: Date?

    @Field(key: "Result")
    var result: String

    @Field(key: "DatabaseIdentity")
    var databaseIdentity: String

    @OptionalField(key: "BackupFileName")
    var backupFileName: String?

    @OptionalField(key: "FailureDetails")
    var failureDetails: String?

    init() {}

    init(
        id: String? = nil,
        migrationName: String,
        appliedAt: Date = Date(),
        result: String,
        databaseIdentity: String,
        backupFileName: String? = nil,
        failureDetails: String? = nil
    ) {
        self.id = id ?? UUID().uuidString
        self.migrationName = migrationName
        self.appliedAt = appliedAt
        self.result = result
        self.databaseIdentity = databaseIdentity
        self.backupFileName = backupFileName
        self.failureDetails = failureDetails
    }
}
