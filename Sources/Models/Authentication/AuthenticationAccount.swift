import Fluent
import Foundation

/// An internal Gem Life account. Its stable ID is independent of any login provider.
final class AuthenticationAccount: Model, @unchecked Sendable {
    static let schema = "Accounts"

    @ID(custom: "AccountID")
    var id: String?

    @Timestamp(key: "CreatedAt", on: .create)
    var createdAt: Date?

    init() {}

    init(id: String = UUID().uuidString) {
        self.id = id
    }
}

/// Maps an external issuer/subject pair to a provider-independent Gem Life account.
final class AuthenticationIdentity: Model, @unchecked Sendable {
    static let schema = "AccountIdentities"

    @ID(custom: "IdentityID")
    var id: String?

    @Parent(key: "AccountID")
    var account: AuthenticationAccount

    @Field(key: "Issuer")
    var issuer: String

    @Field(key: "Subject")
    var subject: String

    @Timestamp(key: "CreatedAt", on: .create)
    var createdAt: Date?

    init() {}

    init(id: String = UUID().uuidString, accountID: String, issuer: String, subject: String) {
        self.id = id
        self.$account.id = accountID
        self.issuer = issuer
        self.subject = subject
    }
}
