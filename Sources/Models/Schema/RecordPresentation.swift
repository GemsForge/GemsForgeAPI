import Fluent
import Foundation

/// Hub-scoped presentation metadata for an individual record.
final class RecordPresentation: Model, @unchecked Sendable {
    static let schema = "RecordPresentations"

    @ID(custom: "RecordPresentationID") var id: String?
    @Field(key: "HubID") var hubID: String
    @Field(key: "TableName") var tableName: String
    @Field(key: "RecordID") var recordID: String
    @Field(key: "Presentation") var presentation: String
    @Timestamp(key: "CreatedAt", on: .create) var createdAt: Date?
    @Timestamp(key: "UpdatedAt", on: .update) var updatedAt: Date?

    init() {}

    init(
        id: String = UUID().uuidString,
        hubID: String,
        tableName: String,
        recordID: String,
        presentation: String
    ) {
        self.id = id
        self.hubID = hubID
        self.tableName = tableName
        self.recordID = recordID
        self.presentation = presentation
    }
}
