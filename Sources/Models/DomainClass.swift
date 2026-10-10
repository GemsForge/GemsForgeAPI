import Fluent
import Vapor

final class DomainClass: Model, Content, @unchecked Sendable {
    static let schema = "domain_classes"

    @ID(custom: "id")
    var id: String?

    @Field(key: "name")
    var name: String

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
        name: String,
        definition: String,
        sortOrder: Int,
        isActive: Bool = true
    ) {
        self.id = id
        self.name = name
        self.definition = definition
        self.sortOrder = sortOrder
        self.isActive = isActive
    }
}
