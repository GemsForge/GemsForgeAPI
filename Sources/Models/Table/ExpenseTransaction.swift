import Fluent
import Vapor

/// Represents one documented expense transaction in the Gem Life data layer.
///
/// This model maps the existing `Transactions` table without inventing a
/// Service Account, category, subcategory, or image relationship before those
/// table contracts are implemented. The numeric values mirror SQLite NUMERIC
/// columns as `Double` for the first API slice; financial precision rules are
/// documented and can be tightened with a dedicated value type later.
final class ExpenseTransaction: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "Transactions"

    // Stable values such as TRX-0001 identify existing transactions.
    @ID(custom: "TransactionID")
    var id: String?

    @OptionalField(key: "HubID")
    var hubID: String?

    @OptionalField(key: "ReceiptID")
    var receiptID: String?

    @Field(key: "Item")
    var item: String

    @Field(key: "FirstReceiptItem")
    var firstReceiptItem: Bool

    @Field(key: "CategoryID")
    var categoryID: Int

    @OptionalField(key: "SubcategoryID")
    var subcategoryID: Int?

    @OptionalField(key: "MerchantCode")
    var merchantCode: String?

    // The existing database stores transaction dates as text.
    @OptionalField(key: "TransactionDate")
    var transactionDate: String?

    @Field(key: "Quantity")
    var quantity: Double

    @OptionalField(key: "RegularPrice")
    var regularPrice: Double?

    @OptionalField(key: "PaidPrice")
    var paidPrice: Double?

    @OptionalField(key: "Total")
    var total: Double?

    @OptionalField(key: "Discount")
    var discount: Double?

    @OptionalField(key: "Notes")
    var notes: String?

    // Stores the FileMetadataID for an attached image, never the image bytes.
    @OptionalField(key: "Image")
    var image: String?

    // DateCreated and DateUpdated remain database-managed text columns.

    init() {}

    /// Creates an ExpenseTransaction using the columns available in the
    /// existing Transactions table.
    init(
        id: String? = nil,
        receiptID: String? = nil,
        item: String,
        firstReceiptItem: Bool = false,
        categoryID: Int,
        subcategoryID: Int? = nil,
        merchantCode: String? = nil,
        transactionDate: String? = nil,
        quantity: Double = 1,
        regularPrice: Double? = nil,
        paidPrice: Double? = nil,
        total: Double? = nil,
        discount: Double? = nil,
        notes: String? = nil,
        image: String? = nil
    ) {
        self.id = id
        self.receiptID = receiptID
        self.item = item
        self.firstReceiptItem = firstReceiptItem
        self.categoryID = categoryID
        self.subcategoryID = subcategoryID
        self.merchantCode = merchantCode
        self.transactionDate = transactionDate
        self.quantity = quantity
        self.regularPrice = regularPrice
        self.paidPrice = paidPrice
        self.total = total
        self.discount = discount
        self.notes = notes
        self.image = image
    }
}
