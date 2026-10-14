import Foundation

/// The native bridge is never exposed to arbitrary websites or file:// pages.
struct HostPolicy {
    let origin: URL
    static let maxFileBytes = 10 * 1024 * 1024

    static func isLocalConsole(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.user == nil, parts.password == nil,
              ["http", "https"].contains(parts.scheme?.lowercased() ?? ""),
              ["localhost", "127.0.0.1", "::1", "[::1]"].contains(parts.host?.lowercased() ?? "")
        else { return false }
        return true
    }

    func trusts(_ url: URL?) -> Bool {
        guard let url, Self.isLocalConsole(origin), Self.isLocalConsole(url),
              let expected = URLComponents(url: origin, resolvingAgainstBaseURL: false),
              let actual = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return false }
        return expected.scheme == actual.scheme && expected.host == actual.host
            && (expected.port ?? (expected.scheme == "https" ? 443 : 80))
            == (actual.port ?? (actual.scheme == "https" ? 443 : 80))
    }

    static func validRequestID(_ value: String?) -> Bool {
        guard let value else { return false }
        return value.range(of: "^[A-Za-z0-9-]{1,64}$", options: .regularExpression) != nil
    }
}
