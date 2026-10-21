import Foundation
import Vapor

/// Stable values persisted by Table View metadata. These are intentionally
/// separate from the names used by any particular client.
enum TableViewType: String, CaseIterable, Codable, Content, Sendable {
    case table = "Table"
    case list = "List"
    case gallery = "Gallery"
    case grid = "Grid"
}

enum ViewQueryNodeType: String, CaseIterable, Codable, Content, Sendable {
    case group = "Group"
    case condition = "Condition"
    case sort = "Sort"
    case recordGroup = "RecordGroup"
}

enum ViewQueryBooleanOperator: String, CaseIterable, Codable, Content, Sendable {
    case and = "AND"
    case or = "OR"
}

enum ViewQuerySortDirection: String, CaseIterable, Codable, Content, Sendable {
    case ascending = "Ascending"
    case descending = "Descending"
}

/// Comparison operators are a closed vocabulary. A client cannot persist an
/// SQL fragment as an operator or value.
enum ViewQueryComparisonOperator: String, CaseIterable, Codable, Content, Sendable {
    case equals = "Equals"
    case notEquals = "NotEquals"
    case contains = "Contains"
    case startsWith = "StartsWith"
    case endsWith = "EndsWith"
    case greaterThan = "GreaterThan"
    case greaterThanOrEqual = "GreaterThanOrEqual"
    case lessThan = "LessThan"
    case lessThanOrEqual = "LessThanOrEqual"
    case isNull = "IsNull"
    case isNotNull = "IsNotNull"
    case between = "Between"
    case `in` = "In"

    var operandCount: ClosedRange<Int> {
        switch self {
        case .isNull, .isNotNull: return 0...0
        case .between: return 2...2
        case .in: return 1...100
        default: return 1...1
        }
    }
}

enum ViewQueryValueType: String, CaseIterable, Codable, Content, Sendable {
    case text = "Text"
    case integer = "Integer"
    case decimal = "Decimal"
    case boolean = "Boolean"
    case date = "Date"
    case dateTime = "DateTime"
    case null = "Null"
}

/// An encoded query operand. The database stores the canonical string form
/// and the separate `ValueType` field makes its meaning unambiguous.
enum ViewQueryValue: Equatable, Sendable {
    case text(String)
    case integer(Int64)
    case decimal(String)
    case boolean(Bool)
    case date(String)
    case dateTime(String)
    case null

    var type: ViewQueryValueType {
        switch self {
        case .text: return .text
        case .integer: return .integer
        case .decimal: return .decimal
        case .boolean: return .boolean
        case .date: return .date
        case .dateTime: return .dateTime
        case .null: return .null
        }
    }
}

enum ViewQueryValueCodecError: Error, CustomStringConvertible, Equatable {
    case missingValue(ViewQueryValueType)
    case invalidValue(ViewQueryValueType, String)
    case invalidDate(String)
    case invalidOperandCount(expected: ClosedRange<Int>, actual: Int)

    var description: String {
        switch self {
        case .missingValue(let type): return "A \(type.rawValue) query value is required."
        case .invalidValue(let type, let value): return "The query value is not a valid \(type.rawValue) value: \(value)."
        case .invalidDate(let value): return "The query date is not in the canonical ISO-8601 form: \(value)."
        case .invalidOperandCount(let expected, let actual):
            return "The query operator requires \(expected.lowerBound)\(expected.lowerBound == expected.upperBound ? "" : "-\(expected.upperBound)") operands; received \(actual)."
        }
    }
}

/// Canonicalizes and decodes query values. Multi-operand operators use a JSON
/// array of the same typed scalar value; no SQL syntax is accepted.
enum ViewQueryValueCodec {
    static func encode(_ value: ViewQueryValue) throws -> String? {
        switch value {
        case .text(let value): return value
        case .integer(let value): return String(value)
        case .decimal(let value): return canonicalDecimal(value)
        case .boolean(let value): return value ? "true" : "false"
        case .date(let value):
            guard isCanonicalDate(value) else { throw ViewQueryValueCodecError.invalidDate(value) }
            return value
        case .dateTime(let value):
            guard let date = ISO8601DateFormatter().date(from: value) else {
                throw ViewQueryValueCodecError.invalidDate(value)
            }
            return ISO8601DateFormatter().string(from: date)
        case .null: return nil
        }
    }

    static func encode(_ values: [ViewQueryValue], for op: ViewQueryComparisonOperator) throws -> String? {
        guard op.operandCount.contains(values.count) else {
            throw ViewQueryValueCodecError.invalidOperandCount(expected: op.operandCount, actual: values.count)
        }
        guard !values.isEmpty else { return nil }
        let encoded: [Any] = try values.map { value in
            if let encodedValue = try encode(value) {
                return encodedValue
            }
            return NSNull()
        }
        let data = try JSONSerialization.data(withJSONObject: encoded, options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }

    static func decode(_ value: String?, as type: ViewQueryValueType) throws -> ViewQueryValue {
        guard let value else { throw ViewQueryValueCodecError.missingValue(type) }
        switch type {
        case .text: return .text(value)
        case .integer:
            guard let result = Int64(value) else { throw ViewQueryValueCodecError.invalidValue(type, value) }
            return .integer(result)
        case .decimal:
            guard let result = canonicalDecimal(value) else { throw ViewQueryValueCodecError.invalidValue(type, value) }
            return .decimal(result)
        case .boolean:
            guard let result = ["true": true, "false": false][value.lowercased()] else {
                throw ViewQueryValueCodecError.invalidValue(type, value)
            }
            return .boolean(result)
        case .date:
            guard isCanonicalDate(value) else { throw ViewQueryValueCodecError.invalidDate(value) }
            return .date(value)
        case .dateTime:
            guard let date = ISO8601DateFormatter().date(from: value) else {
                throw ViewQueryValueCodecError.invalidDate(value)
            }
            return .dateTime(ISO8601DateFormatter().string(from: date))
        case .null:
            throw ViewQueryValueCodecError.invalidValue(type, value)
        }
    }

    private static func canonicalDecimal(_ value: String) -> String? {
        guard let decimal = Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")) else { return nil }
        return NSDecimalNumber(decimal: decimal).stringValue
    }

    private static func isCanonicalDate(_ value: String) -> Bool {
        guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return false }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: formatter.date(from: value) ?? Date.distantPast) == value
    }
}

struct TableViewRequest: Content, Sendable {
    let hubID: String
    let tableName: String
    let name: String
    let viewType: TableViewType
    let isDefault: Bool
    let sortOrder: Int
    let configurationVersion: Int
}

struct TableViewResponse: Content, Sendable, Equatable {
    let viewID: String
    let hubID: String
    let tableName: String
    let name: String
    let viewType: TableViewType
    let isDefault: Bool
    let sortOrder: Int
    let configurationVersion: Int
    let createdAt: Date?
    let updatedAt: Date?
}

struct ViewColumnConfigurationRequest: Content, Sendable {
    let viewID: String
    let columnName: String
    let isVisible: Bool
    let sortOrder: Int
    let width: Double?
}

struct ViewColumnConfigurationResponse: Content, Sendable, Equatable {
    let viewColumnID: String
    let viewID: String
    let columnName: String
    let isVisible: Bool
    let sortOrder: Int
    let width: Double?
}

struct ViewQueryConfigurationRequest: Content, Sendable {
    let viewID: String
    let parentQueryID: String?
    let nodeType: ViewQueryNodeType
    let columnName: String?
    let comparisonOperator: ViewQueryComparisonOperator?
    let valueType: ViewQueryValueType?
    let value: String?
    let booleanOperator: ViewQueryBooleanOperator?
    let direction: ViewQuerySortDirection?
    let sortOrder: Int
}

struct ViewQueryConfigurationResponse: Content, Sendable, Equatable {
    let viewQueryID: String
    let viewID: String
    let parentQueryID: String?
    let nodeType: ViewQueryNodeType
    let columnName: String?
    let comparisonOperator: ViewQueryComparisonOperator?
    let valueType: ViewQueryValueType?
    let value: String?
    let booleanOperator: ViewQueryBooleanOperator?
    let direction: ViewQuerySortDirection?
    let sortOrder: Int
}

typealias TableViewCreateRequest = TableViewRequest
typealias ViewColumnConfigurationCreateRequest = ViewColumnConfigurationRequest
typealias ViewQueryConfigurationCreateRequest = ViewQueryConfigurationRequest

/// Saved metadata is never silently repaired after a schema change. It stays
/// stored and is reported as unavailable until an explicit migration updates
/// the logical identifier.
enum TableViewSchemaDriftPolicy: String, Codable, Content, Sendable {
    case preserveAndReport = "preserve-and-report"
}
