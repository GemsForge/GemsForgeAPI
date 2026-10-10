import Fluent
import Vapor

final class Subdomain: Model, Content, @unchecked Sendable {
    static let schema = "subdomains"

    @ID(custom: "id")
    var id: String?

    @Parent(key: "domain_id")
    var domain: Domain

    @Field(key: "name")
    var name: String

    @OptionalField(key: "symbol")
    var symbol: String?

    @Field(key: "definition")
    var definition: String

    @Field(key: "sort_order")
    var sortOrder: Int

    @Field(key: "is_active")
    var isActive: Bool

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(
        id: String? = nil,
        domainID: String,
        name: String,
        symbol: String? = nil,
        definition: String,
        sortOrder: Int,
        isActive: Bool = true
    ) {
        self.id = id
        self.$domain.id = domainID
        self.name = name
        self.symbol = symbol
        self.definition = definition
        self.sortOrder = sortOrder
        self.isActive = isActive
    }
}
