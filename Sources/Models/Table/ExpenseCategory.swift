import Fluent
import Vapor

/// Represents one reusable expense classification.
///
/// The model maps the existing `BudgetCategories` table. Category identity is
/// independent of emoji presentation, which will be handled by the separate
/// emoji-label definitions feature.
final class ExpenseCategory: Model, Content, @unchecked Sendable {
    static let schema = "BudgetCategories"

    @ID(custom: "CategoryID")
    var id: Int?

    @Field(key: "Category")
    var name: String

    init() {}

    init(id: Int? = nil, name: String) {
        self.id = id
        self.name = name
    }
}
