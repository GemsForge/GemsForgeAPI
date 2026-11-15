import Fluent
import Foundation
import SQLKit
import Vapor

struct TableColumnDefinitionBackfillItem: Content, Sendable {
    let columnName: String
    let propertyType: TableColumnPropertyType
    let options: [TableColumnOption]
    let status: String
}

struct TableColumnDefinitionBackfillResponse: Content, Sendable {
    let items: [TableColumnDefinitionBackfillItem]
    let conflicts: [String]
}

struct TableColumnDefinitionBackfillService: Sendable {
    let database: any Database
    let hubID: String

    func preview(tableName: String) async throws -> TableColumnDefinitionBackfillResponse {
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }) else {
            return .init(items: [], conflicts: ["Table \(tableName) is not present in the live schema."])
        }
        let views = try await TableView.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .all()
        var types: [String: TableColumnPropertyType] = [:]
        var options: [String: [TableColumnOption]] = [:]
        var conflicts: [String] = []
        var conflictingColumns = Set<String>()
        for view in views {
            guard let workspaceState = view.workspaceState,
                  let data = workspaceState.data(using: .utf8),
                  let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            let rawTypes = state["propertyTypes"] as? [String: String] ?? [:]
            let rawOptions = state["propertySelectOptions"] as? [String: [String]] ?? [:]
            for (column, rawType) in rawTypes {
                let type: TableColumnPropertyType?
                switch rawType {
                case "MultiSelect", "Multi-select", "Tags": type = .multiSelect
                case "Select": type = .select
                case "Status": type = .status
                default: type = nil
                }
                guard let type else { continue }
                if let prior = types[column], prior != type {
                    conflicts.append("\(column) has conflicting legacy types \(prior.rawValue) and \(type.rawValue).")
                    conflictingColumns.insert(column)
                    continue
                }
                types[column] = type
                for value in rawOptions[column] ?? [] {
                    let option = TableColumnOption(value: value, color: nil)
                    if !(options[column] ?? []).contains(where: { $0.value == value }) { options[column, default: []].append(option) }
                }
            }
        }

        var items: [TableColumnDefinitionBackfillItem] = []
        for column in types.keys.sorted() {
            guard !conflictingColumns.contains(column), let type = types[column] else { continue }
            guard let liveColumn = table.columns.first(where: { $0.name == column }), liveColumn.hasTextAffinity,
                  table.columns.contains(where: { $0.name == "HubID" }) else {
                conflicts.append("\(column) is missing or does not have TEXT affinity; its legacy definition was skipped.")
                continue
            }
            let existing = try await TableColumnDefinition.query(on: database)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .filter(\.$columnName == column)
                .first()
            if let existing {
                let currentType = TableColumnPropertyType(rawValue: existing.propertyType) ?? type
                items.append(.init(columnName: column, propertyType: currentType, options: try existing.options(), status: "preserved"))
            } else {
                var values = options[column] ?? []
                if let sql = database as? SQLDatabase {
                    let rows = try await sql.raw(SQLQueryString("SELECT \(ident: column) AS \(ident: "value") FROM \(ident: tableName) WHERE \(ident: "HubID") = \(bind: hubID)")).all()
                    for row in rows {
                        let raw = try row.decode(column: "value", as: String?.self) ?? ""
                        for tag in MultiSelectValueCodec.decode(raw) where !values.contains(where: { $0.value == tag }) {
                            values.append(TableColumnOption(value: tag, color: nil))
                        }
                    }
                }
                let normalized = try TableColumnDefinitionService.validateOptions(values)
                items.append(.init(columnName: column, propertyType: type, options: normalized, status: "pending"))
            }
        }
        return .init(items: items, conflicts: conflicts)
    }

    func apply(tableName: String) async throws -> TableColumnDefinitionBackfillResponse {
        let proposed = try await preview(tableName: tableName)
        try await database.transaction { transaction in
            for item in proposed.items where item.status == "pending" {
                let row = try await TableColumnDefinition.query(on: transaction)
                    .filter(\.$hubID == self.hubID)
                    .filter(\.$tableName == tableName)
                    .filter(\.$columnName == item.columnName)
                    .first()
                guard row == nil else { continue }
                let model = try TableColumnDefinition(hubID: self.hubID, tableName: tableName, columnName: item.columnName, propertyType: item.propertyType, options: item.options)
                try await model.create(on: transaction)
            }
        }
        return try await preview(tableName: tableName)
    }
}
