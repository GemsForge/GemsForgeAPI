import Foundation

/// Shared canonical storage codec for semicolon-delimited multi-select TEXT.
enum MultiSelectValueCodec {
    static func decode(_ value: String) -> [String] {
        var seen = Set<String>()
        return value
            .split(separator: ";", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    static func encode(_ values: [String]) -> String {
        var seen = Set<String>()
        let normalized = values
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
        return normalized.joined(separator: ";")
    }

    static func normalize(_ values: [String], options: [TableColumnOption]) -> [String] {
        let selected = Set(decode(encode(values)))
        return options.map(\.value).filter { selected.contains($0.precomposedStringWithCanonicalMapping) }
    }

    static func matchesOption(value: String, option: String) -> Bool {
        let expected = option.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping
        return decode(value).contains {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping == expected
        }
    }
}

extension LiveSchemaColumnResponse {
    var hasTextAffinity: Bool {
        let type = dataType.uppercased()
        if type.contains("INT") { return false }
        if type.contains("CHAR") || type.contains("CLOB") || type.contains("TEXT") { return true }
        if type.isEmpty || type.contains("BLOB") { return false }
        if type.contains("REAL") || type.contains("FLOA") || type.contains("DOUB") { return false }
        return false
    }
}
