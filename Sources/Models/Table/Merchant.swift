import Fluent
import Vapor

final class Merchant: Model, Content, @unchecked Sendable {
    static let schema = "Merchants"

    @ID(custom: "Code")
    var id: String?

    @Field(key: "Merchant")
    var name: String

    init() {}
}
