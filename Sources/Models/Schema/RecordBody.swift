import Fluent
import Foundation

/// Hub-scoped Markdown content for an individual record.
final class RecordBody: Model, @unchecked Sendable {
    static let schema = "RecordBodies"

    @ID(custom: "RecordBodyID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "RecordID") var recordID: String
    @Field(key: "Markdown") var markdown: String
    @Field(key: "Revision") var revision: Int
    @Timestamp(key: "CreatedAt", on: .create) var createdAt: Date?
    @Timestamp(key: "UpdatedAt", on: .update) var updatedAt: Date?

    init() {}

    init(
        id: String = UUID().uuidString,
        hubID: String,
        tableName: String,
        recordID: String,
        markdown: String = "",
        revision: Int = 0
    ) {
        self.id = id
        self.hubID = hubID
        self.tableName = tableName
        self.recordID = recordID
        self.markdown = markdown
        self.revision = revision
    }
}
