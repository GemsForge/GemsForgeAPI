import Foundation

/// Converts Notion-specific values into the existing Gem Life storage contract.
/// This mapper is pure so dry-run previews can report transformations without
/// requiring a database connection or exposing imported values in logs.
enum NotionImportValueMapper {
    struct DueDate: Equatable, Sendable {
        let day: Int
        let occurrence: String
    }

    /// Retains only the final four numeric characters. Values without digits
    /// are rejected rather than persisted as an ambiguous account reference.
    static func accountNumberLastFour(_ value: String) -> String? {
        let digits = value.filter(\.isNumber)
        guard !digits.isEmpty else { return nil }
        return String(digits.suffix(4))
    }

    /// Maps common human-readable Notion due-date labels to a day of month and
    /// occurrence label. `nil` means the input needs explicit review.
    static func dueDate(_ value: String) -> DueDate? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }

        if let ordinal = normalized.range(of: #"^(\d{1,2})(st|nd|rd|th)?$"#, options: .regularExpression),
           let day = Int(normalized[ordinal].prefix(while: \.isNumber)), (1...31).contains(day) {
            return DueDate(day: day, occurrence: "monthly")
        }

        let monthDate = try? NSRegularExpression(pattern: #"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(st|nd|rd|th)?$"#, options: [.caseInsensitive])
        if let match = monthDate?.firstMatch(in: normalized, range: NSRange(normalized.startIndex..., in: normalized)),
           let dayRange = Range(match.range(at: 2), in: normalized),
           let day = Int(normalized[dayRange]), (1...31).contains(day),
           let monthRange = Range(match.range(at: 1), in: normalized) {
            return DueDate(day: day, occurrence: String(normalized[monthRange]).lowercased())
        }

        let weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        let weekday = normalized.lowercased()
        guard weekdays.contains(weekday) else { return nil }
        return DueDate(day: 0, occurrence: weekday)
    }
}
