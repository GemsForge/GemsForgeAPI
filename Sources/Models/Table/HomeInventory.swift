import Fluent
import Vapor

/// Represents one item in the user's Home Inventory.
///
/// HomeInventory is a Life-area table. It intentionally does not reference a
/// Domain yet because the current database does not assign these records to a
/// domain. Image/file linkage belongs to the separate FileMetadata issue.
final class HomeInventory: Model, Content, @unchecked Sendable {
    static let schema = "HomeInventory"

    /// Stable identifiers use the form INV-0000, for example INV-0001.
    @ID(custom: "InventoryID")
    var id: String?

    @Field(key: "ItemName")
    var itemName: String

    @OptionalField(key: "Category")
    var category: String?

    @OptionalField(key: "Description")
    var itemDescription: String?

    @Field(key: "Quantity")
    var quantity: Int

    @OptionalField(key: "PurchaseDate")
    var purchaseDate: String?

    @OptionalField(key: "PurchasePrice")
    var purchasePrice: Double?

    @OptionalField(key: "CurrentValue")
    var currentValue: Double?

    @OptionalField(key: "Condition")
    var condition: String?

    @OptionalField(key: "Location")
    var location: String?

    @OptionalField(key: "Notes")
    var notes: String?

    init() {}

    init(
        id: String? = nil,
        itemName: String,
        category: String? = nil,
        itemDescription: String? = nil,
        quantity: Int = 1,
        purchaseDate: String? = nil,
        purchasePrice: Double? = nil,
        currentValue: Double? = nil,
        condition: String? = nil,
        location: String? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.itemName = itemName
        self.category = category
        self.itemDescription = itemDescription
        self.quantity = quantity
        self.purchaseDate = purchaseDate
        self.purchasePrice = purchasePrice
        self.currentValue = currentValue
        self.condition = condition
        self.location = location
        self.notes = notes
    }
}

/// Validates the stable identifier format reserved for HomeInventory rows.
enum HomeInventoryIdentifier {
    static let prefix = "INV-"

    static func isValid(_ value: String) -> Bool {
        value.range(of: #"^INV-[0-9]{4,}$"#, options: .regularExpression) != nil
    }
}
