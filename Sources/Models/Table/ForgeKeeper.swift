import Fluent
import Vapor

/// A ForgeKeeper page in the personal operating system.
///
/// Pages belong to a top-level `Domain` and can optionally belong to another
/// ForgeKeeper page through `parentID`, allowing nested page hierarchies.
final class ForgeKeeper: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "ForgeKeeper"

    // The existing database uses an auto-incrementing integer key.
    @ID(custom: "ForgeKeeperID")
    var id: Int?

    // ParentID is nullable for a root page and points back to ForgeKeeper.
    @OptionalParent(key: "ParentID")
    var parent: ForgeKeeper?

    // Every page belongs to one of the four top-level Gem Life domains.
    @Parent(key: "DomainID")
    var domain: Domain

    @Field(key: "Title")
    var title: String

    @Field(key: "Description")
    var description: String

    @Timestamp(key: "DateCreated", on: .create)
    var createdAt: Date?

    @Timestamp(key: "DateUpdated", on: .update)
    var updatedAt: Date?

    init() {}

    init(
        id: Int? = nil,
        parentID: Int? = nil,
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
