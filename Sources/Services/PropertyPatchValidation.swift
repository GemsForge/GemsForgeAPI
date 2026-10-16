import Foundation
import Vapor

/// Shared guardrails for property-level PATCH payloads.
enum PropertyPatchValidation {
    static func requireKnownJSONProperties(
        _ request: Request,
        allowed: Set<String>,
        requireNonEmpty: Bool = false,
        emptyReason: String = "At least one property is required."
    ) throws {
        guard let body = request.body.data,
              let json = body.getString(at: body.readerIndex, length: body.readableBytes),
              let object = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
        else {
            throw Abort(.unprocessableEntity, reason: "PATCH body must be a JSON object.")
        }
        if requireNonEmpty, object.isEmpty {
            throw Abort(.unprocessableEntity, reason: emptyReason)
        }
        let unknown = Set(object.keys).subtracting(allowed)
        guard unknown.isEmpty else {
            throw Abort(.unprocessableEntity, reason: "Unknown properties: \(unknown.sorted().joined(separator: ", ")).")
        }
    }

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
        guard payload.keys.contains(key) else { return current }
        return payload[key] ?? nil
    }
}
