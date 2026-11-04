/// Central rules for exposing user-created, Hub-scoped tables to generic tools.
enum HubOwnedCustomTablePolicy {
    static let protectedTables: Set<String> = [
        "Hubs", "Accounts", "AccountIdentities", "AuthenticationSessions", "AppleAccounts",
        "AppleAuthChallenges", "TableViews", "ViewColumnConfigurations", "ViewQueryConfigurations",
        "RecordPresentations", "FileMetadata", "SchemaMigrationAudits", "Domains", "ForgeKeeper",
        "Addresses", "Education", "Employment", "Transactions", "BudgetCategories",
        "BudgetSubcategories", "Merchants", "EmojiLabelDefinitions", "GemHues", "GemHueImages",
        "HomeInventory", "Services", "ServiceLogoAssets", "TrashEntries",
    ]

    static func isEligible(_ table: LiveSchemaTableResponse) -> Bool {
        guard !protectedTables.contains(table.name),
              let hubColumn = table.columns.first(where: { $0.name == "HubID" }),
              !hubColumn.nullable,
              !hubColumn.primaryKey
        else { return false }
        let type = hubColumn.dataType.uppercased()
        return type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB")
    }
}
