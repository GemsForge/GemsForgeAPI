import Fluent
import Foundation
import SQLKit

struct TableColumnDefinitionService: Sendable {
    let database: any Database
    let hubID: String

    func definitions(tableName: String) async throws -> [TableColumnDefinitionResponse] {
        let rows = try await TableColumnDefinition.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .all()
        return try rows.map(TableColumnDefinitionResponse.init(model:))
    }

    func definition(tableName: String, columnName: String, on database: (any Database)? = nil) async throws -> TableColumnDefinition? {
        try await TableColumnDefinition.query(on: database ?? self.database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .filter(\.$columnName == columnName)
            .first()
    }

    func save(tableName: String, columnName: String, input: TableColumnDefinitionRequest) async throws -> TableColumnDefinitionWriteResponse {
        guard database is SQLDatabase else { throw TableColumnDefinitionError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        let referenceValidator = SQLiteSchemaReferenceValidator(schema: schema)
        let column: LiveSchemaColumnResponse
        let table: LiveSchemaTableResponse
        do {
            column = try referenceValidator.validateColumn(named: columnName, inTable: tableName)
            table = try referenceValidator.validateTable(named: tableName)
        } catch let error as SQLiteSchemaReferenceValidationError {
            throw TableColumnDefinitionError.invalidColumn(error.description)
        }
        guard column.hasTextAffinity else {
            throw TableColumnDefinitionError.invalidColumn("Column \"\(columnName)\" in table \"\(tableName)\" must have TEXT affinity.")
        }
        let normalizedOptions = try Self.validateOptions(input.options)
        let renames = try Self.validateRenames(input.renames ?? [], existing: try await definition(tableName: tableName, columnName: columnName)?.options() ?? [], updated: normalizedOptions)

        let rowsChanged = try await database.transaction { transaction -> Int in
            guard let transactionSQL = transaction as? SQLDatabase else {
                throw TableColumnDefinitionError.unavailableDatabase
            }
            let existing = try await self.definition(tableName: tableName, columnName: columnName, on: transaction)
            let model: TableColumnDefinition
            if let existing {
                model = existing
                model.propertyType = input.propertyType.rawValue
                model.optionsJSON = try Self.encodeOptions(normalizedOptions)
            } else {
                model = try TableColumnDefinition(
                    hubID: self.hubID,
                    tableName: tableName,
                    columnName: columnName,
                    propertyType: input.propertyType,
                    options: normalizedOptions
                )
            }
            if existing == nil { try await model.create(on: transaction) }
            else { try await model.update(on: transaction) }

            guard !renames.isEmpty else { return 0 }
            guard table.columns.contains(where: { $0.name == "HubID" }),
                  let primaryKey = table.columns.first(where: \.primaryKey) else {
                throw TableColumnDefinitionError.invalidColumn("Table \"\(tableName)\" must have a HubID column and a primary key to rename stored options.")
            }
            let select = SQLQueryString("SELECT \(ident: primaryKey.name) AS \(ident: "recordID"), \(ident: columnName) AS \(ident: "value") FROM \(ident: tableName) WHERE \(ident: "HubID") = \(bind: self.hubID)")
            let records = try await transactionSQL.raw(select).all()
            var changed = 0
            let renameMap = Dictionary(uniqueKeysWithValues: renames.map { ($0.from.precomposedStringWithCanonicalMapping, $0.to.precomposedStringWithCanonicalMapping) })
            let integerKey = primaryKey.dataType.uppercased().contains("INT")
            for record in records {
                let rawValue = try record.decode(column: "value", as: String?.self) ?? ""
                let tokens = MultiSelectValueCodec.decode(rawValue).map { renameMap[$0] ?? $0 }
                let rewritten = MultiSelectValueCodec.encode(tokens)
                guard rewritten != rawValue else { continue }
                let recordID = try record.decode(column: "recordID", as: String.self)
                var update = SQLQueryString("UPDATE \(ident: tableName) SET \(ident: columnName) = \(bind: rewritten) WHERE ")
                update.appendInterpolation(ident: "HubID")
                update.appendInterpolation(unsafeRaw: " = ")
                update.appendInterpolation(bind: self.hubID)
                update.appendInterpolation(unsafeRaw: " AND ")
                update.appendInterpolation(ident: primaryKey.name)
                update.appendInterpolation(unsafeRaw: " = ")
                if integerKey {
                    guard let value = Int64(recordID) else { throw TableColumnDefinitionError.invalidColumn("The table primary key could not be read as an integer.") }
                    update.appendInterpolation(bind: value)
                } else { update.appendInterpolation(bind: recordID) }
                try await transactionSQL.raw(update).run()
                changed += 1
            }
            return changed
        }
        guard let saved = try await definition(tableName: tableName, columnName: columnName) else {
            throw TableColumnDefinitionError.invalidStoredDefinition
        }
        return TableColumnDefinitionWriteResponse(definition: try TableColumnDefinitionResponse(model: saved), rowsChanged: rowsChanged)
    }

    func delete(tableName: String, columnName: String) async throws {
        guard let row = try await definition(tableName: tableName, columnName: columnName) else { return }
        try await row.delete(on: database)
    }

    static func validateOptions(_ options: [TableColumnOption]) throws -> [TableColumnOption] {
        var seen = Set<String>()
        return try options.map { option in
            let value = option.value.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping
            guard !value.isEmpty else { throw TableColumnDefinitionError.invalidOption("Option values cannot be empty.") }
            guard value.count <= 100 else { throw TableColumnDefinitionError.invalidOption("Option \"\(value)\" exceeds the 100-character limit.") }
            guard !value.contains(";") else { throw TableColumnDefinitionError.invalidOption("Option \"\(value)\" cannot contain a semicolon (;) because it separates stored tags.") }
            let key = value.folding(options: [.caseInsensitive], locale: Locale(identifier: "en_US_POSIX")).precomposedStringWithCanonicalMapping
            guard seen.insert(key).inserted else { throw TableColumnDefinitionError.invalidOption("Option values must be unique, ignoring case and Unicode normalization.") }
            return TableColumnOption(value: value, color: option.color)
        }
    }

    static func encodeOptions(_ options: [TableColumnOption]) throws -> String {
        String(decoding: try JSONEncoder().encode(options), as: UTF8.self)
    }

    private static func validateRenames(
        _ renames: [TableColumnOptionRename],
        existing: [TableColumnOption],
        updated: [TableColumnOption]
    ) throws -> [TableColumnOptionRename] {
        let oldValues = Set(existing.map { $0.value.precomposedStringWithCanonicalMapping })
        let newValues = Set(updated.map { $0.value.precomposedStringWithCanonicalMapping })
        var sources = Set<String>()
        return try renames.map { rename in
            let from = rename.from.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping
            let to = rename.to.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping
            guard oldValues.contains(from), newValues.contains(to), sources.insert(from).inserted else {
                throw TableColumnDefinitionError.invalidOption("Each rename must use an existing source option, a listed destination option, and a unique source.")
            }
            return TableColumnOptionRename(from: from, to: to)
        }
    }
}
