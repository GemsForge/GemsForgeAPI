import Fluent
import Foundation

/// Stable source-to-record identity for repeatable, one-way Notion imports.
final class NotionImportReference: Model, @unchecked Sendable {
    static let schema = "NotionImportReferences"

    @ID(custom: "NotionImportReferenceID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "NotionPageID") var notionPageID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "RecordID") var recordID: String
    @Timestamp(key: "CreatedAt", on: .create) var createdAt: Date?
    @Timestamp(key: "UpdatedAt", on: .update) var updatedAt: Date?

    init() {}

    init(id: String = UUID().uuidString, hubID: String, notionPageID: String, tableName: String, recordID: String) {
        self.id = id
        self.hubID = hubID
        self.notionPageID = notionPageID
        self.tableName = tableName
        self.recordID = recordID
    }
}
