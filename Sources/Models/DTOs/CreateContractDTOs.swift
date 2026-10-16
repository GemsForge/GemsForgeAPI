import Vapor

/// A field-level validation problem returned by a create contract.
struct CreateFieldError: Content, Equatable, Sendable {
    let field: String
    let message: String
}

/// Standard envelope for future resource-specific create validation failures.
struct CreateValidationErrorResponse: Content, Sendable {
    let error: String
    let fields: [CreateFieldError]

    init(fields: [CreateFieldError]) {
        self.error = "Create request validation failed."
        self.fields = fields
    }
}

/// Shared validation helpers for POST contracts.
enum CreateContractValidation {
    static func rejectUnknownFields(in decoder: Decoder, allowed: Set<String>) throws {
        let container = try decoder.container(keyedBy: CreateContractCodingKey.self)
        guard let unknown = container.allKeys.first(where: { !allowed.contains($0.stringValue) }) else { return }
        throw DecodingError.dataCorruptedError(
            forKey: unknown,
            in: container,
            debugDescription: "Unknown create field: \(unknown.stringValue)."
        )
    }

    static func required(_ value: String?, field: String, label: String) -> CreateFieldError? {
        guard value?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false else {
            return nil
        }
        return CreateFieldError(field: field, message: "\(label) is required.")
    }

    static func immutable(_ field: String, label: String) -> CreateFieldError {
        CreateFieldError(field: field, message: "\(label) is managed by the server.")
    }
}

private struct CreateContractCodingKey: CodingKey, Hashable {
    let stringValue: String
    let intValue: Int? = nil
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}
