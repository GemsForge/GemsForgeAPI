import Foundation
import Fluent
import SQLKit

/// Validates and reads Hub-scoped table-level relations and computed lookups.
struct TablePropertyService: Sendable {
    private let database: any Database
    private let hubID: String

    init(database: any Database, hubID: String) {
        self.database = database
        self.hubID = hubID
    }

    func definitions(tableName: String) async throws -> [TablePropertyDefinitionResponse] {
        try await requireRegisteredTable(tableName)
        let rows = try await TablePropertyDefinition.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .sort(\.$sortOrder)
            .all()
        return try rows.map(TablePropertyDefinitionResponse.init(model:))
    }

    /// Replaces definitions atomically after validating every source, target, and dependency.
    func replace(tableName: String, definitions input: [TablePropertyDefinitionRequest]) async throws -> [TablePropertyDefinitionResponse] {
        try await requireRegisteredTable(tableName)
        guard input.count <= 100 else {
            throw TablePropertyServiceError.invalidDefinition("A table can have at most 100 relation and lookup properties.")
        }
        let names = input.map { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        guard names.allSatisfy({ !$0.isEmpty && $0.count <= 100 }), Set(names).count == names.count else {
            throw TablePropertyServiceError.invalidDefinition("Property names must be non-empty, unique, and at most 100 characters.")
        }
        let ids = input.map { $0.id ?? "" }.filter { !$0.isEmpty }
        guard Set(ids).count == ids.count else {
            throw TablePropertyServiceError.invalidDefinition("Property definition IDs must be unique.")
        }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let sourceTable = schema.tables.first(where: { $0.name == tableName }),
              Self.columnsByName(sourceTable)["HubID"] != nil
        else { throw TablePropertyServiceError.tableUnavailable }

        var resolvedIDs: [String] = []
        for definition in input {
            guard !definition.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw TablePropertyServiceError.invalidDefinition("Property names cannot be empty.")
            }
            let id = definition.id?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? definition.id! : UUID().uuidString
            resolvedIDs.append(id)

            switch definition.kind {
            case .relation:
                guard let sourceColumnName = definition.sourceColumnName,
                      let targetTableName = definition.targetTableName,
                      let targetKeyColumnName = definition.targetKeyColumnName,
                      let targetDisplayColumnName = definition.targetDisplayColumnName,
                      definition.relationDefinitionID == nil,
                      let sourceColumn = Self.columnsByName(sourceTable)[sourceColumnName],
                      let target = schema.tables.first(where: { $0.name == targetTableName }),
                      SchemaPageService.isSchemaPageTable(target),
                      let targetKey = Self.columnsByName(target)[targetKeyColumnName], targetKey.primaryKey,
                      let targetDisplay = Self.columnsByName(target)[targetDisplayColumnName],
                      let targetHub = Self.columnsByName(target)["HubID"], !targetHub.primaryKey,
                      Self.compatible(sourceColumn.dataType, targetKey.dataType)
                else { throw TablePropertyServiceError.invalidDefinition("Relation \(definition.name) must use an existing source column and a Hub-owned target primary key/display column of a compatible type.") }
                guard try await TableView.query(on: database).filter(\.$hubID == hubID)
                    .filter(\.$tableName == targetTableName).first() != nil
                else { throw TablePropertyServiceError.invalidDefinition("Relation target \(targetTableName) must have a page registered in this Hub.") }
                guard !targetDisplay.dataType.uppercased().contains("BLOB")
                else { throw TablePropertyServiceError.invalidDefinition("Relation display columns must contain readable scalar values.") }

                if let filterID = definition.filterByDefinitionID {
                    guard let filterRelation = input.first(where: { $0.id == filterID && $0.kind == .relation }),
                          let filterTargetTableName = filterRelation.targetTableName,
                          let filterTargetKeyColumnName = filterRelation.targetKeyColumnName,
                          let filterColumnName = definition.targetFilterColumnName,
                          let filterColumn = Self.columnsByName(target)[filterColumnName],
                          let filterTarget = schema.tables.first(where: { $0.name == filterTargetTableName }),
                          let filterTargetKey = Self.columnsByName(filterTarget)[filterTargetKeyColumnName],
                          Self.compatible(filterColumn.dataType, filterTargetKey.dataType),
                          target.foreignKeys.contains(where: {
                              $0.column == filterColumnName &&
                                  $0.referencedTable == filterTargetTableName &&
                                  $0.referencedColumn == filterTargetKeyColumnName
                          })
                    else { throw TablePropertyServiceError.invalidDefinition("Relation filter references an invalid relation or target column.") }
                } else if definition.targetFilterColumnName != nil {
                    throw TablePropertyServiceError.invalidDefinition("A target filter column requires filterByDefinitionID.")
                }
            case .lookup:
                guard definition.sourceColumnName == nil,
                      let relationID = definition.relationDefinitionID,
                      let relation = input.first(where: { $0.id == relationID && $0.kind == .relation }),
                      let target = schema.tables.first(where: { $0.name == relation.targetTableName }),
                      SchemaPageService.isSchemaPageTable(target),
                      let targetColumnName = definition.targetColumnName,
                      let targetColumn = Self.columnsByName(target)[targetColumnName],
                      !targetColumn.dataType.uppercased().contains("BLOB"),
                      definition.targetTableName == nil,
                      definition.targetKeyColumnName == nil,
                      definition.targetDisplayColumnName == nil
                else { throw TablePropertyServiceError.invalidDefinition("Lookup \(definition.name) must reference a relation in this table and a column on its target table.") }
            }
        }
        let validatedIDs = resolvedIDs

        let saved = try await database.transaction { transaction in
            try await TablePropertyDefinition.query(on: transaction)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .delete()
            var models: [TablePropertyDefinition] = []
            for (index, definition) in input.enumerated() {
                let model = TablePropertyDefinition(hubID: hubID, tableName: tableName,
                    definition: definition, id: validatedIDs[index], sortOrder: index)
                try await model.save(on: transaction)
                models.append(model)
            }
            return models
        }
        return try saved.map(TablePropertyDefinitionResponse.init(model:))
    }

    func options(tableName: String, definitionID: String, recordID: String?, search: String?, limit: Int) async throws -> [RelatedRecordOption] {
        guard let sql = database as? SQLDatabase else { throw TablePropertyServiceError.unavailableDatabase }
        let definitions = try await models(tableName: tableName)
        guard let definition = definitions.first(where: { $0.id == definitionID && $0.kind == TablePropertyKind.relation.rawValue }),
              let targetName = definition.targetTableName,
              let keyName = definition.targetKeyColumnName,
              let displayName = definition.targetDisplayColumnName
        else { throw TablePropertyServiceError.invalidDefinition("The relation property is unavailable.") }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let target = schema.tables.first(where: { $0.name == targetName }),
              SchemaPageService.isSchemaPageTable(target),
              Self.columnsByName(target)[keyName] != nil,
              Self.columnsByName(target)[displayName] != nil,
              Self.columnsByName(target)["HubID"] != nil
        else { throw TablePropertyServiceError.tableUnavailable }

        var query = SQLQueryString("SELECT CAST(\(ident: keyName) AS TEXT) AS \(ident: "recordID"), CAST(\(ident: displayName) AS TEXT) AS \(ident: "displayValue") FROM \(ident: targetName) WHERE \(ident: "HubID") = \(bind: hubID)")
        if let filterID = definition.filterByDefinitionID {
            guard let filterColumn = definition.targetFilterColumnName,
                  let filterRelation = definitions.first(where: { $0.id == filterID && $0.kind == TablePropertyKind.relation.rawValue }),
                  let sourceColumn = filterRelation.sourceColumnName,
                  let targetFilterColumn = Self.columnsByName(target)[filterColumn]
            else {
                throw TablePropertyServiceError.invalidDefinition("The relation filter references a missing live column or relation.")
            }
            guard let recordID,
                  let sourceValue = try await sourceValue(table: tableName, recordID: recordID, column: sourceColumn)
            else { return [] }
            query.appendInterpolation(unsafeRaw: " AND ")
            query.appendInterpolation(ident: filterColumn)
            query.appendInterpolation(unsafeRaw: " = ")
            Self.appendTyped(sourceValue, column: targetFilterColumn, to: &query)
        } else if definition.targetFilterColumnName != nil {
            throw TablePropertyServiceError.invalidDefinition("A relation filter column requires filterByDefinitionID.")
        }
        if let search = search?.trimmingCharacters(in: .whitespacesAndNewlines), !search.isEmpty {
            query.appendInterpolation(unsafeRaw: " AND CAST(")
            query.appendInterpolation(ident: displayName)
            query.appendInterpolation(unsafeRaw: " AS TEXT) LIKE ")
            query.appendInterpolation(bind: "%\(search)%")
        }
        query.appendInterpolation(unsafeRaw: " ORDER BY ")
        query.appendInterpolation(ident: displayName)
        query.appendInterpolation(unsafeRaw: " LIMIT ")
        query.appendInterpolation(bind: min(max(limit, 1), 100))
        let rows = try await sql.raw(query).all()
        return try rows.map { row in
            RelatedRecordOption(id: try row.decode(column: "recordID", as: String.self),
                                name: try row.decode(column: "displayValue", as: String?.self) ?? "")
        }
    }

    func values(tableName: String, recordID: String) async throws -> [TablePropertyValue] {
        let definitions = try await models(tableName: tableName)
        let source = try await sourceRow(tableName: tableName, recordID: recordID)
        var values: [TablePropertyValue] = []
        for definition in definitions {
            guard let id = definition.id,
                  let kind = TablePropertyKind(rawValue: definition.kind)
            else { throw TablePropertyServiceError.invalidDefinition("Stored property definition is invalid.") }
            if kind == .relation {
                guard let sourceColumn = definition.sourceColumnName,
                      let targetTable = definition.targetTableName,
                      let targetKey = definition.targetKeyColumnName,
                      let displayColumn = definition.targetDisplayColumnName,
                      let foreignID = source[sourceColumn],
                      let targetFilter = relationFilter(definition, definitions: definitions, source: source),
                      let target = try await targetValue(tableName: targetTable, keyColumn: targetKey,
                          recordID: foreignID, valueColumn: displayColumn,
                          filterColumn: targetFilter.column, filterValue: targetFilter.value)
                else {
                    values.append(TablePropertyValue(definitionID: id, recordID: definition.sourceColumnName.flatMap { source[$0] }, displayValue: nil, value: nil))
                    continue
                }
                values.append(TablePropertyValue(definitionID: id, recordID: foreignID, displayValue: target, value: target))
            } else {
                guard let relationID = definition.relationDefinitionID,
                      let relation = definitions.first(where: { $0.id == relationID && $0.kind == TablePropertyKind.relation.rawValue }),
                      let sourceColumn = relation.sourceColumnName,
                      let targetTable = relation.targetTableName,
                      let targetKey = relation.targetKeyColumnName,
                      let targetColumn = definition.targetColumnName,
                      let foreignID = source[sourceColumn],
                      let targetFilter = relationFilter(relation, definitions: definitions, source: source),
                      let value = try await targetValue(tableName: targetTable, keyColumn: targetKey,
                          recordID: foreignID, valueColumn: targetColumn,
                          filterColumn: targetFilter.column, filterValue: targetFilter.value)
                else {
                    values.append(TablePropertyValue(definitionID: id, recordID: nil, displayValue: nil, value: nil))
                    continue
                }
                values.append(TablePropertyValue(definitionID: id, recordID: foreignID, displayValue: value, value: value))
            }
        }
        return values
    }

    /// Ensures edited relation columns still point to records visible in this Hub.
    func validateRelationUpdates(tableName: String, recordID: String, values: [String: PatchJSONValue]) async throws {
        let definitions = try await models(tableName: tableName)
        let relations = definitions.filter { $0.kind == TablePropertyKind.relation.rawValue }
        let changedColumns = Set(values.keys)
        guard relations.contains(where: { definition in
            definition.sourceColumnName.map(changedColumns.contains) ?? false
        }) else { return }

        var source = try await sourceRow(tableName: tableName, recordID: recordID)
        for definition in relations {
            guard let column = definition.sourceColumnName, let value = values[column] else { continue }
            switch value {
            case .null:
                source.removeValue(forKey: column)
            case let .string(value):
                source[column] = value
            case let .number(value):
                source[column] = String(value)
            case let .bool(value):
                source[column] = value ? "1" : "0"
            }
        }

        let affected = relations.filter { relation in
            guard let sourceColumn = relation.sourceColumnName else { return false }
            if changedColumns.contains(sourceColumn) { return true }
            guard let filterID = relation.filterByDefinitionID,
                  let parent = relations.first(where: { $0.id == filterID }),
                  let parentColumn = parent.sourceColumnName
            else { return false }
            return changedColumns.contains(parentColumn)
        }
        for relation in affected {
            guard let sourceColumn = relation.sourceColumnName,
                  let targetTable = relation.targetTableName,
                  let targetKey = relation.targetKeyColumnName
            else { continue }
            guard let foreignID = source[sourceColumn], !foreignID.isEmpty else { continue }

            guard let targetFilter = relationFilter(relation, definitions: definitions, source: source),
                  try await targetValue(
                    tableName: targetTable,
                    keyColumn: targetKey,
                    recordID: foreignID,
                    valueColumn: targetKey,
                    filterColumn: targetFilter.column,
                    filterValue: targetFilter.value
                  ) != nil
            else {
                throw SchemaPageError.invalidRecord("\(relation.name) must reference a record in this Hub and satisfy its configured relation filter.")
            }
        }
    }

    private func models(tableName: String) async throws -> [TablePropertyDefinition] {
        try await requireRegisteredTable(tableName)
        return try await TablePropertyDefinition.query(on: database)
            .filter(\.$hubID == hubID).filter(\.$tableName == tableName).sort(\.$sortOrder).all()
    }

    private func requireRegisteredTable(_ tableName: String) async throws {
        if try await TableView.query(on: database).filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName).first() != nil {
            return
        }

        // Transactions is a purpose-built Hub-owned collection, not a schema page.
        // It still needs relation/lookup properties, so validate its live Hub key
        // instead of requiring a TableView registration that the schema-page flow
        // intentionally does not create for dedicated collections.
        guard HubOwnedCustomTablePolicy.tablesWithDedicatedCollections.contains(tableName) else {
            throw TablePropertyServiceError.tableUnavailable
        }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }),
              table.columns.contains(where: { $0.name == "HubID" })
        else { throw TablePropertyServiceError.tableUnavailable }
    }

    private func sourceRow(tableName: String, recordID: String) async throws -> [String: String] {
        guard let sql = database as? SQLDatabase else { throw TablePropertyServiceError.unavailableDatabase }
        try await requireRegisteredTable(tableName)
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }),
              let key = table.columns.first(where: \.primaryKey),
              Self.columnsByName(table)["HubID"] != nil
        else { throw TablePropertyServiceError.tableUnavailable }
        var query = SQLQueryString("SELECT ")
        for (index, column) in table.columns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            query.appendInterpolation(unsafeRaw: "CAST(")
            query.appendInterpolation(ident: column.name)
            query.appendInterpolation(unsafeRaw: " AS TEXT) AS ")
            query.appendInterpolation(ident: column.name)
        }
        query.appendInterpolation(unsafeRaw: " FROM ")
        query.appendInterpolation(ident: tableName)
        query.appendInterpolation(unsafeRaw: " WHERE ")
        query.appendInterpolation(ident: key.name)
        query.appendInterpolation(unsafeRaw: " = ")
        Self.appendTyped(recordID, column: key, to: &query)
        query.appendInterpolation(unsafeRaw: " AND ")
        query.appendInterpolation(ident: "HubID")
        query.appendInterpolation(unsafeRaw: " = ")
        query.appendInterpolation(bind: hubID)
        guard let row = try await sql.raw(query).first() else { throw TablePropertyServiceError.recordUnavailable }
        var result: [String: String] = [:]
        for column in table.columns {
            if let value = try row.decode(column: column.name, as: String?.self) { result[column.name] = value }
        }
        return result
    }

    private func sourceValue(table: String, recordID: String, column: String) async throws -> String? {
        let row = try await sourceRow(tableName: table, recordID: recordID)
        return row[column]
    }

    private func targetValue(
        tableName: String,
        keyColumn: String,
        recordID: String,
        valueColumn: String,
        filterColumn: String?,
        filterValue: String?
    ) async throws -> String? {
        guard let sql = database as? SQLDatabase else { throw TablePropertyServiceError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }),
              SchemaPageService.isSchemaPageTable(table),
              let key = Self.columnsByName(table)[keyColumn],
              Self.columnsByName(table)[valueColumn] != nil,
              Self.columnsByName(table)["HubID"] != nil
        else { throw TablePropertyServiceError.tableUnavailable }
        var query = SQLQueryString("SELECT CAST(\(ident: valueColumn) AS TEXT) AS value FROM \(ident: tableName) WHERE \(ident: keyColumn) = ")
        Self.appendTyped(recordID, column: key, to: &query)
        query.appendInterpolation(unsafeRaw: " AND \"HubID\" = ")
        query.appendInterpolation(bind: hubID)
        if let filterColumn, let filterValue,
           let filterSchemaColumn = Self.columnsByName(table)[filterColumn] {
            query.appendInterpolation(unsafeRaw: " AND ")
            query.appendInterpolation(ident: filterColumn)
            query.appendInterpolation(unsafeRaw: " = ")
            Self.appendTyped(filterValue, column: filterSchemaColumn, to: &query)
        } else if filterColumn != nil {
            return nil
        }
        guard let row = try await sql.raw(query).first() else { return nil }
        return try row.decode(column: "value", as: String?.self)
    }

    private func relationFilter(
        _ relation: TablePropertyDefinition,
        definitions: [TablePropertyDefinition],
        source: [String: String]
    ) -> (column: String?, value: String?)? {
        guard let filterID = relation.filterByDefinitionID else { return (nil, nil) }
        guard let filterRelation = definitions.first(where: { $0.id == filterID }),
              let sourceColumn = filterRelation.sourceColumnName,
              let filterColumn = relation.targetFilterColumnName,
              let filterValue = source[sourceColumn]
        else { return nil }
        return (filterColumn, filterValue)
    }

    private static func columnsByName(_ table: LiveSchemaTableResponse) -> [String: LiveSchemaColumnResponse] {
        Dictionary(uniqueKeysWithValues: table.columns.map { ($0.name, $0) })
    }

    private static func compatible(_ first: String, _ second: String) -> Bool {
        func family(_ type: String) -> String {
            let value = type.uppercased()
            if value.contains("INT") { return "integer" }
            if ["REAL", "FLOA", "DOUB", "NUM", "DEC"].contains(where: value.contains) { return "number" }
            return "text"
        }
        return family(first) == family(second)
    }

    private static func appendTyped(_ value: String, column: LiveSchemaColumnResponse?, to query: inout SQLQueryString) {
        if column?.dataType.uppercased().contains("INT") == true, let number = Int64(value) {
            query.appendInterpolation(bind: number)
        } else {
            query.appendInterpolation(bind: value)
        }
    }
}
