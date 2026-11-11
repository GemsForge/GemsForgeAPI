/// Central rules for exposing Hub-scoped record tables to generic tools.
enum HubOwnedCustomTablePolicy {
    /// Existing product tables whose rows belong to a Hub and can use the shared records UI.
    /// Blob stores and service metadata stay behind their dedicated workflows.
    static let liveRecordTables: Set<String> = [
        "Addresses", "Education", "Employment", "Transactions", "BudgetCategories",
        "BudgetSubcategories", "ForgeKeeper", "GemHues", "GemHueImages", "HomeInventory",
        "Services", "ServiceLogoAssets",
    ]

    /// Live tables already represented by a purpose-built Wireframe collection.
    /// Keep these available to CSV import while preventing duplicate generic pages.
    static let tablesWithDedicatedCollections: Set<String> = ["Transactions"]

    static let protectedTables: Set<String> = [
        "Hubs", "Accounts", "AccountIdentities", "AuthenticationSessions", "AppleAccounts",
        "AppleAuthChallenges", "TableViews", "ViewColumnConfigurations", "ViewQueryConfigurations",
        "TablePropertyDefinitions",
        "RecordPresentations", "FileMetadata", "SchemaMigrationAudits", "Domains",
        "EmojiLabelDefinitions", "TrashEntries",
    ]

    static func isEligible(_ table: LiveSchemaTableResponse) -> Bool {
        guard !protectedTables.contains(table.name),
              let hubColumn = table.columns.first(where: { $0.name == "HubID" }),
              !hubColumn.primaryKey
        else { return false }
        let type = hubColumn.dataType.uppercased()
        guard type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB") else { return false }
        return liveRecordTables.contains(table.name) || !hubColumn.nullable
    }
}
