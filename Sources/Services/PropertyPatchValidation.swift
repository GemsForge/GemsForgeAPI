import Vapor

/// Shared guardrails for property-level PATCH payloads.
enum PropertyPatchValidation {
    static func requireNonEmpty(_ payload: [String: String?]) throws {
        guard !payload.isEmpty else {
            throw Abort(.unprocessableEntity, reason: "At least one property is required.")
        }
    }

    static func requireKnownProperties(
        _ payload: [String: String?],
        allowed: Set<String>
    ) throws {
        let unknown = Set(payload.keys).subtracting(allowed)
        guard unknown.isEmpty else {
            throw Abort(
                .unprocessableEntity,
                reason: "Unknown properties: \(unknown.sorted().joined(separator: ", "))."
            )
        }
    }

    static func value(
        _ key: String,
        in payload: [String: String?],
        current: String?
    ) -> String? {
        payload.keys.contains(key) ? payload[key]! : current
    }
}
