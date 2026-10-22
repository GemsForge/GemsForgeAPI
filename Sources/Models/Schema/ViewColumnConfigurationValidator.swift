import Fluent

/// Validates saved View Column references against one captured live SQLite schema.
///
/// The validator deliberately returns the original models and never rewrites their
/// logical identifiers. A missing or renamed table/column is reported as stale so
/// an explicit, reviewed rename migration remains the only repair path.
struct ViewColumnConfigurationValidator: Sendable {
    private enum Source: Sendable {
        case schema(LiveSchemaResponse)
        case database(Database)
    }

    private let source: Source
    private let driftPolicy: TableViewSchemaDriftPolicy

    init(schema: LiveSchemaResponse, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.source = .schema(schema)
        self.driftPolicy = driftPolicy
    }

    init(database: Database, driftPolicy: TableViewSchemaDriftPolicy = .preserveAndReport) {
        self.source = .database(database)
        self.driftPolicy = driftPolicy
    }

    /// Validates every saved column reference for a View and preserves its rows.
    func validate(
        _ configurations: [ViewColumnConfiguration],
        viewID: String,
        tableName: String,
        viewName: String? = nil
    ) async throws -> [ViewColumnConfiguration] {
        let schema: LiveSchemaResponse
        switch source {
        case .schema(let schemaValue): schema = schemaValue
        case .database(let database): schema = try await LiveSchemaService(database: database).inspect()
        }
        return try validateAgainstSchema(
            configurations,
            schema: schema,
            viewID: viewID,
            tableName: tableName,
            viewName: viewName
        )
    }

    /// Validates against a captured schema for deterministic isolated tests.
    func validateAgainstSchema(
        _ configurations: [ViewColumnConfiguration],
        schema: LiveSchemaResponse,
        viewID: String,
        tableName: String,
        viewName: String? = nil
    ) throws -> [ViewColumnConfiguration] {
        let context = TableViewReferenceContext(viewID: viewID, viewName: viewName)
        let referenceValidator = SQLiteSchemaReferenceValidator(schema: schema, driftPolicy: driftPolicy)
        _ = try referenceValidator.validateTable(named: tableName, context: context)

        for configuration in configurations {
            guard configuration.viewID == viewID else { continue }
            _ = try referenceValidator.validateColumn(
                named: configuration.columnName,
                inTable: tableName,
                context: context
            )
        }
        return configurations
    }
}
