import Fluent
import Foundation

/// A private data container owned by exactly one authenticated account.
final class Hub: Model, @unchecked Sendable {
    static let schema = "Hubs"

    @ID(custom: "HubID")
    var id: String?

    @Field(key: "AccountID")
    var accountID: String

    @Field(key: "Name")
    var name: String

    @Timestamp(key: "CreatedAt", on: .create)
    var createdAt: Date?

    init() {}

    init(id: String = UUID().uuidString, accountID: String, name: String = "Gem Life") {
        self.id = id
        self.accountID = accountID
        self.name = name
    }
}
