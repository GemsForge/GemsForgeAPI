import Foundation
import Fluent

/// Hub-owned archive marker and snapshot for a record moved to Trash.
final class TrashEntry: Model, @unchecked Sendable {
    static let schema = "TrashEntries"

    @ID(custom: "EntryID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "RecordID") var recordID: String
    @Field(key: "Title") var title: String
    @Field(key: "Snapshot") var snapshot: String
    @Timestamp(key: "TrashedAt", on: .create) var trashedAt: Date?

    init() {}

    init(
        id: String = UUID().uuidString,
        hubID: String,
        tableName: String,
        recordID: String,
        title: String,
        snapshot: String
    ) {
        self.id = id
        self.hubID = hubID
        self.tableName = tableName
        self.recordID = recordID
        self.title = title
        self.snapshot = snapshot
    }
}
