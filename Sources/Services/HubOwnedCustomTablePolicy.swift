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
        "TablePropertyDefinitions", "TableColumnDefinitions",
        "RecordPresentations", "FileMetadata", "SchemaMigrationAudits", "Domains",
        "EmojiLabelDefinitions", "TrashEntries", "NotionImportReferences",
    ]

    /// Tables created by repository migrations are never user-owned tables,
    /// even when they contain the same ID/HubID shape as a custom table.
    static let migrationOwnedTables: Set<String> = [
        "Accounts", "AccountIdentities", "AuthenticationSessions", "AppleAccounts", "AppleAuthChallenges",
        "Hubs", "Addresses", "Domains", "Education", "Employment", "Transactions", "HomeInventory",
        "BudgetCategories", "BudgetSubcategories", "EmojiLabelDefinitions", "FileMetadata",
        "Services", "ServiceLogoAssets", "ForgeKeeper", "GemHues", "GemHueImages",
        "TableViews", "ViewColumnConfigurations", "ViewQueryConfigurations",
        "TablePropertyDefinitions", "TableColumnDefinitions", "RecordPresentations", "RecordBodies",
        "TrashEntries", "SchemaMigrationAudits", "NotionImportReferences",
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

    static func isDropEligible(_ table: LiveSchemaTableResponse) -> Bool {
        guard isEligible(table),
              !migrationOwnedTables.contains(table.name),
              !protectedTables.contains(table.name),
              table.columns.filter(\.primaryKey).count == 1
        else { return false }
        return true
    }
}
