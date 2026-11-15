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
           let day = Int(normalized[ordinal].prefix(while: \.isNumber)), (1...31).contains(day),
           hasValidOrdinalSuffix(String(normalized[ordinal].drop(while: \.isNumber)), day: day) {
            return DueDate(day: day, occurrence: "monthly")
        }

        let monthDate = try? NSRegularExpression(pattern: #"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(st|nd|rd|th)?$"#, options: [.caseInsensitive])
        if let match = monthDate?.firstMatch(in: normalized, range: NSRange(normalized.startIndex..., in: normalized)),
           let dayRange = Range(match.range(at: 2), in: normalized),
           let day = Int(normalized[dayRange]),
           let monthRange = Range(match.range(at: 1), in: normalized),
           let month = calendarMonth(String(normalized[monthRange])),
           (1...month.maximumDay).contains(day),
           let suffixRange = Range(match.range(at: 3), in: normalized),
           hasValidOrdinalSuffix(String(normalized[suffixRange]), day: day) {
            return DueDate(day: day, occurrence: String(normalized[monthRange]).lowercased())
        }

        let weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        let weekday = normalized.lowercased()
        guard weekdays.contains(weekday) else { return nil }
        return DueDate(day: 0, occurrence: weekday)
    }

    private static func hasValidOrdinalSuffix(_ actualSuffix: String, day: Int) -> Bool {
        let expected: String
        if (11...13).contains(day % 100) { expected = "th" }
        else {
            switch day % 10 {
            case 1: expected = "st"
            case 2: expected = "nd"
            case 3: expected = "rd"
            default: expected = "th"
            }
        }
        return actualSuffix.isEmpty || actualSuffix.lowercased() == expected
    }

    private static func calendarMonth(_ value: String) -> (maximumDay: Int, name: String)? {
        let names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        guard let index = names.firstIndex(of: value.lowercased()) else { return nil }
        let lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return (lengths[index], names[index])
    }
}
