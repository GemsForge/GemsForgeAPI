import Fluent
import Vapor

/// Represents one expense subcategory belonging to an expense category.
///
/// This model maps the existing `BudgetSubcategories` table. The parent
/// category is represented by `categoryID`; emoji presentation remains a
/// separate concern handled by the emoji-label feature.
final class ExpenseSubcategory: Model, Content, @unchecked Sendable {
    static let schema = "BudgetSubcategories"

    @ID(custom: "SubcategoryID")
    var id: Int?

    @OptionalField(key: "HubID")
    var hubID: String?

    @Field(key: "CategoryID")
    var categoryID: Int

    @Field(key: "Subcategory")
    var name: String

    init() {}

    init(id: Int? = nil, categoryID: Int, name: String) {
        self.id = id
        self.categoryID = categoryID
        self.name = name
    }
}
