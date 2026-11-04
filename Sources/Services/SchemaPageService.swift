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

enum SchemaPageError: Error, CustomStringConvertible, Equatable {
    case unavailableDatabase
    case tableUnavailable

    var description: String {
        switch self {
        case .unavailableDatabase: return "Schema pages require the configured SQLite database."
        case .tableUnavailable: return "This table is not available as a Hub-owned schema page."
        }
    }
}

/// Reads only custom tables that have a stable ID and required text HubID.
struct SchemaPageService: Sendable {
    private let database: Database
    private let hubID: String

    init(database: Database, hubID: String) {
        self.database = database
        self.hubID = hubID
    }

    func listTables() async throws -> SchemaPageTablesResponse {
        let schema = try await LiveSchemaService(database: database).inspect()
        let registeredTables = Set(try await TableView.query(on: database)
            .filter(\.$hubID == hubID).all().map(\.tableName))
        let eligibleTables = schema.tables.filter(Self.isSchemaPageTable)
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
        return SchemaPageTableResponse(name: table.name, columns: table.columns)
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
        guard HubOwnedCustomTablePolicy.isEligible(table) else { return false }
        let primaryKeys = table.columns.filter(\.primaryKey)
        guard primaryKeys.count == 1,
              primaryKeys[0].name == "ID",
              let hubID = table.columns.first(where: { $0.name == "HubID" }),
              !hubID.nullable,
              !hubID.primaryKey
        else { return false }
        let type = hubID.dataType.uppercased()
        return type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB")
    }
}
