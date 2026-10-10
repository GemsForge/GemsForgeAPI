import Fluent
import Vapor

/// A ForgeKeeper page in the personal operating system.
///
/// Pages belong to a top-level `Domain` and can optionally belong to another
/// ForgeKeeper page through `parentID`, allowing nested page hierarchies.
final class ForgeKeeper: Model, Content, @unchecked Sendable {
    static let schema = "forgekeeper"

    @ID(custom: "id")
    var id: String?

    @OptionalParent(key: "parent_id")
    var parent: ForgeKeeper?

    @Parent(key: "domain_id")
    var domain: Domain

    @Field(key: "title")
    var title: String

    @Field(key: "description")
    var description: String

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(
        id: String? = nil,
        parentID: String? = nil,
        domainID: String,
        title: String,
        description: String
    ) {
        self.id = id
        self.$parent.id = parentID
        self.$domain.id = domainID
        self.title = title
        self.description = description
    }
}
