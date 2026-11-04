import Fluent
import SQLKit

/// Adds the optional image reference used by Addresses.
struct AddAddressAttachmentReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else { return }
        let columns = try await sql.raw(SQLQueryString(stringLiteral: "PRAGMA table_info(\"Addresses\")")).all()
        guard !columns.contains(where: { (try? $0.decode(column: "name", as: String.self)) == "ImageFileMetadataID" }) else {
            return
        }
        try await database.schema(Address.schema)
            .field("ImageFileMetadataID", .string, .references(
                FileMetadata.schema, "FileMetadataID", onDelete: .setNull, onUpdate: .cascade
            ))
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Address.schema).deleteField("ImageFileMetadataID").update()
    }
}

/// Adds the optional logo reference used by Service Accounts.
struct AddServiceAccountAttachmentReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema).field("LogoFileMetadataID", .string, .references(
            FileMetadata.schema, "FileMetadataID", onDelete: .setNull, onUpdate: .cascade
        )).update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(ServiceAccount.schema).deleteField("LogoFileMetadataID").update()
    }
}

/// Adds the optional document reference used by Education records.
struct AddEducationAttachmentReference: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(Education.schema).field("DocumentFileMetadataID", .string, .references(
            FileMetadata.schema, "FileMetadataID", onDelete: .setNull, onUpdate: .cascade
        )).update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(Education.schema).deleteField("DocumentFileMetadataID").update()
    }
}
