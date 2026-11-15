import Foundation
import Vapor

/// The small JSON value model used for Notion's evolving property payloads.
indirect enum NotionJSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: NotionJSONValue])
    case array([NotionJSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: NotionJSONValue].self) { self = .object(value) }
        else { self = .array(try container.decode([NotionJSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var objectValue: [String: NotionJSONValue]? { if case .object(let value) = self { value } else { nil } }
    var arrayValue: [NotionJSONValue]? { if case .array(let value) = self { value } else { nil } }
    var stringValue: String? { if case .string(let value) = self { value } else { nil } }
    var boolValue: Bool? { if case .bool(let value) = self { value } else { nil } }
}

struct NotionAPIPage: Decodable, Sendable {
    let results: [NotionJSONValue]
    let hasMore: Bool
    let nextCursor: String?

    enum CodingKeys: String, CodingKey {
        case results
        case hasMore = "has_more"
        case nextCursor = "next_cursor"
    }
}

enum NotionAPIError: Error, CustomStringConvertible {
    case missingToken
    case rejected(status: Int, retryAfter: String?)
    case invalidResponse

    var description: String {
        switch self {
        case .missingToken: return "Notion import is not configured. Set NOTION_API_KEY in the server environment."
        case .rejected(let status, let retryAfter):
            if status == 429 || status == 529 {
                return "Notion rate limited the request (HTTP \(status)); retry after \(retryAfter ?? "the server's backoff interval")."
            }
            return "Notion returned HTTP \(status). Check the integration access and retry."
        case .invalidResponse: return "Notion returned an unreadable response."
        }
    }
}

private actor NotionRequestPacer {
    static let shared = NotionRequestPacer()
    private var lastRequestAt = Date.distantPast

    func wait() async throws {
        let elapsed = Date().timeIntervalSince(lastRequestAt)
        if elapsed < 0.35 {
            let delay = Int((0.35 - elapsed) * 1_000_000_000)
            try await Task.sleep(nanoseconds: UInt64(max(1, delay)))
        }
        lastRequestAt = Date()
    }
}

/// Read-only Notion REST client. It never logs request bodies or response data.
struct NotionAPIClient: Sendable {
    static let apiVersion = "2026-03-11"
    private static let baseURL = "https://api.notion.com/v1"
    private let client: any Client
    private let token: String

    init(client: any Client, token: String? = Environment.get("NOTION_API_KEY")) throws {
        guard let token, !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NotionAPIError.missingToken
        }
        self.client = client
        self.token = token
    }

    func search(kind: String, cursor: String? = nil) async throws -> NotionAPIPage {
        var json: [String: Any] = [
            "filter": ["property": "object", "value": kind],
            "page_size": 100,
        ]
        if let cursor { json["start_cursor"] = cursor }
        return try await send(.POST, path: "/search", json: json)
    }

    func searchAll(kind: String) async throws -> [NotionJSONValue] {
        try await paginate { cursor in try await search(kind: kind, cursor: cursor) }
    }

    func queryDataSource(_ id: String, cursor: String? = nil) async throws -> NotionAPIPage {
        var json: [String: Any] = ["page_size": 100]
        if let cursor { json["start_cursor"] = cursor }
        return try await send(.POST, path: "/data_sources/\(Self.pathComponent(id))/query", json: json)
    }

    func queryDataSourceAll(_ id: String) async throws -> [NotionJSONValue] {
        try await paginate { cursor in try await queryDataSource(id, cursor: cursor) }
    }

    func children(of blockID: String, cursor: String? = nil) async throws -> NotionAPIPage {
        var uri = "\(Self.baseURL)/blocks/\(Self.pathComponent(blockID))/children?page_size=100"
        if let cursor, let encoded = cursor.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            uri += "&start_cursor=\(encoded)"
        }
        return try await send(.GET, uri: uri)
    }

    func childrenAll(of blockID: String) async throws -> [NotionJSONValue] {
        try await paginate { cursor in try await children(of: blockID, cursor: cursor) }
    }

    private func paginate(
        _ fetch: (String?) async throws -> NotionAPIPage
    ) async throws -> [NotionJSONValue] {
        var values: [NotionJSONValue] = []
        var cursor: String?
        var pageCount = 0
        repeat {
            let page = try await fetch(cursor)
            values.append(contentsOf: page.results)
            cursor = page.hasMore ? page.nextCursor : nil
            pageCount += 1
            guard pageCount <= 1_000, !page.hasMore || page.nextCursor != nil else {
                throw NotionAPIError.invalidResponse
            }
        } while cursor != nil
        return values
    }

    private func send(_ method: HTTPMethod, path: String, json: [String: Any]) async throws -> NotionAPIPage {
        let data = try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
        return try await send(method, uri: Self.baseURL + path, body: data)
    }

    private func send(_ method: HTTPMethod, path: String) async throws -> NotionAPIPage {
        try await send(method, uri: Self.baseURL + path, body: nil)
    }

    private func send(_ method: HTTPMethod, uri: String) async throws -> NotionAPIPage {
        try await send(method, uri: uri, body: nil)
    }

    private func send(_ method: HTTPMethod, uri: String, body: Data?) async throws -> NotionAPIPage {
        var request = ClientRequest(method: method, url: URI(string: uri))
        request.headers.replaceOrAdd(name: "Authorization", value: "Bearer \(token)")
        request.headers.replaceOrAdd(name: "Notion-Version", value: Self.apiVersion)
        request.headers.replaceOrAdd(name: "Accept", value: "application/json")
        if let body {
            request.headers.contentType = .json
            request.body = ByteBuffer(data: body)
        }
        for attempt in 0...3 {
            try await NotionRequestPacer.shared.wait()
            let response = try await client.send(request)
            if response.status == .ok,
               let bytes = response.body,
               let data = bytes.getData(at: bytes.readerIndex, length: bytes.readableBytes) {
                do { return try JSONDecoder().decode(NotionAPIPage.self, from: data) }
                catch { throw NotionAPIError.invalidResponse }
            }
            let retryAfter = response.headers.first(name: "Retry-After")
            let status = Int(response.status.code)
            if (status == 429 || status == 529), attempt < 3 {
                let seconds = Double(retryAfter ?? "") ?? Double(1 << attempt)
                try await Task.sleep(nanoseconds: UInt64(min(max(seconds, 0.1), 30) * 1_000_000_000))
                continue
            }
            throw NotionAPIError.rejected(status: status, retryAfter: retryAfter)
        }
        throw NotionAPIError.invalidResponse
    }

    private static func pathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }
}
