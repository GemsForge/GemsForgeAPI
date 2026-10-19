import Fluent
import SQLKit

/// Adds nullable ownership references so historical rows remain unclaimable
/// until an operator explicitly assigns them to a hub.
struct AddHubOwnershipFields: AsyncMigration {
    static let ownedTables = [
        "Addresses",
        "Education",
        "Employment",
        "BudgetCategories",
        "BudgetSubcategories",
        "Transactions",
        "EmojiLabelDefinitions",
        "FileMetadata",
        "ForgeKeeper",
        "GemHues",
        "GemHueImages",
        "HomeInventory",
        "Services",
        "ServiceLogoAssets",
    ]

    func prepare(on database: any Database) async throws {
        guard let sql = database as? SQLDatabase else {
            throw HubOwnershipMigrationError.unsupportedDatabase
        }
        for table in Self.ownedTables {
            let columns = try await sql.raw(
                SQLQueryString(stringLiteral: "PRAGMA table_info(\"\(table)\")")
            ).all()
            guard columns.contains(where: {
                (try? $0.decode(column: "name", as: String.self)) == "HubID"
            }) == false else { continue }

            try await database.schema(table)
                .field("HubID", .string)
                .update()
        }
    }

    func revert(on database: any Database) async throws {
        for table in Self.ownedTables.reversed() {
            try await database.schema(table).deleteField("HubID").update()
        }
    }
}
