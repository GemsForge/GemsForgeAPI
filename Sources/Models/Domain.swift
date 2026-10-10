import Fluent
import Vapor

final class Domain: Model, Content, @unchecked Sendable {
    static let schema = "domains"

    @ID(custom: "id")
    var id: String?

    @Parent(key: "domain_class_id")
    var domainClass: DomainClass

    @Field(key: "name")
    var name: String

    @Field(key: "symbol")
    var symbol: String

    @Field(key: "definition")
    var definition: String

    @Field(key: "primary_question")
    var primaryQuestion: String

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
        domainClassID: String,
        name: String,
        symbol: String,
        definition: String,
        primaryQuestion: String,
        sortOrder: Int,
        isActive: Bool = true
    ) {
        self.id = id
        self.$domainClass.id = domainClassID
        self.name = name
        self.symbol = symbol
        self.definition = definition
        self.primaryQuestion = primaryQuestion
        self.sortOrder = sortOrder
        self.isActive = isActive
    }
}
