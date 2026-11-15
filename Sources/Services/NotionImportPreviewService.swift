import Foundation
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
    let resources: [NotionImportPreviewResource]
    let totalRows: Int
    let unmappedProperties: [String]
    let warnings: [String]
}

/// Reads every page and data source visible to the configured integration and
/// produces a no-write mapping report. Each API collection is fully paginated.
struct NotionImportPreviewService: Sendable {
    let api: NotionAPIClient

    func preview() async throws -> NotionImportPreviewResponse {
        async let pageResults = api.searchAll(kind: "page")
        async let sourceResults = api.searchAll(kind: "data_source")
        let (pages, dataSources) = try await (pageResults, sourceResults)

        var resources: [NotionImportPreviewResource] = []
        for page in pages {
            guard let object = page.objectValue else { continue }
            let title = Self.title(from: object)
            let target = Self.target(for: title, object: "page")
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
            let properties = Self.properties(from: object["properties"])
            let rows = try await api.queryDataSourceAll(object["id"]?.stringValue ?? "")
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
            resources: resources,
            totalRows: resources.reduce(0) { $0 + $1.rowCount },
            unmappedProperties: unmapped,
            warnings: [
                "This preview is read-only. It does not modify GemLife or Notion.",
                "Pages are listed individually; child blocks, file downloads, and relation targets require review before import.",
                "Unsupported properties and unknown targets must be resolved before an import can be approved.",
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

    private static func properties(from value: NotionJSONValue?) -> [NotionImportPreviewProperty] {
        guard let values = value?.objectValue else { return [] }
        return values.keys.sorted().map { name in
            let property = values[name]?.objectValue ?? [:]
            let type = property["type"]?.stringValue ?? "unknown"
            let mapped = NotionImportValueMapper.propertyType(type)
            return .init(
                name: name,
                notionType: type,
                proposedStorage: mapped.storage.rawValue,
                requiresReview: mapped.requiresReview
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

    private static func target(for title: String, object: String) -> String {
        let key = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if object == "page" {
            switch key {
            case "gem.personal", "gem personal": return "Hub"
            case "forgekeeper", "career", "family", "interests": return "Domain"
            case "home", "auto", "health & wellness", "beauty", "journals", "finances", "faith", "life manual":
                return "ForgeKeeper"
            default: return "Review required"
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
