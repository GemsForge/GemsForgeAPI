import Vapor

/// Registers the read-only catalog consumed by the schema-builder console.
func registerSchemaBuilderGuidanceRoutes(_ app: Application) {
    let service = SchemaBuilderGuidanceService()

    app.get("schema-builder", "metadata") { _ async throws -> SchemaBuilderGuidance in
        service.guidance()
    }
}
