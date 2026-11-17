import Foundation
import Crypto
import Fluent
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
    let excludedNotionIDs: [String]

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        confirmationToken = try container.decode(String.self, forKey: .confirmationToken)
        confirmImport = try container.decode(Bool.self, forKey: .confirmImport)
        excludedNotionIDs = try container.decodeIfPresent([String].self, forKey: .excludedNotionIDs) ?? []
    }
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
    let database: any Database
    let hubID: String

    func preview(now: Date = Date()) async throws -> NotionImportPreviewResponse {
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

    func response(
        for snapshot: NotionImportSnapshot,
        confirmationToken: String,
        expiresAt: Date
    ) async throws -> NotionImportPreviewResponse {
        let pages = snapshot.pages
        let dataSources = snapshot.dataSources
        let tableTargets = try await NotionImportTableAllocator.allocate(dataSources: dataSources, database: database, hubID: hubID)

        var resources: [NotionImportPreviewResource] = []
        for page in pages {
            guard let object = page.objectValue, !Self.isDatabaseRow(object) else { continue }
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
                        || tableTargets[id] != nil
                else { return nil }
                return id
            })
            let properties = Self.properties(from: object["properties"], rows: rows, targetSourceIDs: targetSourceIDs)
            let target = Self.target(for: title, object: "data_source") == "Review required"
                ? "New table: \(tableTargets[object["id"]?.stringValue ?? ""] ?? "Untitled")"
                : Self.target(for: title, object: "data_source")
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

        for (parentID, count) in Self.unavailableParentRowCounts(pages: pages, dataSources: dataSources) {
            resources.append(.init(
                notionID: parentID,
                title: "Unavailable data source (\(parentID))",
                notionObject: "data_source",
                target: Self.unavailableSourceTarget,
                rowCount: count,
                properties: [],
                unmappedProperties: ["\(count) row(s) will not be imported: data source not shared with the Notion integration"]
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
            totalRows: resources.filter { $0.target != Self.unavailableSourceTarget }.reduce(0) { $0 + $1.rowCount },
            unmappedProperties: unmapped,
            warnings: [
                "This preview is read-only. It does not modify GemLife or Notion.",
                "Confirming this preview imports the captured pages and data-source rows into the authenticated Hub.",
                "Rows with unknown targets or unsupported properties are reported and skipped unless the mappings are supported.",
                "Relations support one mapped target per row. Notion rollup calculations are not reproduced by GemLife lookups.",
            ]
        )
    }

    static func title(from object: [String: NotionJSONValue]) -> String {
        if let title = normalizedTitle(richText(object["title"])) { return title }
        if let properties = object["properties"]?.objectValue {
            for value in properties.values {
                guard let definition = value.objectValue,
                      definition["type"]?.stringValue == "title",
                      let title = normalizedTitle(richText(definition["title"])) else { continue }
                return title
            }
        }
        return "Untitled"
    }

    private static func normalizedTitle(_ title: String?) -> String? {
        guard let title else { return nil }
        let normalized = title.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return normalized.isEmpty ? nil : normalized
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

    static let unavailableSourceTarget = "Not imported: data source unavailable"

    /// Counts database-row pages whose parent data source (or database) was not
    /// returned by search, keyed by the parent ID. These rows would otherwise be
    /// skipped silently because they are excluded from the page list.
    static func unavailableParentRowCounts(pages: [NotionJSONValue], dataSources: [NotionJSONValue]) -> [String: Int] {
        var known = Set<String>()
        for source in dataSources.compactMap(\.objectValue) {
            if let id = source["id"]?.stringValue { known.insert(id) }
            if let databaseID = source["parent"]?.objectValue?["database_id"]?.stringValue { known.insert(databaseID) }
        }
        var counts: [String: Int] = [:]
        for page in pages.compactMap(\.objectValue) where isDatabaseRow(page) {
            let parent = page["parent"]?.objectValue ?? [:]
            let candidates = [parent["data_source_id"]?.stringValue, parent["database_id"]?.stringValue].compactMap { $0 }
            guard !candidates.contains(where: known.contains) else { continue }
            counts[candidates.first ?? "unknown", default: 0] += 1
        }
        return counts
    }

    static func isDatabaseRow(_ object: [String: NotionJSONValue]) -> Bool {
        guard let parentType = object["parent"]?.objectValue?["type"]?.stringValue else { return false }
        return ["data_source_id", "database_id", "data_source", "database"].contains(parentType)
    }

    static func target(for title: String, object: String, notionObject: [String: NotionJSONValue] = [:]) -> String {
        let key = normalizedTitle(title)?.lowercased() ?? ""
        if object == "page" {
            if isDatabaseRow(notionObject) { return "Database row" }
            switch key {
            case "gem.personal", "gem personal": return "Hub"
            case "forgekeeper", "career", "family", "interests": return "Domain"
            default:
                return "ForgeKeeper"
            }
        }
        switch key {
        case "service expense tracker": return "Services"
        case "budget (archive)", "budget": return "Transactions / Categories"
        case "employment", "employment database": return "Employment"
        case "education", "education db": return "Education"
        default: return "Review required"
        }
    }
}

/// Allocates unmapped data-source targets once for preview and execution. Existing mappings
/// are stored in NotionImportReferences with recordID `__table__`.
enum NotionImportTableAllocator {
    static func allocate(
        dataSources: [NotionJSONValue], database: any Database, hubID: String, excluding: Set<String> = []
    ) async throws -> [String: String] {
        let schema = try await LiveSchemaService(database: database).inspect()
        let existingNames = Set(schema.tables.map { $0.name.lowercased() })
        let references = try await NotionImportReference.query(on: database)
            .filter(\.$hubID == hubID).all()
        var persisted: [String: String] = [:]
        for reference in references where reference.recordID == "__table__" {
            persisted[reference.notionPageID] = reference.tableName
        }
        var allocated: Set<String> = []
        var result: [String: String] = [:]
        let builtin: [String: String] = [
            "service expense tracker": ServiceAccount.schema,
            "budget": ExpenseTransaction.schema, "budget (archive)": ExpenseTransaction.schema,
            "employment": Employment.schema, "employment database": Employment.schema,
            "education": Education.schema, "education db": Education.schema,
        ]
        for source in dataSources.sorted(by: { ($0.objectValue?["id"]?.stringValue ?? "") < ($1.objectValue?["id"]?.stringValue ?? "") }) {
            guard let object = source.objectValue, let id = object["id"]?.stringValue, !excluding.contains(id) else { continue }
            let title = NotionImportPreviewService.title(from: object)
            if let mapped = builtin[title.lowercased()] { result[id] = mapped; continue }
            if let prior = persisted[id] { result[id] = prior; continue }
            let base = NotionImportExecutionService.customTableName(title)
            var candidate = base
            var suffix = 2
            while existingNames.contains(candidate.lowercased()) || allocated.contains(candidate.lowercased()) {
                candidate = "\(base)\(suffix)"
                suffix += 1
            }
            allocated.insert(candidate.lowercased())
            result[id] = candidate
        }
        return result
    }
}
