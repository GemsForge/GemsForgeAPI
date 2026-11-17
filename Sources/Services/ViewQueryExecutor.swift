import Fluent
import SQLKit
import Vapor

struct SchemaPageQueryNode: Content, Sendable {
    let id: String
    let parentQueryID: String?
    let nodeType: ViewQueryNodeType
    let columnName: String?
    let comparisonOperator: ViewQueryComparisonOperator?
    let valueType: ViewQueryValueType?
    let value: String?
    let booleanOperator: ViewQueryBooleanOperator?
    let direction: ViewQuerySortDirection?
    let sortOrder: Int

    func model(viewID: String) -> ViewQueryConfiguration {
        ViewQueryConfiguration(
            id: id,
            viewID: viewID,
            parentQueryID: parentQueryID,
            nodeType: nodeType,
            columnName: columnName,
            comparisonOperator: comparisonOperator,
            valueType: valueType,
            value: value,
            booleanOperator: booleanOperator,
            direction: direction,
            sortOrder: sortOrder
        )
    }
}

struct SchemaPageQueryRequest: Content, Sendable {
    let viewID: String?
    let nodes: [SchemaPageQueryNode]?
    let search: String?
    let limit: Int?
    let offset: Int?
}

struct SchemaPageQueryRecord: Content, Sendable, Equatable {
    let row: [String: String?]
    let groupKey: String?
}

struct SchemaPageQueryResponse: Content, Sendable, Equatable {
    let records: [SchemaPageQueryRecord]
    let total: Int
    let limit: Int
    let offset: Int
}

enum ViewQueryExecutorError: Error, CustomStringConvertible, Equatable {
    case unavailableDatabase
    case tableUnavailable
    case viewUnavailable
    case invalidRequest(String)
    case invalidQuery(String)
    case unsupportedRelationColumn(String)
    case queryLimitExceeded(String)

    var description: String {
        switch self {
        case .unavailableDatabase: return "Server-side view queries require the configured SQLite database."
        case .tableUnavailable: return "The table is not available to this Hub."
        case .viewUnavailable: return "The saved view is not available to this Hub or table."
        case .invalidRequest(let reason), .invalidQuery(let reason), .unsupportedRelationColumn(let reason),
             .queryLimitExceeded(let reason):
            return reason
        }
    }
}

/// Compiles validated query metadata to parameterized SQLite and pages a
/// Hub-owned table in one read transaction.
struct ViewQueryExecutor: Sendable {
    private let database: any Database
    private let hubID: String

    init(database: any Database, hubID: String) {
        self.database = database
        self.hubID = hubID
    }

    func execute(tableName: String, request: SchemaPageQueryRequest) async throws -> SchemaPageQueryResponse {
        guard request.viewID != nil || request.nodes != nil else {
            throw ViewQueryExecutorError.invalidRequest("Provide a saved viewID or an ad-hoc nodes array.")
        }
        guard request.viewID == nil || request.nodes == nil else {
            throw ViewQueryExecutorError.invalidRequest("Provide either viewID or nodes, not both.")
        }
        if let search = request.search, search.count > 200 {
            throw ViewQueryExecutorError.invalidRequest("search must contain no more than 200 characters.")
        }

        guard (request.limit ?? 50) >= 1, (request.limit ?? 50) <= 200,
              (request.offset ?? 0) >= 0 else {
            throw ViewQueryExecutorError.invalidRequest("limit must be 1–200 and offset must be non-negative.")
        }
        let limit = request.limit ?? 50
        let offset = request.offset ?? 0
        return try await database.transaction { transaction in
            try await self.executeInTransaction(
                tableName: tableName,
                request: request,
                limit: limit,
                offset: offset,
                on: transaction
            )
        }
    }

    private func executeInTransaction(
        tableName: String,
        request: SchemaPageQueryRequest,
        limit: Int,
        offset: Int,
        on database: any Database
    ) async throws -> SchemaPageQueryResponse {
        guard let sql = database as? SQLDatabase else { throw ViewQueryExecutorError.unavailableDatabase }
        let schema = try await LiveSchemaService(database: database).inspect()
        let table: LiveSchemaTableResponse
        do {
            table = try SQLiteSchemaReferenceValidator(schema: schema).validateTable(named: tableName)
        } catch {
            throw ViewQueryExecutorError.tableUnavailable
        }
        guard SchemaPageService.isSchemaPageTable(table),
              !HubOwnedCustomTablePolicy.liveRecordTables.contains(tableName),
              let primaryKey = table.columns.first(where: \.primaryKey)
        else { throw ViewQueryExecutorError.tableUnavailable }

        let viewID: String
        var nodes: [ViewQueryConfiguration]
        if let requestedViewID = request.viewID {
            guard let view = try await TableView.query(on: database)
                .filter(\.$id == requestedViewID)
                .filter(\.$hubID == hubID)
                .filter(\.$tableName == tableName)
                .first(),
                let viewIDValue = view.id
            else { throw ViewQueryExecutorError.viewUnavailable }
            viewID = viewIDValue
            nodes = try await ViewQueryConfiguration.query(on: database)
                .filter(\.$viewID == viewID)
                .all()
        } else {
            viewID = "ad-hoc-view-query"
            nodes = (request.nodes ?? []).map { $0.model(viewID: viewID) }
            if nodes.isEmpty {
                nodes = [
                    ViewQueryConfiguration(
                        id: "ad-hoc-filter-root",
                        viewID: viewID,
                        parentQueryID: nil,
                        nodeType: .group,
                        columnName: nil,
                        comparisonOperator: nil,
                        valueType: nil,
                        value: nil,
                        booleanOperator: .and,
                        direction: nil,
                        sortOrder: 0
                    ),
                ]
            }
        }

        let validator = ViewQueryConfigurationValidator(database: database, hubID: hubID)
        let validated: ViewQueryConfigurationValidationResult
        do {
            validated = try await validator.validate(
                nodes,
                viewID: viewID,
                tableName: tableName,
                context: TableViewReferenceContext(viewID: request.viewID ?? viewID)
            )
        } catch {
            throw ViewQueryExecutorError.invalidQuery(String(describing: error))
        }
        guard validated.nodes.filter({ $0.nodeType == .condition }).count <= 50 else {
            throw ViewQueryExecutorError.queryLimitExceeded("A query tree may contain no more than 50 conditions.")
        }

        let definitions = try await TablePropertyDefinition.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .all()
        let virtualColumns = Set(definitions.compactMap { definition -> String? in
            guard definition.kind == TablePropertyKind.relation.rawValue || definition.kind == TablePropertyKind.lookup.rawValue else {
                return nil
            }
            return definition.sourceColumnName
        })
        for node in validated.nodes where node.columnName.map(virtualColumns.contains) == true {
            throw ViewQueryExecutorError.unsupportedRelationColumn(
                "Filtering or sorting Relation and Lookup columns is not supported: \(node.columnName ?? "")."
            )
        }
        for node in validated.nodes where node.nodeType == .condition {
            if node.comparisonOperator == .in && node.operands.count > 100 {
                throw ViewQueryExecutorError.queryLimitExceeded("In supports no more than 100 values.")
            }
        }

        let referenceValidator = SQLiteSchemaReferenceValidator(schema: schema)
        let primaryKeyName = try referenceValidator.validateColumn(named: primaryKey.name, inTable: tableName).name
        let searchableColumns = table.columns.filter { column in
            let type = column.dataType.uppercased()
            let isText = type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB")
            return isText && column.name != "HubID"
        }
        let primaryColumnNames = Set(table.columns.filter(\.primaryKey).map(\.name))
        let multiSelectColumns = Set(try await TableColumnDefinition.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$tableName == tableName)
            .all()
            .filter { $0.propertyType == TableColumnPropertyType.multiSelect.rawValue }
            .map(\.columnName))
        for node in validated.nodes where node.nodeType == .condition || node.nodeType == .sort || node.nodeType == .recordGroup {
            guard let columnName = node.columnName else { continue }
            if primaryColumnNames.contains(columnName) || columnName == "HubID" {
                throw ViewQueryExecutorError.invalidQuery("Hub ownership and primary-key columns cannot be filtered, sorted, or grouped.")
            }
            if node.nodeType != .condition && multiSelectColumns.contains(columnName) {
                throw ViewQueryExecutorError.invalidQuery("MultiSelect columns cannot be sorted or grouped.")
            }
        }
        let groupNode = validated.nodes
            .filter { $0.nodeType == .recordGroup }
            .sorted { $0.sortOrder < $1.sortOrder }
            .first
        let sortNodes = validated.nodes
            .filter { $0.nodeType == .sort }
            .sorted { $0.sortOrder < $1.sortOrder }
        let byID = Dictionary(uniqueKeysWithValues: validated.nodes.map { ($0.id, $0) })
        let children = Dictionary(grouping: validated.nodes.filter { $0.parentQueryID != nil }) {
            $0.parentQueryID!
        }
        let filterNode = byID[validated.filterRootID]
        let groupDepth = maxFilterDepth(filterNode, children: children, byID: byID)
        guard groupDepth <= 4 else {
            throw ViewQueryExecutorError.queryLimitExceeded("A query tree may be nested no more than 4 group levels.")
        }

        var countQuery = SQLQueryString("SELECT COUNT(*) AS \(ident: "total") FROM \(ident: tableName) WHERE ")
        try appendWhere(
            to: &countQuery,
            tableName: tableName,
            hubID: hubID,
            primaryKey: primaryKeyName,
            tableNames: Set(schema.tables.map(\.name)),
            filterNode: filterNode,
            children: children,
            byID: byID,
            multiSelectColumns: multiSelectColumns,
            searchableColumns: searchableColumns,
            search: request.search
        )
        let countRow = try await sql.raw(countQuery).first()
        let total = try countRow?.decode(column: "total", as: Int.self) ?? 0

        var pageQuery = SQLQueryString("SELECT ")
        for (index, column) in table.columns.enumerated() {
            if index > 0 { pageQuery.appendInterpolation(unsafeRaw: ", ") }
            pageQuery.appendInterpolation(unsafeRaw: "CASE WHEN ")
            pageQuery.appendInterpolation(ident: column.name)
            pageQuery.appendInterpolation(unsafeRaw: " IS NULL THEN NULL WHEN typeof(")
            pageQuery.appendInterpolation(ident: column.name)
            pageQuery.appendInterpolation(unsafeRaw: ") = 'blob' THEN '[Binary data]' ELSE CAST(")
            pageQuery.appendInterpolation(ident: column.name)
            pageQuery.appendInterpolation(unsafeRaw: " AS TEXT) END AS ")
            pageQuery.appendInterpolation(ident: column.name)
        }
        if let groupNode, let groupColumn = groupNode.columnName {
            let safeColumn = try referenceValidator.validateColumn(named: groupColumn, inTable: tableName).name
            pageQuery.appendInterpolation(unsafeRaw: ", CASE WHEN ")
            pageQuery.appendInterpolation(ident: safeColumn)
            pageQuery.appendInterpolation(unsafeRaw: " IS NULL THEN NULL ELSE CAST(")
            pageQuery.appendInterpolation(ident: safeColumn)
            pageQuery.appendInterpolation(unsafeRaw: " AS TEXT) END AS \"groupKey\"")
        }
        pageQuery.appendInterpolation(unsafeRaw: " FROM ")
        pageQuery.appendInterpolation(ident: tableName)
        pageQuery.appendInterpolation(unsafeRaw: " WHERE ")
        try appendWhere(
            to: &pageQuery,
            tableName: tableName,
            hubID: hubID,
            primaryKey: primaryKeyName,
            tableNames: Set(schema.tables.map(\.name)),
            filterNode: filterNode,
            children: children,
            byID: byID,
            multiSelectColumns: multiSelectColumns,
            searchableColumns: searchableColumns,
            search: request.search
        )
        pageQuery.appendInterpolation(unsafeRaw: " ORDER BY ")
        var sortTerms = 0
        if let groupNode, let groupColumn = groupNode.columnName {
            try appendNullsLastSort(groupColumn, direction: .ascending, to: &pageQuery, validator: referenceValidator, tableName: tableName, termCount: &sortTerms)
        }
        for node in sortNodes {
            guard let columnName = node.columnName else { continue }
            let direction = node.direction ?? .ascending
            try appendNullsLastSort(columnName, direction: direction, to: &pageQuery, validator: referenceValidator, tableName: tableName, termCount: &sortTerms)
        }
        try appendNullsLastSort(primaryKeyName, direction: .ascending, to: &pageQuery, validator: referenceValidator, tableName: tableName, termCount: &sortTerms)
        pageQuery.appendInterpolation(unsafeRaw: " LIMIT ")
        pageQuery.appendInterpolation(bind: limit)
        pageQuery.appendInterpolation(unsafeRaw: " OFFSET ")
        pageQuery.appendInterpolation(bind: offset)

        let rows = try await sql.raw(pageQuery).all()
        let records = try rows.map { row -> SchemaPageQueryRecord in
            var values: [String: String?] = [:]
            for column in table.columns {
                values[column.name] = try row.decode(column: column.name, as: String?.self)
            }
            let key = groupNode == nil ? nil : try row.decode(column: "groupKey", as: String?.self)
            return SchemaPageQueryRecord(row: values, groupKey: key)
        }
        return SchemaPageQueryResponse(records: records, total: total, limit: limit, offset: offset)
    }

    private func appendWhere(
        to query: inout SQLQueryString,
        tableName: String,
        hubID: String,
        primaryKey: String,
        tableNames: Set<String>,
        filterNode: ViewQueryValidationNode?,
        children: [String: [ViewQueryValidationNode]],
        byID: [String: ViewQueryValidationNode],
        multiSelectColumns: Set<String>,
        searchableColumns: [LiveSchemaColumnResponse],
        search: String?
    ) throws {
        query.appendInterpolation(ident: "HubID")
        query.appendInterpolation(unsafeRaw: " = ")
        query.appendInterpolation(bind: hubID)

        if tableNames.contains(TrashEntry.schema) {
            query.appendInterpolation(unsafeRaw: " AND NOT EXISTS (SELECT 1 FROM ")
            query.appendInterpolation(ident: TrashEntry.schema)
            query.appendInterpolation(unsafeRaw: " AS \"trash\" WHERE \"trash\".\"HubID\" = ")
            query.appendInterpolation(bind: hubID)
            query.appendInterpolation(unsafeRaw: " AND \"trash\".\"TableName\" = ")
            query.appendInterpolation(bind: tableName)
            query.appendInterpolation(unsafeRaw: " AND CAST(\"trash\".\"RecordID\" AS TEXT) = CAST(")
            query.appendInterpolation(ident: primaryKey)
            query.appendInterpolation(unsafeRaw: " AS TEXT))")
        }

        if let filterNode, !(children[filterNode.id] ?? []).isEmpty {
            query.appendInterpolation(unsafeRaw: " AND (")
            try appendFilterExpression(
                filterNode,
                depth: 1,
                children: children,
                byID: byID,
                tableName: tableName,
                multiSelectColumns: multiSelectColumns,
                to: &query
            )
            query.appendInterpolation(unsafeRaw: ")")
        }

        let term = search?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !term.isEmpty, !searchableColumns.isEmpty {
            query.appendInterpolation(unsafeRaw: " AND (")
            let pattern = "%\(escapeLike(term))%"
            for (index, column) in searchableColumns.enumerated() {
                if index > 0 { query.appendInterpolation(unsafeRaw: " OR ") }
                query.appendInterpolation(ident: column.name)
                query.appendInterpolation(unsafeRaw: " LIKE ")
                query.appendInterpolation(bind: pattern)
                query.appendInterpolation(unsafeRaw: " ESCAPE '\\'")
            }
            query.appendInterpolation(unsafeRaw: ")")
        }
    }

    private func appendFilterExpression(
        _ node: ViewQueryValidationNode,
        depth: Int,
        children: [String: [ViewQueryValidationNode]],
        byID: [String: ViewQueryValidationNode],
        tableName: String,
        multiSelectColumns: Set<String>,
        to query: inout SQLQueryString
    ) throws {
        if node.nodeType == .condition {
            query.appendInterpolation(unsafeRaw: "(")
            try appendCondition(node, tableName: tableName, multiSelectColumns: multiSelectColumns, to: &query)
            query.appendInterpolation(unsafeRaw: ")")
            return
        }
        guard node.nodeType == .group else { throw ViewQueryExecutorError.invalidQuery("Only groups can contain filter nodes.") }
        guard depth <= 4 else {
            throw ViewQueryExecutorError.queryLimitExceeded("A query tree may be nested no more than 4 group levels.")
        }
        let orderedChildren = (children[node.id] ?? []).sorted { $0.sortOrder < $1.sortOrder }
        guard !orderedChildren.isEmpty else {
            query.appendInterpolation(unsafeRaw: "1 = 1")
            return
        }
        let joiner = node.booleanOperator == .or ? " OR " : " AND "
        query.appendInterpolation(unsafeRaw: "(")
        for (index, child) in orderedChildren.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: joiner) }
            guard let resolved = byID[child.id] else { throw ViewQueryExecutorError.invalidQuery("The filter tree contains an unknown child node.") }
            try appendFilterExpression(
                resolved,
                depth: depth + (resolved.nodeType == .group ? 1 : 0),
                children: children,
                byID: byID,
                tableName: tableName,
                multiSelectColumns: multiSelectColumns,
                to: &query
            )
        }
        query.appendInterpolation(unsafeRaw: ")")
    }

    private func appendCondition(
        _ node: ViewQueryValidationNode,
        tableName: String,
        multiSelectColumns: Set<String>,
        to query: inout SQLQueryString
    ) throws {
        guard let columnName = node.columnName,
              let operation = node.comparisonOperator else {
            throw ViewQueryExecutorError.invalidQuery("A condition is missing its column or operator.")
        }
        let multiSelect = multiSelectColumns.contains(columnName)
        if multiSelect {
            switch operation {
            case .equals, .contains:
                guard let operand = node.operands.first, case .text(let option) = operand else {
                    throw ViewQueryExecutorError.invalidQuery("MultiSelect conditions require a text option.")
                }
                appendMultiSelectMatch(columnName, option: option, negated: false, to: &query)
            case .notEquals:
                guard let operand = node.operands.first, case .text(let option) = operand else {
                    throw ViewQueryExecutorError.invalidQuery("MultiSelect conditions require a text option.")
                }
                appendMultiSelectMatch(columnName, option: option, negated: true, to: &query)
            case .in:
                query.appendInterpolation(unsafeRaw: "(")
                for (index, operand) in node.operands.enumerated() {
                    guard case .text(let option) = operand else {
                        throw ViewQueryExecutorError.invalidQuery("MultiSelect conditions require text options.")
                    }
                    if index > 0 { query.appendInterpolation(unsafeRaw: " OR ") }
                    appendMultiSelectMatch(columnName, option: option, negated: false, to: &query)
                }
                query.appendInterpolation(unsafeRaw: ")")
            case .isNull:
                query.appendInterpolation(unsafeRaw: "(")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NULL OR ")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " = '')")
            case .isNotNull:
                query.appendInterpolation(unsafeRaw: "(")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NOT NULL AND ")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " <> '')")
            default:
                throw ViewQueryExecutorError.invalidQuery("The operator is not supported for MultiSelect columns.")
            }
            return
        }

        switch operation {
        case .equals, .notEquals, .greaterThan, .greaterThanOrEqual, .lessThan, .lessThanOrEqual:
            query.appendInterpolation(ident: columnName)
            let op: String
            switch operation {
            case .equals: op = " = "
            case .notEquals: op = " <> "
            case .greaterThan: op = " > "
            case .greaterThanOrEqual: op = " >= "
            case .lessThan: op = " < "
            case .lessThanOrEqual: op = " <= "
            default: op = " = "
            }
            query.appendInterpolation(unsafeRaw: op)
            guard let operand = node.operands.first else { throw ViewQueryExecutorError.invalidQuery("A comparison operand is missing.") }
            try appendBoundValue(operand, to: &query)
        case .contains, .startsWith, .endsWith:
            query.appendInterpolation(ident: columnName)
            query.appendInterpolation(unsafeRaw: " LIKE ")
            guard let operand = node.operands.first, case .text(let text) = operand else {
                throw ViewQueryExecutorError.invalidQuery("Text matching operators require a text value.")
            }
            let escaped = escapeLike(text)
            let pattern = operation == .contains ? "%\(escaped)%" : operation == .startsWith ? "\(escaped)%" : "%\(escaped)"
            query.appendInterpolation(bind: pattern)
            query.appendInterpolation(unsafeRaw: " COLLATE NOCASE ESCAPE '\\'")
        case .between:
            guard node.operands.count == 2 else { throw ViewQueryExecutorError.invalidQuery("Between requires two operands.") }
            query.appendInterpolation(ident: columnName)
            query.appendInterpolation(unsafeRaw: " >= ")
            try appendBoundValue(node.operands[0], to: &query)
            query.appendInterpolation(unsafeRaw: " AND ")
            query.appendInterpolation(ident: columnName)
            query.appendInterpolation(unsafeRaw: " <= ")
            try appendBoundValue(node.operands[1], to: &query)
        case .in:
            guard !node.operands.isEmpty, node.operands.count <= 100 else {
                throw ViewQueryExecutorError.invalidQuery("In requires between 1 and 100 operands.")
            }
            query.appendInterpolation(ident: columnName)
            query.appendInterpolation(unsafeRaw: " IN (")
            for (index, operand) in node.operands.enumerated() {
                if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
                try appendBoundValue(operand, to: &query)
            }
            query.appendInterpolation(unsafeRaw: ")")
        case .isNull:
            if node.columnDataType.map(isTextColumnType) == true {
                query.appendInterpolation(unsafeRaw: "(")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NULL OR ")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " = '')")
            } else {
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NULL")
            }
        case .isNotNull:
            if node.columnDataType.map(isTextColumnType) == true {
                query.appendInterpolation(unsafeRaw: "(")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NOT NULL AND ")
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " <> '')")
            } else {
                query.appendInterpolation(ident: columnName)
                query.appendInterpolation(unsafeRaw: " IS NOT NULL")
            }
        }
    }

    private func appendMultiSelectMatch(
        _ columnName: String,
        option: String,
        negated: Bool,
        to query: inout SQLQueryString
    ) {
        if negated { query.appendInterpolation(unsafeRaw: "NOT (") }
        query.appendInterpolation(unsafeRaw: "(';' || ")
        query.appendInterpolation(ident: columnName)
        query.appendInterpolation(unsafeRaw: " || ';') LIKE ")
        query.appendInterpolation(bind: "%;\(escapeLike(option));%")
        query.appendInterpolation(unsafeRaw: " ESCAPE '\\'")
        if negated { query.appendInterpolation(unsafeRaw: ")") }
    }

    private func appendBoundValue(_ value: ViewQueryValue, to query: inout SQLQueryString) throws {
        switch value {
        case .text(let value), .date(let value), .dateTime(let value):
            query.appendInterpolation(bind: value)
        case .integer(let value):
            query.appendInterpolation(bind: value)
        case .decimal(let value):
            guard let decimal = Double(value), decimal.isFinite else {
                throw ViewQueryExecutorError.invalidQuery("A decimal query operand is invalid.")
            }
            query.appendInterpolation(bind: decimal)
        case .boolean(let value):
            query.appendInterpolation(bind: value)
        case .null:
            query.appendInterpolation(bind: Optional<String>.none)
        }
    }

    private func appendNullsLastSort(
        _ columnName: String,
        direction: ViewQuerySortDirection,
        to query: inout SQLQueryString,
        validator: SQLiteSchemaReferenceValidator,
        tableName: String,
        termCount: inout Int
    ) throws {
        let safeColumn = try validator.validateColumn(named: columnName, inTable: tableName).name
        if termCount > 0 { query.appendInterpolation(unsafeRaw: ", ") }
        query.appendInterpolation(unsafeRaw: "CASE WHEN ")
        query.appendInterpolation(ident: safeColumn)
        query.appendInterpolation(unsafeRaw: " IS NULL THEN 1 ELSE 0 END ASC, ")
        query.appendInterpolation(ident: safeColumn)
        query.appendInterpolation(unsafeRaw: direction == .ascending ? " ASC" : " DESC")
        termCount += 1
    }

    private func maxFilterDepth(
        _ node: ViewQueryValidationNode?,
        children: [String: [ViewQueryValidationNode]],
        byID: [String: ViewQueryValidationNode]
    ) -> Int {
        guard let node, node.nodeType == .group else { return 0 }
        let nested = (children[node.id] ?? []).compactMap { byID[$0.id] }
            .map { maxFilterDepth($0, children: children, byID: byID) }
            .max() ?? 0
        return 1 + nested
    }

    private func escapeLike(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
    }

    private func isTextColumnType(_ dataType: String) -> Bool {
        let type = dataType.uppercased()
        return type.contains("TEXT") || type.contains("CHAR") || type.contains("CLOB")
    }
}
