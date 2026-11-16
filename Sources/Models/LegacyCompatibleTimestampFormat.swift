import Fluent
import Foundation

/// Stores timestamps as ISO-8601 text while reading SQLite date-time and
/// legacy Unix-seconds text values from databases with TEXT affinity.
struct LegacyCompatibleTimestampFormat: TimestampFormat {
    typealias Value = String

    func parse(_ value: String) -> Date? {
        if let date = ISO8601DateFormatter().date(from: value) {
            return date
        }

        let sqliteFormatter = DateFormatter()
        sqliteFormatter.locale = Locale(identifier: "en_US_POSIX")
        sqliteFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        sqliteFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = sqliteFormatter.date(from: value) {
            return date
        }

        guard let seconds = Double(value), seconds.isFinite else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }

    func serialize(_ date: Date) -> String? {
        ISO8601DateFormatter().string(from: date)
    }
}

extension TimestampFormatFactory where Format == LegacyCompatibleTimestampFormat {
    static var legacyCompatible: Self { .init { LegacyCompatibleTimestampFormat() } }
}
