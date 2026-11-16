import Foundation
import Crypto
import Fluent
import SQLKit
import Vapor

enum NotionImportExecutionError: Error, CustomStringConvertible {
    case confirmationRequired
    case previewExpired
    case previewChanged
    case backupNotConfigured
    case sourceMapUnavailable

    var description: String {
        switch self {
        case .confirmationRequired: return "Set confirmImport to true after reviewing the preview."
        case .previewExpired: return "The preview expired or belongs to another Hub. Create a fresh preview."
        case .previewChanged: return "The Notion workspace changed after preview. Create and review a fresh preview."
        case .backupNotConfigured: return "A configured, verified SQLite backup is required before importing."
        case .sourceMapUnavailable: return "The Notion import identity table is not installed. Apply its reviewed migration before importing."
        }
    }
}

/// Verifies the preview, creates a SQLite backup, and applies the explicitly
/// approved snapshot. The import is one-way and never calls a Notion write API.
struct NotionImportExecutionService: Sendable {
    let api: NotionAPIClient
    let database: any Database
    let hubID: String
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    static func customTableName(_ title: String) -> String {
        let folded = title.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        let words = folded.split(whereSeparator: { !$0.isASCII || (!$0.isLetter && !$0.isNumber) })
        var value = words.map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
        value = String(value.filter(\.isASCII).prefix(TableBuilderContractService.maximumIdentifierLength))
        if value.first?.isNumber == true { value = "Table" + String(value.prefix(TableBuilderContractService.maximumIdentifierLength - 5)) }
        return value.isEmpty ? "Untitled" : value
    }

    static func allocateTargets(
        for snapshot: NotionImportSnapshot, database: any Database, hubID: String, excluding: Set<String> = []
    ) async throws -> [String: String] {
        try await NotionImportTableAllocator.allocate(
            dataSources: snapshot.dataSources, database: database, hubID: hubID, excluding: excluding
        )
    }

    func execute(_ request: NotionImportCommitRequest) async throws -> NotionImportCommitResponse {
        guard request.confirmImport else { throw NotionImportExecutionError.confirmationRequired }
        guard let expectedFingerprint = await NotionImportApprovals.shared.consume(
            token: request.confirmationToken, hubID: hubID
        ) else { throw NotionImportExecutionError.previewExpired }

        let previewService = NotionImportPreviewService(api: api, database: database, hubID: hubID)
        let snapshot = try await previewService.refreshedSnapshot()
        guard snapshot.fingerprint == expectedFingerprint else {
            throw NotionImportExecutionError.previewChanged
        }
        guard let backupConfiguration else { throw NotionImportExecutionError.backupNotConfigured }
        guard database is SQLDatabase,
              try await LiveSchemaService(database: database).inspect().tables.contains(where: {
                  $0.name == NotionImportReference.schema
              }) else { throw NotionImportExecutionError.sourceMapUnavailable }

        let backup = try await LiveDatabaseBackupService(configuration: backupConfiguration).createBackup(using: database)
        return try await NotionImportWriter(
            api: api, database: database, hubID: hubID, backup: backup,
            backupConfiguration: backupConfiguration
        ).run(snapshot, excluding: Set(request.excludedNotionIDs))
    }
}

struct NotionImportWriter: Sendable {
    let api: NotionAPIClient
    let database: any Database
    let hubID: String
    let backup: LiveDatabaseBackupResult
    let backupConfiguration: LiveDatabaseBackupConfiguration?

    func run(_ snapshot: NotionImportSnapshot, excluding excluded: Set<String>) async throws -> NotionImportCommitResponse {
        var rows: [NotionImportRowResult] = []
        var unmapped: [String] = Self.unmappedProperties(snapshot)

        let hub = try await Hub.find(hubID, on: database)
        guard let hub else { throw Abort(.unauthorized, reason: "The authenticated Hub is unavailable.") }
        let targets = try await NotionImportExecutionService.allocateTargets(
            for: snapshot, database: database, hubID: hubID, excluding: excluded
        )
        let tableMap = try await prepareCustomTables(snapshot.dataSources, targets: targets, excluding: excluded)

        let pageObjects = snapshot.pages.compactMap(\.objectValue)
            .filter { !NotionImportPreviewService.isDatabaseRow($0) }
        let domains = pageObjects.filter { object in
            NotionImportPreviewService.target(
                for: Self.title(object), object: "page", notionObject: object
            ) == "Domain"
        }
        for object in domains {
            let id = object["id"]?.stringValue ?? ""
            let title = Self.title(object)
            if excluded.contains(id) {
                rows.append(.init(notionID: id, title: title, target: "Domains", result: "skipped", recordID: nil, reason: "Excluded in the approved import request."))
                continue
            }
            do {
                let wasImported = try await existingReference(id, on: database) != nil
                let recordID = try await importDomain(object, hub: hub)
                rows.append(.init(notionID: id, title: title, target: "Domains", result: wasImported ? "updated" : "created", recordID: recordID, reason: nil))
            } catch {
                rows.append(.init(notionID: id, title: title, target: "Domains", result: "failed", recordID: nil, reason: Self.safeReason(error)))
            }
        }

        let forgeKeeperPages = pageObjects.filter { object in
            NotionImportPreviewService.target(
                for: Self.title(object), object: "page", notionObject: object
            ) == "ForgeKeeper"
        }.sorted { Self.depth(of: $0, pages: pageObjects) < Self.depth(of: $1, pages: pageObjects) }
        for object in forgeKeeperPages {
            let id = object["id"]?.stringValue ?? ""
            let title = Self.title(object)
            if excluded.contains(id) {
                rows.append(.init(notionID: id, title: title, target: "ForgeKeeper", result: "skipped", recordID: nil, reason: "Excluded in the approved import request."))
                continue
            }
            do {
                let wasImported = try await existingReference(id, on: database) != nil
                let recordID = try await importForgeKeeper(object, pages: pageObjects)
                unmapped.append(contentsOf: try await importBodyAndPresentation(object, tableName: "ForgeKeeper", recordID: recordID))
                rows.append(.init(notionID: id, title: title, target: "ForgeKeeper", result: wasImported ? "updated" : "created", recordID: recordID, reason: nil))
            } catch {
                rows.append(.init(notionID: id, title: title, target: "ForgeKeeper", result: "failed", recordID: nil, reason: Self.safeReason(error)))
            }
        }

        for source in snapshot.dataSources where source.objectValue?["id"]?.stringValue.map({ !excluded.contains($0) }) ?? true {
            guard let sourceObject = source.objectValue,
                  let sourceID = sourceObject["id"]?.stringValue else { continue }
            let sourceTitle = Self.title(sourceObject)
            guard let baseTarget = targets[sourceID] else {
                for rowValue in snapshot.rowsByDataSourceID[sourceID] ?? [] {
                    guard let object = rowValue.objectValue else { continue }
                    rows.append(.init(notionID: object["id"]?.stringValue ?? "", title: Self.title(object), target: "Review required", result: "skipped", recordID: nil, reason: "No target table mapping exists."))
                }
                continue
            }
            let sourceRows = (snapshot.rowsByDataSourceID[sourceID] ?? []).sorted { lhs, rhs in
                guard sourceTitle.lowercased().hasPrefix("budget") else { return false }
                let left = lhs.objectValue.map(Self.budgetTarget) ?? ExpenseTransaction.schema
                let right = rhs.objectValue.map(Self.budgetTarget) ?? ExpenseTransaction.schema
                let order = [ExpenseCategory.schema: 0, ExpenseSubcategory.schema: 1, ExpenseTransaction.schema: 2]
                return (order[left] ?? 3) < (order[right] ?? 3)
            }
            for rowValue in sourceRows {
                guard let object = rowValue.objectValue,
                      let notionID = object["id"]?.stringValue else { continue }
                let title = Self.title(object)
                let target = sourceTitle.lowercased().hasPrefix("budget")
                    ? Self.budgetTarget(for: object) : baseTarget
                if excluded.contains(notionID) {
                    rows.append(.init(notionID: notionID, title: title, target: target, result: "skipped", recordID: nil, reason: "Excluded in the approved import request."))
                    continue
                }
                do {
                    let schema: LiveSchemaTableResponse
                    if let prepared = tableMap[target] { schema = prepared }
                    else { schema = try await schemaTable(target) }
                    let wasImported = try await existingReference(notionID, on: database) != nil
                    let recordID = try await importDatabaseRow(
                        object, targetTable: target, schema: schema
                    )
                    unmapped.append(contentsOf: try await importFiles(object, tableName: target, recordID: recordID, schema: schema))
                    unmapped.append(contentsOf: try await importBodyAndPresentation(object, tableName: target, recordID: recordID))
                    rows.append(.init(notionID: notionID, title: title, target: target, result: wasImported ? "updated" : "created", recordID: recordID, reason: nil))
                } catch {
                    rows.append(.init(notionID: notionID, title: title, target: target, result: "failed", recordID: nil, reason: Self.safeReason(error)))
                }
            }
        }

        unmapped.append(contentsOf: try await resolveRelationValues(snapshot, targets: targets))
        unmapped.append(contentsOf: try await installPropertyMetadata(snapshot, targets: targets))

        let skippedPages = pageObjects.filter {
            let target = NotionImportPreviewService.target(for: Self.title($0), object: "page", notionObject: $0)
            return target == "Review required" || target == "Hub"
        }
        for object in skippedPages {
            let id = object["id"]?.stringValue ?? ""
            let title = Self.title(object)
            if excluded.contains(id) || NotionImportPreviewService.target(for: title, object: "page", notionObject: object) == "Review required" {
                rows.append(.init(notionID: id, title: title, target: "Review required", result: "skipped", recordID: nil, reason: "No approved target mapping exists."))
            } else {
                rows.append(.init(notionID: id, title: title, target: "Hub", result: "skipped", recordID: hubID, reason: "The authenticated Hub already exists; its name and account ownership are unchanged."))
                try await saveReference(notionID: id, tableName: Hub.schema, recordID: hubID, on: database)
            }
        }

        let counts = Dictionary(grouping: rows, by: \.result)
        return NotionImportCommitResponse(
            status: "completed-with-report",
            backupFileName: backup.backupFileName,
            backupSizeBytes: backup.backupSizeBytes,
            created: counts["created"]?.count ?? 0,
            updated: counts["updated"]?.count ?? 0,
            skipped: counts["skipped"]?.count ?? 0,
            failed: counts["failed"]?.count ?? 0,
            unmappedProperties: unmapped,
            rows: rows
        )
    }

    private func importDomain(_ object: [String: NotionJSONValue], hub _: Hub) async throws -> String {
        guard let notionID = object["id"]?.stringValue else { throw Abort(.badRequest, reason: "A Notion page ID is missing.") }
        return try await database.transaction { transaction in
            if let existing = try await existingReference(notionID, on: transaction) { return existing.recordID }
            let title = Self.title(object)
            let domain = try await Domain.query(on: transaction).filter(\.$title == title).first()
                ?? Domain(id: "NOTION-\(notionID)", title: title, description: "Imported from Notion.")
            try await domain.save(on: transaction)
            guard let recordID = domain.id else { throw Abort(.internalServerError, reason: "Domain ID was not generated.") }
            try await saveReference(notionID: notionID, tableName: Domain.schema, recordID: recordID, on: transaction)
            return recordID
        }
    }

    private func importForgeKeeper(_ object: [String: NotionJSONValue], pages: [[String: NotionJSONValue]]) async throws -> String {
        guard let notionID = object["id"]?.stringValue else { throw Abort(.badRequest, reason: "A Notion page ID is missing.") }
        return try await database.transaction { transaction in
            if let existing = try await existingReference(notionID, on: transaction) { return existing.recordID }
            let (domainID, parentID) = try await hierarchyIDs(for: object, pages: pages, on: transaction)
            let model = ForgeKeeper(parentID: parentID, domainID: domainID, title: Self.title(object), description: "")
            model.hubID = hubID
            try await model.save(on: transaction)
            guard let recordID = model.id.map(String.init) else { throw Abort(.internalServerError, reason: "ForgeKeeper ID was not generated.") }
            try await saveReference(notionID: notionID, tableName: ForgeKeeper.schema, recordID: recordID, on: transaction)
            return recordID
        }
    }

    private func hierarchyIDs(for object: [String: NotionJSONValue], pages: [[String: NotionJSONValue]], on database: any Database) async throws -> (String, Int?) {
        let parentNotionID = object["parent"]?.objectValue?["page_id"]?.stringValue
        var parentRecordID: Int?
        if let parentNotionID, let reference = try await existingReference(parentNotionID, on: database), reference.tableName == ForgeKeeper.schema {
            parentRecordID = Int(reference.recordID)
        }
        var currentParentID = parentNotionID
        var seen: Set<String> = []
        while let pageID = currentParentID, seen.insert(pageID).inserted,
              let parentPage = pages.first(where: { $0["id"]?.stringValue == pageID }) {
            if NotionImportPreviewService.target(for: Self.title(parentPage), object: "page", notionObject: parentPage) == "Domain",
               let reference = try await existingReference(pageID, on: database) {
                return (reference.recordID, parentRecordID)
            }
            currentParentID = parentPage["parent"]?.objectValue?["page_id"]?.stringValue
        }
        guard let pageID = parentNotionID,
              let parent = pages.first(where: { $0["id"]?.stringValue == pageID }),
              let domainID = try await domainAncestorID(of: parent, pages: pages, on: database) else {
            throw Abort(.unprocessableEntity, reason: "ForgeKeeper page \(Self.title(object)) has no mapped Domain ancestor.")
        }
        return (domainID, parentRecordID)
    }

    private func domainAncestorID(of object: [String: NotionJSONValue], pages: [[String: NotionJSONValue]], on database: any Database) async throws -> String? {
        let target = NotionImportPreviewService.target(for: Self.title(object), object: "page", notionObject: object)
        if target == "Domain", let notionID = object["id"]?.stringValue,
           let reference = try await existingReference(notionID, on: database) {
            return reference.recordID
        }
        guard let parentID = object["parent"]?.objectValue?["page_id"]?.stringValue,
              let parent = pages.first(where: { $0["id"]?.stringValue == parentID }) else { return nil }
        return try await domainAncestorID(of: parent, pages: pages, on: database)
    }

    private func importDatabaseRow(
        _ object: [String: NotionJSONValue],
        targetTable: String,
        schema: LiveSchemaTableResponse
    ) async throws -> String {
        guard let notionID = object["id"]?.stringValue else { throw Abort(.badRequest, reason: "A Notion row ID is missing.") }
        return try await database.transaction { transaction in
            if let existing = try await existingReference(notionID, on: transaction) {
                try await updateRow(object, tableName: targetTable, schema: schema, recordID: existing.recordID, on: transaction)
                return existing.recordID
            }
            let recordID = try await insertRow(object, tableName: targetTable, schema: schema, on: transaction)
            try await saveReference(notionID: notionID, tableName: targetTable, recordID: recordID, on: transaction)
            return recordID
        }
    }

    private func insertRow(_ object: [String: NotionJSONValue], tableName: String, schema: LiveSchemaTableResponse, on database: any Database) async throws -> String {
        guard let sql = database as? SQLDatabase,
              let primaryKey = schema.columns.first(where: \.primaryKey) else { throw Abort(.serviceUnavailable) }
        var values = mappedValues(object, schema: schema)
        if schema.columns.contains(where: { $0.name == "CategoryID" }) {
            values["CategoryID"] = .integer(try await resolveCategoryID(object, on: database))
        }
        values["HubID"] = .text(hubID)
        if primaryKey.dataType.uppercased().contains("INT") == false {
            values[primaryKey.name] = .text(UUID().uuidString)
        }
        try validateRequired(values, schema: schema)
        let columns = schema.columns.filter { values[$0.name] != nil && !(primaryKey.dataType.uppercased().contains("INT") && $0.name == primaryKey.name) }
        var query = SQLQueryString("INSERT INTO \(ident: tableName) (")
        for (index, column) in columns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            query.appendInterpolation(ident: column.name)
        }
        query.appendInterpolation(unsafeRaw: ") VALUES (")
        for (index, column) in columns.enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            append(values[column.name]!, to: &query)
        }
        query.appendInterpolation(unsafeRaw: ")")
        try await sql.raw(query).run()
        if primaryKey.dataType.uppercased().contains("INT") {
            guard let row = try await sql.raw("SELECT last_insert_rowid() AS id").first() else { throw Abort(.internalServerError) }
            return String(try row.decode(column: "id", as: Int64.self))
        }
        return values[primaryKey.name]?.string ?? ""
    }

    private func updateRow(_ object: [String: NotionJSONValue], tableName: String, schema: LiveSchemaTableResponse, recordID: String, on database: any Database) async throws {
        guard let sql = database as? SQLDatabase, let primaryKey = schema.columns.first(where: \.primaryKey) else { throw Abort(.serviceUnavailable) }
        var values = mappedValues(object, schema: schema)
        if schema.columns.contains(where: { $0.name == "CategoryID" }) {
            values["CategoryID"] = .integer(try await resolveCategoryID(object, on: database))
        }
        guard !values.isEmpty else { return }
        var query = SQLQueryString("UPDATE \(ident: tableName) SET ")
        for (index, pair) in values.sorted(by: { $0.key < $1.key }).enumerated() {
            if index > 0 { query.appendInterpolation(unsafeRaw: ", ") }
            query.appendInterpolation(ident: pair.key)
            query.appendInterpolation(unsafeRaw: " = ")
            append(pair.value, to: &query)
        }
        query.appendInterpolation(unsafeRaw: " WHERE ")
        query.appendInterpolation(ident: primaryKey.name)
        query.appendInterpolation(unsafeRaw: " = ")
        append(primaryKey.dataType.uppercased().contains("INT") ? .integer(Int64(recordID) ?? -1) : .text(recordID), to: &query)
        if schema.columns.contains(where: { $0.name == "HubID" }) {
            query.appendInterpolation(unsafeRaw: " AND \"HubID\" = ")
            query.appendInterpolation(bind: hubID)
        }
        try await sql.raw(query).run()
    }

    private func mappedValues(_ object: [String: NotionJSONValue], schema: LiveSchemaTableResponse) -> [String: ImportScalar] {
        let columns = Dictionary(schema.columns.map { (Self.normalized($0.name), $0.name) }, uniquingKeysWith: { first, _ in first })
        var values: [String: ImportScalar] = [:]
        let title = Self.title(object)
        if let titleColumn = columns["title"] ?? columns["service"] ?? columns["item"]
            ?? columns["institutionname"] ?? columns["employername"] ?? columns["positiontitle"]
            ?? columns["subcategory"] ?? columns["category"] {
            values[titleColumn] = .text(title)
        }
        let properties = object["properties"]?.objectValue ?? [:]
        let importedNames = Self.normalizedPropertyNames(properties)
        for (name, property) in properties {
            let rawType = property.objectValue?["type"]?.stringValue ?? "unknown"
            if rawType == "relation" || rawType == "rollup" { continue }
            let key = Self.normalized(importedNames[name] ?? Self.normalizedColumn(name))
            let scalar = Self.scalar(property, type: rawType)
            guard let scalar else { continue }
            if key == "duedate", case let .text(label) = scalar,
               let mapped = NotionImportValueMapper.dueDate(label) {
                if let due = columns["due"] { values[due] = .text(String(mapped.day)) }
                if let occurrence = columns["occurrence"] { values[occurrence] = .text(mapped.occurrence) }
                continue
            }
            let normalizedKey: String
            switch key {
            case "start": normalizedKey = "startdate"
            case "end": normalizedKey = "enddate"
            case "createdtime": normalizedKey = "createdat"
            case "lasteditedtime": normalizedKey = "updatedat"
            default: normalizedKey = key
            }
            guard let column = columns[normalizedKey], !schema.columns.first(where: { $0.name == column })!.primaryKey,
                  column != "HubID" else { continue }
            if NotionImportValueMapper.isAccountLike(name) || NotionImportValueMapper.isAccountLike(column) {
                guard let protected = NotionImportValueMapper.protectedAccountScalar(scalar) else { continue }
                values[column] = protected
            } else {
                values[column] = scalar
            }
        }
        if schema.columns.contains(where: { $0.name == "NotionPage" }), let url = object["url"]?.stringValue {
            values["NotionPage"] = .text(url)
        }
        for (column, fallback) in [
            ("FirstReceiptItem", ImportScalar.bool(false)), ("Quantity", .number(1)),
            ("EmployerType", .text("Organization")), ("EmploymentType", .text("Employee")),
            ("EmploymentStatus", .text("Imported")), ("EducationType", .text("Education")),
            ("Status", .text("Imported")),
        ] where schema.columns.contains(where: { $0.name == column }) && values[column] == nil {
            values[column] = fallback
        }
        return values
    }

    private func validateRequired(_ values: [String: ImportScalar], schema: LiveSchemaTableResponse) throws {
        for column in schema.columns where !column.nullable && column.defaultValue == nil && !column.primaryKey {
            guard values[column.name] != nil else { throw Abort(.unprocessableEntity, reason: "Required target field \(column.name) is missing from the Notion row.") }
        }
    }

    private func resolveCategoryID(_ object: [String: NotionJSONValue], on database: any Database) async throws -> Int64 {
        let properties = object["properties"]?.objectValue ?? [:]
        guard let categoryProperty = properties.first(where: { Self.normalized($0.key) == "category" })?.value,
              let scalar = Self.scalar(categoryProperty, type: categoryProperty.objectValue?["type"]?.stringValue ?? "unknown"),
              case let .text(rawValue) = scalar, !rawValue.isEmpty else {
            throw Abort(.unprocessableEntity, reason: "The Budget row has no resolvable Category value.")
        }
        if let reference = try await existingReference(rawValue, on: database),
           reference.tableName == ExpenseCategory.schema,
           let id = Int64(reference.recordID) { return id }

        if let existing = try await ExpenseCategory.query(on: database)
            .filter(\.$hubID == hubID).filter(\.$name == rawValue).first(), let id = existing.id {
            return Int64(id)
        }
        let category = ExpenseCategory(name: rawValue)
        category.hubID = hubID
        try await category.save(on: database)
        guard let id = category.id else { throw Abort(.internalServerError, reason: "A Budget category ID was not generated.") }
        return Int64(id)
    }

    private func schemaTable(_ name: String) async throws -> LiveSchemaTableResponse {
        guard let table = try await LiveSchemaService(database: database).inspect().tables.first(where: { $0.name == name }) else {
            throw Abort(.unprocessableEntity, reason: "The target table \(name) is not available.")
        }
        return table
    }

    private func existingReference(_ notionID: String, on database: any Database) async throws -> NotionImportReference? {
        try await NotionImportReference.query(on: database)
            .filter(\.$hubID == hubID)
            .filter(\.$notionPageID == notionID)
            .first()
    }

    private func saveReference(notionID: String, tableName: String, recordID: String, on database: any Database) async throws {
        let reference = try await existingReference(notionID, on: database)
            ?? NotionImportReference(hubID: hubID, notionPageID: notionID, tableName: tableName, recordID: recordID)
        reference.tableName = tableName
        reference.recordID = recordID
        try await reference.save(on: database)
    }

    private func importBodyAndPresentation(_ object: [String: NotionJSONValue], tableName: String, recordID: String) async throws -> [String] {
        guard let notionID = object["id"]?.stringValue else { return [] }
        let blocks = try await api.childrenRecursively(of: notionID)
        let converted = NotionImportValueMapper.markdown(blocks: blocks)
        if !converted.markdown.isEmpty {
            let body = try await RecordBody.query(on: database)
                .filter(\.$hubID == hubID).filter(\.$tableName == tableName).filter(\.$recordID == recordID).first()
                ?? RecordBody(hubID: hubID, tableName: tableName, recordID: recordID)
            body.markdown = converted.markdown
            body.revision += 1
            try await body.save(on: database)
        }
        let presentation = Self.presentationJSON(object)
        if let presentation {
            let model = try await RecordPresentation.query(on: database)
                .filter(\.$hubID == hubID).filter(\.$tableName == tableName).filter(\.$recordID == recordID).first()
                ?? RecordPresentation(hubID: hubID, tableName: tableName, recordID: recordID, presentation: presentation)
            model.presentation = presentation
            try await model.save(on: database)
        }
        return converted.unmappedTypes.map { "\(Self.title(object)): block type \($0) was not imported" }
    }

    private func importFiles(
        _ object: [String: NotionJSONValue],
        tableName: String,
        recordID: String,
        schema: LiveSchemaTableResponse
    ) async throws -> [String] {
        let properties = object["properties"]?.objectValue ?? [:]
        let fileProperties = properties.filter { $0.value.objectValue?["type"]?.stringValue == "files" }
        guard !fileProperties.isEmpty else { return [] }
        guard let directory = LocalImageUploadConfiguration.fromEnvironment().directory else {
            throw Abort(.serviceUnavailable, reason: "ASSET_DIRECTORY must be configured to import Notion files.")
        }
        guard let notionID = object["id"]?.stringValue else { throw Abort(.badRequest) }
        let maximumBytes = LocalImageUploadConfiguration.fromEnvironment().maxBytes
        var unmapped: [String] = []
        for (propertyName, property) in fileProperties {
            let column = schema.columns.first { Self.normalized($0.name) == Self.normalized(propertyName) }
            let files = property.objectValue?["files"]?.arrayValue ?? []
            var fileIDs: [String] = []
            for file in files {
                guard let fileObject = file.objectValue,
                      fileObject["type"]?.stringValue == "file",
                      let hostedFile = fileObject["file"]?.objectValue,
                      let url = hostedFile["url"]?.stringValue else {
                    unmapped.append("\(Self.title(object)): \(propertyName) external attachment was not downloaded")
                    continue
                }
                let (data, mimeType) = try await api.downloadHostedFile(url: url, maximumBytes: maximumBytes)
                let originalName = fileObject["name"]?.stringValue ?? "notion-attachment"
                let safeName = URL(fileURLWithPath: originalName).lastPathComponent
                let fileID = UUID().uuidString
                let extensionName = URL(fileURLWithPath: safeName).pathExtension
                    .lowercased().filter { $0.isLetter || $0.isNumber }.prefix(10)
                let storedName = extensionName.isEmpty ? "bin" : String(extensionName)
                let relativePath = "uploads/\(fileID).\(storedName)"
                let uploadDirectory = URL(fileURLWithPath: directory).appendingPathComponent("uploads", isDirectory: true)
                try FileManager.default.createDirectory(at: uploadDirectory, withIntermediateDirectories: true)
                let destination = uploadDirectory.appendingPathComponent("\(fileID).\(storedName)")
                do {
                    try data.write(to: destination, options: .atomic)
                    let metadata = FileMetadata(
                        id: fileID,
                        relativePath: relativePath,
                        fileName: safeName,
                        fileKind: "notion-import",
                        mimeType: mimeType,
                        byteSize: data.count,
                        checksum: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(),
                        ownerType: "NotionImport.\(tableName).\(propertyName)",
                        ownerID: recordID
                    )
                    metadata.hubID = hubID
                    try await metadata.save(on: database)
                    fileIDs.append(fileID)
                } catch {
                    try? FileManager.default.removeItem(at: destination)
                    throw error
                }
            }
            if let column, !fileIDs.isEmpty {
                try await updateColumn(
                    tableName: tableName,
                    columnName: column.name,
                    recordID: recordID,
                    value: fileIDs.joined(separator: ";"),
                    schema: schema
                )
            } else if !fileIDs.isEmpty {
                unmapped.append("\(Self.title(object)): \(propertyName) has no matching GemLife file column")
            }
        }
        _ = notionID
        return unmapped
    }

    private func updateColumn(
        tableName: String,
        columnName: String,
        recordID: String,
        value: String,
        schema: LiveSchemaTableResponse
    ) async throws {
        guard let sql = database as? SQLDatabase,
              let primaryKey = schema.columns.first(where: \.primaryKey) else { throw Abort(.serviceUnavailable) }
        var query = SQLQueryString("UPDATE \(ident: tableName) SET \(ident: columnName) = \(bind: value) WHERE \(ident: primaryKey.name) = ")
        if primaryKey.dataType.uppercased().contains("INT") {
            guard let id = Int64(recordID) else { throw Abort(.unprocessableEntity, reason: "The target record ID is invalid.") }
            query.appendInterpolation(bind: id)
        } else { query.appendInterpolation(bind: recordID) }
        if schema.columns.contains(where: { $0.name == "HubID" }) {
            query.appendInterpolation(unsafeRaw: " AND \"HubID\" = ")
            query.appendInterpolation(bind: hubID)
        }
        try await sql.raw(query).run()
    }

    private func resolveRelationValues(_ snapshot: NotionImportSnapshot, targets: [String: String]) async throws -> [String] {
        var unmapped: [String] = []
        for source in snapshot.dataSources {
            guard let sourceObject = source.objectValue,
                  let sourceID = sourceObject["id"]?.stringValue,
                  let tableName = targets[sourceID] else { continue }
            let sourceTitle = Self.title(sourceObject)
            let sourceRows = snapshot.rowsByDataSourceID[sourceID] ?? []
            for row in sourceRows {
                guard let object = row.objectValue,
                      let notionID = object["id"]?.stringValue,
                      let reference = try await existingReference(notionID, on: database) else { continue }
                let rowTable = sourceTitle.lowercased().hasPrefix("budget")
                    ? Self.budgetTarget(for: object) : tableName
                guard reference.tableName == rowTable,
                      let rowSchema = try? await schemaTable(rowTable) else { continue }
                let properties = object["properties"]?.objectValue ?? [:]
                for (propertyName, property) in properties where property.objectValue?["type"]?.stringValue == "relation" {
                    let ids = property.objectValue?["relation"]?.arrayValue?.compactMap { $0.objectValue?["id"]?.stringValue } ?? []
                    guard ids.count == 1,
                          let targetReference = try await existingReference(ids[0], on: database),
                          let column = rowSchema.columns.first(where: { Self.normalized($0.name) == Self.normalized(propertyName) }) else {
                        unmapped.append("\(Self.title(object)): \(propertyName) relation needs review")
                        continue
                    }
                    try await updateColumn(tableName: rowTable, columnName: column.name, recordID: reference.recordID, value: targetReference.recordID, schema: rowSchema)
                }
            }
        }
        return unmapped
    }

    private func installPropertyMetadata(_ snapshot: NotionImportSnapshot, targets: [String: String]) async throws -> [String] {
        var unmapped: [String] = []
        let tablesBySourceID = Dictionary(uniqueKeysWithValues: snapshot.dataSources.compactMap { value -> (String, String)? in
            guard let object = value.objectValue,
                  let id = object["id"]?.stringValue,
                  let table = targets[id] else { return nil }
            return (id, table)
        })
        for source in snapshot.dataSources {
            guard let sourceObject = source.objectValue,
                  let sourceTitle = sourceObject["title"]?.arrayValue?.compactMap({ $0.objectValue?["plain_text"]?.stringValue }).joined(),
                  let tableName = targets[sourceObject["id"]?.stringValue ?? ""],
                  let rawProperties = sourceObject["properties"]?.objectValue else { continue }
            let sourceSchema: LiveSchemaTableResponse
            do { sourceSchema = try await schemaTable(tableName) }
            catch { continue }

            for (propertyName, property) in rawProperties {
                let type = property.objectValue?["type"]?.stringValue ?? "unknown"
                guard let column = sourceSchema.columns.first(where: { Self.normalized($0.name) == Self.normalized(propertyName) }) else { continue }
                if let columnType: TableColumnPropertyType = switch type {
                    case "select": .select
                    case "multi_select": .multiSelect
                    case "status": .status
                    default: nil
                } {
                    let optionContainer = property.objectValue?[type]?.objectValue ?? [:]
                    let options = optionContainer["options"]?.arrayValue?.compactMap { $0.objectValue?["name"]?.stringValue }
                        ?? optionContainer["groups"]?.arrayValue?.flatMap { $0.objectValue?["options"]?.arrayValue ?? [] }
                            .compactMap { $0.objectValue?["name"]?.stringValue }
                        ?? []
                    let request = TableColumnDefinitionRequest(
                        propertyType: columnType,
                        options: options.map { TableColumnOption(value: $0, color: nil) }
                    )
                    do { _ = try await TableColumnDefinitionService(database: database, hubID: hubID).save(tableName: tableName, columnName: column.name, input: request) }
                    catch { unmapped.append("\(sourceTitle): \(propertyName) options need review") }
                }
            }

            let relations = rawProperties.filter { $0.value.objectValue?["type"]?.stringValue == "relation" }
            guard !relations.isEmpty else { continue }
            do {
                _ = try await SchemaPageService(database: database, hubID: hubID).createPage(tableName: tableName)
                var requests = try await TablePropertyService(database: database, hubID: hubID).definitions(tableName: tableName).map { saved in
                    TablePropertyDefinitionRequest(
                        id: saved.id, name: saved.name, kind: saved.kind,
                        sourceColumnName: saved.sourceColumnName, targetTableName: saved.targetTableName,
                        targetKeyColumnName: saved.targetKeyColumnName, targetDisplayColumnName: saved.targetDisplayColumnName,
                        relationDefinitionID: saved.relationDefinitionID, targetColumnName: saved.targetColumnName,
                        filterByDefinitionID: saved.filterByDefinitionID, targetFilterColumnName: saved.targetFilterColumnName
                    )
                }
                var relationIDs: [String: String] = [:]
                for (name, property) in relations {
                    let relation = property.objectValue?["relation"]?.objectValue ?? [:]
                    let targetID = relation["data_source_id"]?.stringValue ?? relation["database_id"]?.stringValue
                    guard let targetID, let targetTable = tablesBySourceID[targetID],
                          let sourceColumn = sourceSchema.columns.first(where: { Self.normalized($0.name) == Self.normalized(name) }),
                          let targetSchema = try? await schemaTable(targetTable),
                          let key = targetSchema.columns.first(where: \.primaryKey),
                          let display = Self.displayColumn(in: targetSchema) else {
                        unmapped.append("\(sourceTitle): \(name) relation target is not mapped")
                        continue
                    }
                    _ = try await SchemaPageService(database: database, hubID: hubID).createPage(tableName: targetTable)
                    let id = UUID().uuidString
                    relationIDs[name] = id
                    requests.append(TablePropertyDefinitionRequest(
                        id: id, name: name, kind: .relation,
                        sourceColumnName: sourceColumn.name, targetTableName: targetTable,
                        targetKeyColumnName: key.name, targetDisplayColumnName: display.name,
                        relationDefinitionID: nil, targetColumnName: nil,
                        filterByDefinitionID: nil, targetFilterColumnName: nil
                    ))
                }
                for (name, property) in rawProperties where property.objectValue?["type"]?.stringValue == "rollup" {
                    let rollup = property.objectValue?["rollup"]?.objectValue ?? [:]
                    guard rollup["function"]?.stringValue == "show_original" else {
                        unmapped.append("\(sourceTitle): \(name) rollup aggregation is not supported by GemLife lookups")
                        continue
                    }
                    let relationName = rollup["relation_property_name"]?.stringValue
                    let targetColumn = rollup["rollup_property_name"]?.stringValue
                    guard let relationName, let relationID = relationIDs[relationName],
                          let targetColumn else {
                        unmapped.append("\(sourceTitle): \(name) rollup requires its relation to be imported")
                        continue
                    }
                    requests.append(TablePropertyDefinitionRequest(
                        id: UUID().uuidString, name: name, kind: .lookup,
                        sourceColumnName: nil, targetTableName: nil,
                        targetKeyColumnName: nil, targetDisplayColumnName: nil,
                        relationDefinitionID: relationID, targetColumnName: Self.normalizedColumn(targetColumn),
                        filterByDefinitionID: nil, targetFilterColumnName: nil
                    ))
                }
                _ = try await TablePropertyService(database: database, hubID: hubID).replace(tableName: tableName, definitions: requests)
            } catch {
                unmapped.append("\(sourceTitle): relation definitions could not be installed")
            }
        }
        return unmapped
    }

    private static func displayColumn(in table: LiveSchemaTableResponse) -> LiveSchemaColumnResponse? {
        let columns = Dictionary(table.columns.map { (normalized($0.name), $0) }, uniquingKeysWith: { first, _ in first })
        return columns["title"] ?? columns["service"] ?? columns["category"] ?? columns["employername"]
            ?? columns["institutionname"] ?? columns["item"]
    }

    private func prepareCustomTables(_ sources: [NotionJSONValue], targets: [String: String], excluding: Set<String>) async throws -> [String: LiveSchemaTableResponse] {
        guard let sqlDatabase = database as? SQLDatabase else { throw Abort(.internalServerError) }
        let validator = TableBuilderContractService()
        var definitions: [(String, String, ValidatedTableDefinition)] = []
        let existingTables = try await LiveSchemaService(database: database).inspect().tables
        let existingNames = Set(existingTables.map { $0.name.lowercased() })
        var result: [String: LiveSchemaTableResponse] = [:]
        for source in sources.sorted(by: { ($0.objectValue?["id"]?.stringValue ?? "") < ($1.objectValue?["id"]?.stringValue ?? "") }) {
            guard let object = source.objectValue,
                  let sourceID = object["id"]?.stringValue,
                  !excluding.contains(sourceID) else { continue }
            guard let target = targets[sourceID],
                  ![ServiceAccount.schema, ExpenseTransaction.schema, Employment.schema, Education.schema,
                    ExpenseCategory.schema, ExpenseSubcategory.schema].contains(target) else { continue }
            if let existing = existingTables.first(where: { $0.name == target }) {
                result[target] = existing
            } else {
                guard !existingNames.contains(target.lowercased()) else { throw Abort(.conflict) }
                let definition = try validator.validate(TableBuilderRequest(tableName: target, columns: Self.customColumns(from: object["properties"])))
                definitions.append((sourceID, target, definition))
            }
        }
        // Every definition is validated before the first DDL or reference write.
        for (_, target, definition) in definitions {
            try await sqlDatabase.raw(SQLQueryString(UserTableCreationService.buildCreateTableSQL(for: definition))).run()
            let schema = try await LiveSchemaService(database: database).inspect()
            guard let table = schema.tables.first(where: { $0.name == target }) else { throw Abort(.internalServerError) }
            result[target] = table
            if let backupConfiguration {
                try await LiveMigrationAuditService(database: database, databaseIdentity: backupConfiguration.databaseIdentity)
                    .record(migrationName: "notion-import-create-\(target)", result: "succeeded", backupFileName: backup.backupFileName)
            }
        }
        for source in sources.sorted(by: { ($0.objectValue?["id"]?.stringValue ?? "") < ($1.objectValue?["id"]?.stringValue ?? "") }) {
            guard let object = source.objectValue, let sourceID = object["id"]?.stringValue,
                  !excluding.contains(sourceID), let target = targets[sourceID], result[target] != nil,
                  ![ServiceAccount.schema, ExpenseTransaction.schema, Employment.schema, Education.schema,
                    ExpenseCategory.schema, ExpenseSubcategory.schema].contains(target) else { continue }
            _ = try await SchemaPageService(database: database, hubID: hubID).createPage(tableName: target)
            try await saveReference(notionID: sourceID, tableName: target, recordID: "__table__", on: database)
        }
        return result
    }

    private static func title(_ object: [String: NotionJSONValue]) -> String {
        if let title = object["title"]?.arrayValue?.compactMap({ $0.objectValue?["plain_text"]?.stringValue }).joined(), !title.isEmpty { return title }
        let properties = object["properties"]?.objectValue ?? [:]
        for property in properties.values where property.objectValue?["type"]?.stringValue == "title" {
            let value = property.objectValue?["title"]?.arrayValue?.compactMap { $0.objectValue?["plain_text"]?.stringValue }.joined() ?? ""
            if !value.isEmpty { return value }
        }
        return "Untitled"
    }

    private static func depth(of object: [String: NotionJSONValue], pages: [[String: NotionJSONValue]]) -> Int {
        var count = 0
        var parentID = object["parent"]?.objectValue?["page_id"]?.stringValue
        var seen: Set<String> = []
        while let id = parentID, seen.insert(id).inserted,
              let parent = pages.first(where: { $0["id"]?.stringValue == id }) {
            count += 1
            parentID = parent["parent"]?.objectValue?["page_id"]?.stringValue
        }
        return count
    }

    private static func budgetTarget(for object: [String: NotionJSONValue]) -> String {
        let properties = object["properties"]?.objectValue ?? [:]
        let names = Set(properties.keys.map(normalized))
        let transactionIndicators: Set<String> = ["item", "transactiondate", "quantity", "total", "paidprice", "regularprice", "merchant"]
        if !names.isDisjoint(with: transactionIndicators) { return ExpenseTransaction.schema }
        if names.contains("subcategory") { return ExpenseSubcategory.schema }
        return ExpenseCategory.schema
    }

    static func customColumns(from value: NotionJSONValue?) throws -> [TableBuilderColumnRequest] {
        let properties = value?.objectValue ?? [:]
        let normalizedNames = normalizedPropertyNames(properties)
        var columns: [TableBuilderColumnRequest] = []
        for (name, property) in properties.sorted(by: { $0.key < $1.key }) {
            let type = property.objectValue?["type"]?.stringValue ?? "unknown"
            if ["title", "rollup", "created_time", "last_edited_time", "people"].contains(type) { continue }
            let column = normalizedNames[name] ?? normalizedColumn(name)
            let storage = NotionImportValueMapper.propertyType(type).storage
            let dataType: SQLiteColumnType = storage == .number ? .real
                : (storage == .checkbox || type == "unique_id" ? .integer : .text)
            columns.append(TableBuilderColumnRequest(name: column, dataType: dataType, nullable: true, defaultValue: nil, primaryKey: false, unique: false))
        }
        return columns.sorted { $0.name < $1.name }
    }

    private static func normalizedPropertyNames(_ properties: [String: NotionJSONValue]) -> [String: String] {
        var used: Set<String> = ["id", "hubid", "title"]
        return Dictionary(uniqueKeysWithValues: properties.keys.sorted().map { name in
            (name, normalizedColumn(name, used: &used))
        })
    }

    private static func normalizedColumn(_ value: String, used: inout Set<String>) -> String {
        let folded = value.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        let parts = folded.split(whereSeparator: { !$0.isASCII || (!$0.isLetter && !$0.isNumber) })
        var base = parts.map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
        base = String(base.filter(\.isASCII).prefix(TableBuilderContractService.maximumIdentifierLength))
        if base.first?.isNumber == true { base = "Field" + String(base.prefix(TableBuilderContractService.maximumIdentifierLength - 5)) }
        if base.isEmpty { base = "Field" }
        let maxLength = TableBuilderContractService.maximumIdentifierLength
        var candidate = base
        var suffix = 2
        while !used.insert(candidate.lowercased()).inserted {
            let ending = String(suffix)
            candidate = String(base.prefix(maxLength - ending.count)) + ending
            suffix += 1
        }
        return candidate
    }

    private static func normalizedColumn(_ value: String) -> String {
        var reserved: Set<String> = ["id", "hubid", "title"]
        return normalizedColumn(value, used: &reserved)
    }

    private static func normalized(_ value: String) -> String {
        String(value.lowercased().filter { $0.isLetter || $0.isNumber })
    }

    private static func scalar(_ property: NotionJSONValue, type: String) -> ImportScalar? {
        guard let object = property.objectValue, let value = object[type] else { return nil }
        switch type {
        case "title", "rich_text":
            return .text(value.arrayValue?.compactMap { $0.objectValue?["plain_text"]?.stringValue }.joined() ?? "")
        case "number":
            if case .number(let number) = value { return .number(number) }
        case "select", "status": return .text(value.objectValue?["name"]?.stringValue ?? "")
        case "multi_select": return .text(value.arrayValue?.compactMap { $0.objectValue?["name"]?.stringValue }.joined(separator: ";") ?? "")
        case "date":
            let date = value.objectValue ?? [:]
            return .text([date["start"]?.stringValue, date["end"]?.stringValue].compactMap { $0 }.joined(separator: "/"))
        case "url", "email", "phone_number": return .text(value.stringValue ?? "")
        case "checkbox": if let checked = value.boolValue { return .bool(checked) }
        case "unique_id":
            let id = value.objectValue?["number"]
            if case .number(let number) = id { return .integer(Int64(number)) }
        case "created_time", "last_edited_time": return .text(value.stringValue ?? "")
        case "relation": return .text(value.arrayValue?.compactMap { $0.objectValue?["id"]?.stringValue }.joined(separator: ";") ?? "")
        case "formula":
            let formula = value.objectValue ?? [:]
            if let formulaType = formula["type"]?.stringValue { return scalar(.object([formulaType: formula[formulaType] ?? .null]), type: formulaType) }
        case "rollup": return .text(String(describing: value.foundationValue))
        default: break
        }
        return nil
    }

    private static func presentationJSON(_ object: [String: NotionJSONValue]) -> String? {
        var value: [String: Any] = [:]
        if let icon = object["icon"]?.foundationValue, !(icon is NSNull) { value["icon"] = icon }
        if let cover = object["cover"]?.foundationValue, !(cover is NSNull) { value["cover"] = cover }
        guard !value.isEmpty, JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return nil }
        return String(decoding: data, as: UTF8.self)
    }

    private static func unmappedProperties(_ snapshot: NotionImportSnapshot) -> [String] {
        snapshot.dataSources.flatMap { source -> [String] in
            guard let object = source.objectValue else { return [] }
            let title = Self.title(object)
            return (object["properties"]?.objectValue ?? [:]).compactMap { name, property in
                let type = property.objectValue?["type"]?.stringValue ?? "unknown"
                guard NotionImportValueMapper.propertyType(type).requiresReview else { return nil }
                switch type {
                case "rollup": return "\(title): \(name) rollup requires review; only direct lookup values can be recreated"
                case "formula": return "\(title): \(name) formula result can be copied as text; its calculation needs review"
                case "checkbox": return "\(title): \(name) checkbox value can be stored as 0/1; presentation needs review"
                default: return "\(title): \(name) (\(type)) requires review and was not imported"
                }
            }
        }
    }

    private static func safeReason(_ error: Error) -> String {
        if let abort = error as? Abort { return abort.reason }
        return "The row could not be written. Review the target schema and required properties."
    }

    private func append(_ value: ImportScalar, to query: inout SQLQueryString) {
        switch value {
        case .text(let value): query.appendInterpolation(bind: value)
        case .number(let value): query.appendInterpolation(bind: value)
        case .integer(let value): query.appendInterpolation(bind: value)
        case .bool(let value): query.appendInterpolation(bind: value ? 1 : 0)
        case .null: query.appendInterpolation(unsafeRaw: "NULL")
        }
    }
}

