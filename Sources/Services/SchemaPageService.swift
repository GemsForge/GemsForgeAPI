import Fluent
import SQLKit
import Vapor

struct SchemaPageTableResponse: Content, Sendable {
    let name: String
    let columns: [LiveSchemaColumnResponse]
}

struct SchemaPageTablesResponse: Content, Sendable {
    let tables: [SchemaPageTableResponse]
    let availableTables: [SchemaPageTableResponse]
}

struct SchemaPageRecordsResponse: Content, Sendable {
    let table: SchemaPageTableResponse
    let rows: [[String: String?]]
    let totalCount: Int
    let limit: Int
    let offset: Int
}

struct SchemaPageRecordCreationResponse: Content, Sendable {
    let table: String
    let recordID: String
}

enum SchemaPageError: Error, CustomStringConvertible, Equatable {
    case unavailableDatabase
    case tableUnavailable
    case invalidRecord(String)

    var description: String {
        switch self {
        case .unavailableDatabase: return "Schema pages require the configured SQLite database."
        case .tableUnavailable: return "This table is not available as a Hub-owned schema page."
        case .invalidRecord(let message): return message
        }
    }
}

/// Reads Hub-scoped record tables with a stable primary key and text HubID.
struct SchemaPageService: Sendable {
    private let database: Database
    private let hubID: String

    init(database: Database, hubID: String) {
        self.database = database
        self.hubID = hubID
    }

    func listTables() async throws -> SchemaPageTablesResponse {
        let schema = try await LiveSchemaService(database: database).inspect()
        let eligibleTables = schema.tables.filter(Self.isSchemaPageTable)
        for table in eligibleTables where HubOwnedCustomTablePolicy.liveRecordTables.contains(table.name) {
            try await registerPageIfNeeded(tableName: table.name)
        }
        let registeredTables = Set(try await TableView.query(on: database)
            .filter(\.$hubID == hubID).all().map(\.tableName))
        return SchemaPageTablesResponse(
            tables: eligibleTables.filter { registeredTables.contains($0.name) }
                .map { SchemaPageTableResponse(name: $0.name, columns: $0.columns) },
            availableTables: eligibleTables.filter { !registeredTables.contains($0.name) }
                .map { SchemaPageTableResponse(name: $0.name, columns: $0.columns) }
        )
    }

    /// Registers an eligible live table as a navigable page. Repeated requests are safe.
    func createPage(tableName: String) async throws -> SchemaPageTableResponse {
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }), Self.isSchemaPageTable(table) else {
            throw SchemaPageError.tableUnavailable
        }
        try await registerPageIfNeeded(tableName: tableName)
        return SchemaPageTableResponse(name: table.name, columns: table.columns)
    }

    private func registerPageIfNeeded(tableName: String) async throws {
        let existing = try await TableView.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .first()
        if existing == nil {
            let hasDefault = try await TableView.query(on: database)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .filter(\.$isDefault == true)
                .first() != nil
            try await TableView(
                hubID: hubID,
                tableName: tableName,
                name: "Gallery",
                viewType: .gallery,
                isDefault: !hasDefault
            ).save(on: database)
        }
    }

    func records(tableName: String, limit requestedLimit: Int, offset requestedOffset: Int) async throws -> SchemaPageRecordsResponse {
        guard let sql = database as? SQLDatabase else { throw SchemaPageError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let schemaTable = schema.tables.first(where: { $0.name == tableName }),
              Self.isSchemaPageTable(schemaTable),
              let primaryKey = schemaTable.columns.first(where: \.primaryKey)
        else { throw SchemaPageError.tableUnavailable }

        let limit = min(max(requestedLimit, 1), 100)
        let offset = max(requestedOffset, 0)
        let countRow = try await sql.raw(SQLQueryString(
            "SELECT COUNT(*) AS total FROM \(ident: schemaTable.name) WHERE \(ident: "HubID") = \(bind: hubID)"
        )).first()
        let totalCount = try countRow?.decode(column: "total", as: Int.self) ?? 0

        var select = SQLQueryString("SELECT ")
        for (index, column) in schemaTable.columns.enumerated() {
            if index > 0 { select.appendInterpolation(unsafeRaw: ", ") }
            select.appendInterpolation(unsafeRaw: "CASE WHEN ")
            select.appendInterpolation(ident: column.name)
            select.appendInterpolation(unsafeRaw: " IS NULL THEN NULL WHEN typeof(")
            select.appendInterpolation(ident: column.name)
            select.appendInterpolation(unsafeRaw: ") = 'blob' THEN '[Binary data]' ELSE CAST(")
            select.appendInterpolation(ident: column.name)
            select.appendInterpolation(unsafeRaw: " AS TEXT) END AS ")
            select.appendInterpolation(ident: column.name)
        }
        select.appendInterpolation(unsafeRaw: " FROM ")
        select.appendInterpolation(ident: schemaTable.name)
        select.appendInterpolation(unsafeRaw: " WHERE ")
        select.appendInterpolation(ident: "HubID")
        select.appendInterpolation(unsafeRaw: " = ")
        select.appendInterpolation(bind: hubID)
        select.appendInterpolation(unsafeRaw: " ORDER BY ")
        select.appendInterpolation(ident: primaryKey.name)
        select.appendInterpolation(unsafeRaw: " LIMIT ")
        select.appendInterpolation(bind: limit)
        select.appendInterpolation(unsafeRaw: " OFFSET ")
        select.appendInterpolation(bind: offset)

        let rows = try await sql.raw(select).all().map { row in
            var values: [String: String?] = [:]
            for column in schemaTable.columns {
                values[column.name] = try row.decode(column: column.name, as: String?.self)
            }
            return values
        }
        return SchemaPageRecordsResponse(
            table: SchemaPageTableResponse(name: schemaTable.name, columns: schemaTable.columns),
            rows: rows,
            totalCount: totalCount,
            limit: limit,
            offset: offset
        )
    }

    /// Creates one row using the inspected table contract and assigns its Hub ownership on the server.
    func createRecord(tableName: String, values: [String: PatchJSONValue]) async throws -> SchemaPageRecordCreationResponse {
        guard let sql = database as? SQLDatabase else { throw SchemaPageError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }),
              Self.isSchemaPageTable(table),
              let primaryKey = table.columns.first(where: \.primaryKey)
        else { throw SchemaPageError.tableUnavailable }

        let protected = Set(["HubID"])
        let generatedPrimaryKey = !primaryKey.dataType.uppercased().contains("INT")
        let acceptedColumns = table.columns.filter { !protected.contains($0.name) }
        let knownNames = Set(acceptedColumns.map(\.name))
        let unknown = Set(values.keys).subtracting(knownNames)
        guard unknown.isEmpty else {
            throw SchemaPageError.invalidRecord("Unknown properties: \(unknown.sorted().joined(separator: ", ")).")
        }
        let generatedIntegerPrimaryKey = primaryKey.dataType.uppercased().contains("INT")
        if values.isEmpty && !generatedPrimaryKey && !generatedIntegerPrimaryKey {
            throw SchemaPageError.invalidRecord("At least one property is required.")
        }

        var insertValues = values
        if generatedPrimaryKey && insertValues[primaryKey.name] != nil {
            throw SchemaPageError.invalidRecord("\(primaryKey.name) is assigned by the server.")
        }
        if generatedPrimaryKey {
            insertValues[primaryKey.name] = .string(UUID().uuidString)
        }
        let allowedNames = Set(acceptedColumns.map(\.name))
        guard Set(insertValues.keys).isSubset(of: allowedNames) else {
            throw SchemaPageError.invalidRecord("The primary key could not be assigned.")
        }

        for column in acceptedColumns {
            if let value = insertValues[column.name] {
                try Self.validate(value, for: column)
            } else if column.primaryKey && column.dataType.uppercased().contains("INT") {
                continue // SQLite assigns integer primary keys.
            } else if !column.nullable && column.defaultValue == nil {
                throw SchemaPageError.invalidRecord("\(column.name) is required.")
            }
        }

        let suppliedColumns = acceptedColumns.filter { insertValues[$0.name] != nil }
        var query = SQLQueryString("INSERT INTO \(ident: table.name) (")
        for (index, column) in suppliedColumns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            query.appendInterpolation(ident: column.name)
        }
        if !suppliedColumns.isEmpty { query.appendInterpolation(unsafeRaw: ", ") }
        query.appendInterpolation(ident: "HubID")
        query.appendInterpolation(unsafeRaw: ") VALUES (")
        for (index, column) in suppliedColumns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            try Self.bind(insertValues[column.name]!, to: &query)
        }
        if !suppliedColumns.isEmpty { query.appendInterpolation(unsafeRaw: ", ") }
        query.appendInterpolation(bind: hubID)
        query.appendInterpolation(unsafeRaw: ")")
        try await sql.raw(query).run()

        let recordID: String
        if let value = insertValues[primaryKey.name] {
            recordID = try Self.stringValue(value)
        } else {
            guard let row = try await sql.raw("SELECT last_insert_rowid() AS id").first() else {
                throw SchemaPageError.invalidRecord("The created record ID could not be read.")
            }
            recordID = String(try row.decode(column: "id", as: Int64.self))
        }
        return SchemaPageRecordCreationResponse(table: table.name, recordID: recordID)
    }

    /// Confirms a record identifier belongs to this Hub before it is persisted as workspace selection.
    func containsRecord(_ recordID: String, in tableName: String) async throws -> Bool {
        guard let sql = database as? SQLDatabase else { throw SchemaPageError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        guard let table = schema.tables.first(where: { $0.name == tableName }),
              Self.isSchemaPageTable(table),
              let primaryKey = table.columns.first(where: \.primaryKey)
        else { return false }

        let query: SQLQueryString
        if primaryKey.dataType.uppercased().contains("INT") {
            guard let integerID = Int64(recordID) else { return false }
            query = SQLQueryString(
                "SELECT 1 AS \(ident: "present") FROM \(ident: table.name) WHERE \(ident: primaryKey.name) = \(bind: integerID) AND \(ident: "HubID") = \(bind: hubID) LIMIT 1"
            )
        } else {
            query = SQLQueryString(
                "SELECT 1 AS \(ident: "present") FROM \(ident: table.name) WHERE \(ident: primaryKey.name) = \(bind: recordID) AND \(ident: "HubID") = \(bind: hubID) LIMIT 1"
            )
        }
        return try await sql.raw(query).first() != nil
    }

    static func isSchemaPageTable(_ table: LiveSchemaTableResponse) -> Bool {
        guard !HubOwnedCustomTablePolicy.tablesWithDedicatedCollections.contains(table.name) else { return false }
        guard HubOwnedCustomTablePolicy.isEligible(table) else { return false }
        let primaryKeys = table.columns.filter(\.primaryKey)
        guard primaryKeys.count == 1,
              let hubID = table.columns.first(where: { $0.name == "HubID" }),
              !hubID.primaryKey
        else { return false }
        let type = hubID.dataType.uppercased()
        guard type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB") else { return false }
        return HubOwnedCustomTablePolicy.liveRecordTables.contains(table.name) || !hubID.nullable
    }

    private static func validate(_ value: PatchJSONValue, for column: LiveSchemaColumnResponse) throws {
        if case .null = value {
            guard column.nullable else { throw SchemaPageError.invalidRecord("\(column.name) cannot be empty.") }
            return
        }
        let type = column.dataType.uppercased()
        if type.contains("INT") {
            guard let text = try? stringValue(value), Int64(text) != nil else {
                throw SchemaPageError.invalidRecord("\(column.name) must be a valid \(column.dataType) value.")
            }
        } else if ["REAL", "FLOAT", "DOUBLE", "NUMERIC", "DECIMAL"].contains(where: type.contains) {
            guard let text = try? stringValue(value), Double(text) != nil else {
                throw SchemaPageError.invalidRecord("\(column.name) must be a valid \(column.dataType) value.")
            }
        } else if type.contains("BOOL") {
            guard let text = try? stringValue(value), ["0", "1", "true", "false"].contains(text.lowercased()) else {
                throw SchemaPageError.invalidRecord("\(column.name) must be a valid boolean value.")
            }
        } else if type.contains("BLOB") {
            throw SchemaPageError.invalidRecord("\(column.name) does not accept binary data through this endpoint.")
        } else if case .string(let text) = value, text.isEmpty, !column.nullable, column.defaultValue == nil {
            throw SchemaPageError.invalidRecord("\(column.name) is required.")
        }
    }

    private static func stringValue(_ value: PatchJSONValue) throws -> String {
        switch value {
        case .null: return ""
        case .string(let text): return text
        case .number(let number):
            if let integer = Int64(exactly: number) { return String(integer) }
            return String(number)
        case .bool(let bool): return bool ? "1" : "0"
        }
    }

    private static func bind(_ value: PatchJSONValue, to query: inout SQLQueryString) throws {
        switch value {
        case .null: query.appendInterpolation(bind: Optional<String>.none)
        case .string(let text): query.appendInterpolation(bind: text)
        case .number(let number): query.appendInterpolation(bind: number)
        case .bool(let bool): query.appendInterpolation(bind: bool ? 1 : 0)
        }
    }
}
