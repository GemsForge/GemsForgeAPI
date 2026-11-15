import Foundation
import Crypto
import Vapor

struct NotionImportPreviewProperty: Content, Sendable {
    let name: String
    let notionType: String
    let proposedStorage: String
    let requiresReview: Bool
}

struct NotionImportPreviewResource: Content, Sendable {
    let notionID: String
    let title: String
    let notionObject: String
    let target: String
    let rowCount: Int
    let properties: [NotionImportPreviewProperty]
    let unmappedProperties: [String]
}

struct NotionImportPreviewResponse: Content, Sendable {
    let readOnly: Bool
    let confirmationToken: String
    let expiresAt: Date
    let resources: [NotionImportPreviewResource]
    let totalRows: Int
    let unmappedProperties: [String]
    let warnings: [String]
}

struct NotionImportSnapshot: Sendable, Codable {
    let pages: [NotionJSONValue]
    let dataSources: [NotionJSONValue]
    let rowsByDataSourceID: [String: [NotionJSONValue]]

    var fingerprint: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let canonical = NotionImportSnapshot(
            pages: Self.stripTemporaryFileURLs(pages),
            dataSources: Self.stripTemporaryFileURLs(dataSources),
            rowsByDataSourceID: rowsByDataSourceID.mapValues(Self.stripTemporaryFileURLs)
        )
        let data = (try? encoder.encode(canonical)) ?? Data()
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private static func stripTemporaryFileURLs(_ values: [NotionJSONValue]) -> [NotionJSONValue] {
        values.map { stripTemporaryFileURLs($0, insideHostedFile: false) }
    }

    private static func stripTemporaryFileURLs(_ value: NotionJSONValue, insideHostedFile: Bool) -> NotionJSONValue {
        switch value {
        case .object(let object):
            var sanitized: [String: NotionJSONValue] = [:]
            for (key, child) in object {
                if insideHostedFile && (key == "url" || key == "expiry_time") { continue }
                sanitized[key] = stripTemporaryFileURLs(child, insideHostedFile: key == "file" || insideHostedFile)
            }
            return .object(sanitized)
        case .array(let values):
            return .array(values.map { stripTemporaryFileURLs($0, insideHostedFile: insideHostedFile) })
        default: return value
        }
    }
}

struct NotionImportCommitRequest: Content, Sendable {
    let confirmationToken: String
    let confirmImport: Bool
    var excludedNotionIDs: [String] = []
}

struct NotionImportRowResult: Content, Sendable {
    let notionID: String
    let title: String
    let target: String
    let result: String
    let recordID: String?
    let reason: String?
}

struct NotionImportCommitResponse: Content, Sendable {
    let status: String
    let backupFileName: String
    let backupSizeBytes: Int64
    let created: Int
    let updated: Int
    let skipped: Int
    let failed: Int
    let unmappedProperties: [String]
    let rows: [NotionImportRowResult]
}

actor NotionImportApprovals {
    static let shared = NotionImportApprovals()
    static let lifetime: TimeInterval = 5 * 60

    private struct Approval: Sendable {
        let hubID: String
        let fingerprint: String
        let expiresAt: Date
    }
    private var approvals: [String: Approval] = [:]

    func issue(hubID: String, fingerprint: String, now: Date = Date()) -> (token: String, expiresAt: Date) {
        approvals = approvals.filter { $0.value.expiresAt > now }
        let token = UUID().uuidString
        let expiresAt = now.addingTimeInterval(Self.lifetime)
        approvals[token] = Approval(hubID: hubID, fingerprint: fingerprint, expiresAt: expiresAt)
        return (token, expiresAt)
    }

    func consume(token: String, hubID: String, now: Date = Date()) -> String? {
        guard let approval = approvals[token], approval.expiresAt > now,
              approval.hubID == hubID else { return nil }
        approvals.removeValue(forKey: token)
        return approval.fingerprint
    }
}

/// Reads every page and data source visible to the configured integration and
/// produces a no-write mapping report. Each API collection is fully paginated.
struct NotionImportPreviewService: Sendable {
    let api: NotionAPIClient

    func preview(hubID: String, now: Date = Date()) async throws -> NotionImportPreviewResponse {
        let snapshot = try await loadSnapshot()
        let approval = await NotionImportApprovals.shared.issue(hubID: hubID, fingerprint: snapshot.fingerprint, now: now)
        return try await response(for: snapshot, confirmationToken: approval.token, expiresAt: approval.expiresAt)
    }

    func refreshedSnapshot() async throws -> NotionImportSnapshot {
        try await loadSnapshot()
    }

    private func loadSnapshot() async throws -> NotionImportSnapshot {
        async let pageResults = api.searchAll(kind: "page")
        async let sourceResults = api.searchAll(kind: "data_source")
        let (pages, dataSources) = try await (pageResults, sourceResults)
        var rowsByDataSourceID: [String: [NotionJSONValue]] = [:]
        for source in dataSources {
            guard let id = source.objectValue?["id"]?.stringValue else { continue }
            rowsByDataSourceID[id] = try await api.queryDataSourceAll(id)
        }
        return NotionImportSnapshot(pages: pages, dataSources: dataSources, rowsByDataSourceID: rowsByDataSourceID)
    }

    private func response(
        for snapshot: NotionImportSnapshot,
        confirmationToken: String,
        expiresAt: Date
    ) async throws -> NotionImportPreviewResponse {
        let pages = snapshot.pages
        let dataSources = snapshot.dataSources

        var resources: [NotionImportPreviewResource] = []
        for page in pages {
            guard let object = page.objectValue else { continue }
            let title = Self.title(from: object)
            let target = Self.target(for: title, object: "page", notionObject: object)
            resources.append(.init(
                notionID: object["id"]?.stringValue ?? "",
                title: title,
                notionObject: "page",
                target: target,
                rowCount: 1,
                properties: [],
                unmappedProperties: target == "Review required" ? ["page target"] : []
            ))
        }

        for source in dataSources {
            guard let object = source.objectValue else { continue }
            let title = Self.title(from: object)
            let rows = snapshot.rowsByDataSourceID[object["id"]?.stringValue ?? ""] ?? []
            let targetSourceIDs = Set(dataSources.compactMap { value -> String? in
                guard let candidate = value.objectValue,
                      let id = candidate["id"]?.stringValue,
                      Self.target(for: Self.title(from: candidate), object: "data_source") != "Review required"
                else { return nil }
                return id
            })
            let properties = Self.properties(from: object["properties"], rows: rows, targetSourceIDs: targetSourceIDs)
            let target = Self.target(for: title, object: "data_source")
            resources.append(.init(
                notionID: object["id"]?.stringValue ?? "",
                title: title,
                notionObject: "data_source",
                target: target,
                rowCount: rows.count,
                properties: properties,
                unmappedProperties: properties.filter(\.requiresReview).map(\.name)
                    + (target == "Review required" ? ["database target"] : [])
            ))
        }

        resources.sort {
            if $0.notionObject != $1.notionObject { return $0.notionObject < $1.notionObject }
            return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
        }
        let unmapped = resources.flatMap { resource in
            resource.unmappedProperties.map { "\(resource.title): \($0)" }
        }
        return .init(
            readOnly: true,
            confirmationToken: confirmationToken,
            expiresAt: expiresAt,
            resources: resources,
            totalRows: resources.reduce(0) { $0 + $1.rowCount },
            unmappedProperties: unmapped,
            warnings: [
                "This preview is read-only. It does not modify GemLife or Notion.",
                "Confirming this preview imports the captured pages and data-source rows into the authenticated Hub.",
                "Rows with unknown targets or unsupported properties are reported and skipped unless the mappings are supported.",
                "Relations support one mapped target per row. Notion rollup calculations are not reproduced by GemLife lookups.",
            ]
        )
    }

    private static func title(from object: [String: NotionJSONValue]) -> String {
        if let title = richText(object["title"]), !title.isEmpty { return title }
        if let properties = object["properties"]?.objectValue {
            for value in properties.values {
                guard let definition = value.objectValue,
                      definition["type"]?.stringValue == "title",
                      let title = richText(definition["title"]), !title.isEmpty else { continue }
                return title
            }
        }
        return "Untitled"
    }

    static func properties(
        from value: NotionJSONValue?, rows: [NotionJSONValue], targetSourceIDs: Set<String>
    ) -> [NotionImportPreviewProperty] {
        guard let values = value?.objectValue else { return [] }
        return values.keys.sorted().map { name in
            let property = values[name]?.objectValue ?? [:]
            let type = property["type"]?.stringValue ?? "unknown"
            let mapped = NotionImportValueMapper.propertyType(type)
            let targetID = property["relation"]?.objectValue?["data_source_id"]?.stringValue
                ?? property["relation"]?.objectValue?["database_id"]?.stringValue
            let hasMultipleLinks = rows.contains { row in
                (row.objectValue?["properties"]?.objectValue?[name]?.objectValue?["relation"]?.arrayValue?.count ?? 0) > 1
            }
            let relationNeedsReview = type == "relation" &&
                (targetID.map { !targetSourceIDs.contains($0) } ?? true || hasMultipleLinks)
            return .init(
                name: name,
                notionType: type,
                proposedStorage: relationNeedsReview
                    ? "Single linked record only; target or multiple links need review"
                    : mapped.storage.rawValue,
                requiresReview: mapped.requiresReview || relationNeedsReview
            )
        }
    }

    private static func richText(_ value: NotionJSONValue?) -> String? {
        guard let items = value?.arrayValue else { return nil }
        return items.compactMap { item in
            let object = item.objectValue ?? [:]
            if let plain = object["plain_text"]?.stringValue { return plain }
            return object["text"]?.objectValue?["content"]?.stringValue
        }.joined()
    }

    static func target(for title: String, object: String, notionObject: [String: NotionJSONValue] = [:]) -> String {
        let key = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if object == "page" {
            let parent = notionObject["parent"]?.objectValue ?? [:]
            let parentType = parent["type"]?.stringValue
            if parentType == "data_source" || parentType == "database" { return "Database row" }
            switch key {
            case "gem.personal", "gem personal": return "Hub"
            case "forgekeeper", "career", "family", "interests": return "Domain"
            default:
                return parent["page_id"]?.stringValue == nil ? "Review required" : "ForgeKeeper"
            }
        }
        switch key {
        case "service expense tracker": return "Services"
        case "budget (archive)", "budget": return "Transactions / Categories"
        case "employment": return "Employment"
        case "education": return "Education"
        case "affiliations", "vehicles", "projects", "proverbs planner", "life themes",
             "professional milestones", "think pieces":
            return "Custom table: \(title)"
        default: return "Review required"
        }
    }
}
