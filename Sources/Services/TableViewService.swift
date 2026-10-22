import Fluent

/// Persists Hub-scoped Table Views while maintaining one deterministic default.
struct TableViewService: Sendable {
    let database: any Database

    /// Creates a view and rejects a conflicting default without changing metadata.
    func create(_ view: TableView) async throws {
        try await database.transaction { database in
            try await ensureDefaultIsAvailable(for: view, on: database)
            try await view.create(on: database)
        }
    }

    /// Updates a view atomically, promoting it when requested and replacing a demoted default.
    func update(_ view: TableView, isDefault: Bool) async throws {
        try await database.transaction { database in
            guard let id = view.id,
                  let stored = try await TableView.find(id, on: database),
                  stored.hubID == view.hubID,
                  stored.tableName == view.tableName else {
                throw TableViewPersistenceError.viewNotFound
            }

            if isDefault {
                try await clearDefault(excluding: id, hubID: view.hubID, tableName: view.tableName, on: database)
            } else if stored.isDefault {
                // Release the unique-index slot before promoting the replacement.
                stored.isDefault = false
                try await stored.update(on: database)
                try await promoteLowestSortOrder(excluding: id, hubID: view.hubID, tableName: view.tableName, on: database)
            }

            view.isDefault = isDefault
            try await view.update(on: database)
        }
    }

    /// Deletes a view and promotes the remaining lowest-sort-order view when needed.
    func delete(_ view: TableView) async throws {
        try await database.transaction { database in
            guard let id = view.id,
                  let stored = try await TableView.find(id, on: database) else {
                throw TableViewPersistenceError.viewNotFound
            }

            try await stored.delete(on: database)
            if stored.isDefault {
                try await promoteLowestSortOrder(excluding: id, hubID: stored.hubID, tableName: stored.tableName, on: database)
            }
        }
    }

    private func ensureDefaultIsAvailable(for view: TableView, on database: any Database) async throws {
        guard view.isDefault else { return }
        if try await TableView.query(on: database)
            .filter(\.$hubID == view.hubID)
            .filter(\.$tableName == view.tableName)
            .filter(\.$isDefault == true)
            .first() != nil {
            throw TableViewPersistenceError.defaultConflict
        }
    }

    private func clearDefault(excluding id: String, hubID: String, tableName: String, on database: any Database) async throws {
        let defaults = try await TableView.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$isDefault == true)
            .all()
        for current in defaults where current.id != id {
            current.isDefault = false
            try await current.update(on: database)
        }
    }

    private func promoteLowestSortOrder(excluding id: String, hubID: String, tableName: String, on database: any Database) async throws {
        guard let replacement = try await TableView.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$id != id)
            .sort(\.$sortOrder, .ascending)
            .first() else { return }
        replacement.isDefault = true
        try await replacement.update(on: database)
    }
}

/// Errors raised when a Table View operation cannot preserve default invariants.
enum TableViewPersistenceError: Error, Equatable {
    case defaultConflict
    case viewNotFound
}
