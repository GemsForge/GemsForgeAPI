import Fluent
import Foundation

/// Stores the stable Apple subject without retaining Apple credentials.
final class AppleAccount: Model, @unchecked Sendable {
    static let schema = "AppleAccounts"

    @ID(custom: "AccountID")
    var id: String?

    @Field(key: "AppleSubject")
    var appleSubject: String

    @Timestamp(key: "CreatedAt", on: .create)
    var createdAt: Date?

    init() {}

    init(id: String = UUID().uuidString, appleSubject: String) {
        self.id = id
        self.appleSubject = appleSubject
    }
}
