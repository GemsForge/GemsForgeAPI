import Foundation

enum ImportScalar: Equatable {
    case text(String)
    case number(Double)
    case integer(Int64)
    case bool(Bool)
    case null

    var string: String? { if case .text(let value) = self { value } else { nil } }
}

/// Converts Notion-specific values into the existing Gem Life storage contract.
/// This mapper is pure so dry-run previews can report transformations without
/// requiring a database connection or exposing imported values in logs.
enum NotionImportValueMapper {
    enum StorageKind: String, Sendable, Equatable {
        case text = "TEXT"
        case formulaText = "TEXT value only; formula calculation needs review"
        case number = "REAL"
        case checkbox = "INTEGER (0/1); checkbox presentation needs review"
        case select = "TEXT + Select options"
        case multiSelect = "TEXT + MultiSelect options"
        case status = "TEXT + Status options"
        case dateRange = "Start / End date columns"
        case fileMetadata = "FileMetadata"
        case relation = "Relation property"
        case lookup = "Lookup value only; rollup calculation needs review"
        case timestamp = "CreatedAt / UpdatedAt"
        case integer = "INTEGER"
        case dropped = "Dropped (single-user workspace)"
        case unsupported = "Unmapped"
    }

    struct PropertyMapping: Sendable, Equatable {
        let storage: StorageKind
        let requiresReview: Bool
    }

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

    static func isAccountLike(_ name: String) -> Bool {
        let pieces = name.split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "#" })
        var words: [String] = []
        for piece in pieces {
            var start = piece.startIndex
            var index = piece.index(after: start)
            while index < piece.endIndex {
                let previous = piece[piece.index(before: index)]
                let current = piece[index]
                if previous.isLowercase && current.isUppercase {
                    words.append(String(piece[start..<index]).lowercased())
                    start = index
                }
                index = piece.index(after: index)
            }
            words.append(String(piece[start...]).lowercased())
        }
        // Treat a trailing or leading hash glued to a word as its own marker.
        words = words.flatMap { word -> [String] in
            guard word.contains("#") else { return [word] }
            return word.split(separator: "#", omittingEmptySubsequences: true).map(String.init) + ["#"]
        }
        let normalized = words.joined()
        if ["card", "cardnumber", "iban", "routing", "routingnumber", "accountnumber"].contains(normalized) {
            return true
        }
        let subjects: Set<String> = ["account", "acct", "card", "routing", "iban", "bank"]
        let markers: Set<String> = ["number", "num", "no", "nbr", "#"]
        return !subjects.isDisjoint(with: words) && !markers.isDisjoint(with: words)
    }

    static func protectAccountValue(_ value: String) -> String {
        accountNumberLastFour(value) ?? value
    }

    static func protectedAccountScalar(_ scalar: ImportScalar) -> ImportScalar? {
        let value: String
        switch scalar {
        case .text(let text): value = text
        case .number(let number):
            if number.isFinite, number.rounded() == number {
                if abs(number) <= 9_007_199_254_740_992 {
                    value = String(Int64(number))
                } else {
                    value = String(format: "%.0f", number)
                }
            } else {
                value = String(number)
            }
        case .integer(let number): value = String(number)
        case .bool(let flag): value = flag ? "1" : "0"
        case .null: return nil
        }
        return .text(protectAccountValue(value))
    }

    /// Maps Notion property types to the existing GemLife column and metadata
    /// contracts. Formula values are intentionally preserved as text fallback
    /// and marked for review because formula semantics are not imported.
    static func propertyType(_ notionType: String) -> PropertyMapping {
        switch notionType {
        case "title", "rich_text", "url", "email", "phone_number":
            return .init(storage: .text, requiresReview: false)
        case "formula": return .init(storage: .formulaText, requiresReview: true)
        case "checkbox": return .init(storage: .checkbox, requiresReview: true)
        case "number": return .init(storage: .number, requiresReview: false)
        case "select": return .init(storage: .select, requiresReview: false)
        case "multi_select": return .init(storage: .multiSelect, requiresReview: false)
        case "files": return .init(storage: .fileMetadata, requiresReview: false)
        case "status": return .init(storage: .status, requiresReview: false)
        case "date": return .init(storage: .dateRange, requiresReview: false)
        case "relation": return .init(storage: .relation, requiresReview: false)
        case "rollup": return .init(storage: .lookup, requiresReview: true)
        case "created_time": return .init(storage: .timestamp, requiresReview: false)
        case "last_edited_time": return .init(storage: .timestamp, requiresReview: false)
        case "unique_id": return .init(storage: .integer, requiresReview: false)
        case "people": return .init(storage: .dropped, requiresReview: false)
        case "created_by", "last_edited_by", "verification",
             "button", "place", "unknown":
            return .init(storage: .unsupported, requiresReview: true)
        default:
            return .init(storage: .unsupported, requiresReview: true)
        }
    }

    /// Renders the supported Notion block subset into Markdown. Unsupported
    /// blocks are omitted and reported by their type so a preview can surface
    /// losses before an import is approved.
    static func markdown(blocks: [[String: Any]]) -> (markdown: String, unmappedTypes: [String]) {
        var rendered: [String] = []
        var unmapped: [String] = []
        for block in blocks {
            guard let type = block["type"] as? String,
                  let payload = block[type] as? [String: Any] else {
                unmapped.append("unknown")
                continue
            }
            let text = richText(payload["rich_text"])
            let value: String
            switch type {
            case "paragraph": value = text
            case "heading_1": value = "# \(text)"
            case "heading_2": value = "## \(text)"
            case "heading_3": value = "### \(text)"
            case "bulleted_list_item": value = "- \(text)"
            case "numbered_list_item": value = "1. \(text)"
            case "quote": value = "> \(text)"
            case "code":
                let language = payload["language"] as? String ?? ""
                value = "```\(language)\n\(text)\n```"
            case "divider": value = "---"
            case "to_do":
                let checked = payload["checked"] as? Bool == true ? "x" : " "
                value = "- [\(checked)] \(text)"
            case "child_page", "child_database":
                let title = payload["title"] as? String ?? text
                value = "## \(title)"
            default:
                unmapped.append(type)
                continue
            }
            rendered.append(value)
            if let children = payload["children"] as? [[String: Any]], !children.isEmpty {
                let nested = markdown(blocks: children)
                unmapped.append(contentsOf: nested.unmappedTypes)
                rendered.append(nested.markdown
                    .split(separator: "\n", omittingEmptySubsequences: false)
                    .map { "  \($0)" }
                    .joined(separator: "\n"))
            }
        }
        return (rendered.joined(separator: "\n\n"), unmapped)
    }

    static func markdown(blocks: [NotionJSONValue]) -> (markdown: String, unmappedTypes: [String]) {
        markdown(blocks: blocks.map { $0.foundationValue as? [String: Any] ?? [:] })
    }

    private static func richText(_ rawValue: Any?) -> String {
        guard let items = rawValue as? [[String: Any]] else { return "" }
        return items.compactMap { item in
            (item["plain_text"] as? String)
                ?? ((item["text"] as? [String: Any])?["content"] as? String)
        }.joined()
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
