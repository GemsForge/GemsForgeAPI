import Vapor

/// Resolves a route identifier and record together, using the API's standard
/// not-found response when either the parameter or referenced record is absent.
func requireRouteRecord<Identifier, Record>(
    _ identifier: Identifier?,
    lookup: (Identifier) async throws -> Record?
) async throws -> (id: Identifier, record: Record) {
    guard let identifier, let record = try await lookup(identifier) else {
        throw Abort(.notFound)
    }
    return (identifier, record)
}
