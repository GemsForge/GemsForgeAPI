import Fluent

/// Adds JSON-encoded workspace state without changing existing saved views.
struct AddTableViewWorkspaceState: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema(TableView.schema)
            .field("WorkspaceState", .string)
            .update()
    }

    func revert(on database: any Database) async throws {
        try await database.schema(TableView.schema)
            .deleteField("WorkspaceState")
            .update()
    }
}
