import Fluent
import Vapor

/// Represents one recurring service account in the Gem Life data layer.
///
/// This model maps the existing `Services` table. A Service Account identifies
/// the service that can generate recurring expenses; it is not an individual
/// transaction and does not duplicate rows from `Transactions`.
final class ServiceAccount: Model, Content, @unchecked Sendable {
    // The existing database table keeps the historical name `Services`.
    static let schema = "Services"

    @ID(custom: "ServiceID")
    var id: Int?

    @OptionalField(key: "HubID")
    var hubID: String?

    @Field(key: "Service")
    var service: String

    @OptionalField(key: "LogoKey")
    var logoKey: String?

    @OptionalField(key: "Type")
    var type: String?

    @OptionalField(key: "ExpenseGroup")
    var expenseGroup: String?

    @OptionalField(key: "MonthlyAmount")
    var monthlyAmount: Double?

    @OptionalField(key: "InterestRate")
    var interestRate: Double?

    @OptionalField(key: "APR")
    var apr: Double?

    @OptionalField(key: "Due")
    var due: String?

    @OptionalField(key: "Occurrence")
    var occurrence: String?

    @OptionalField(key: "Status")
    var status: String?

    @OptionalField(key: "Since")
    var since: String?

    @OptionalField(key: "Website")
    var website: String?

    @OptionalField(key: "Notes")
    var notes: String?

    @OptionalField(key: "NotionPage")
    var notionPage: String?

    @OptionalField(key: "PaymentMethod")
    var paymentMethod: String?

    @OptionalField(key: "AccountNumber")
    var accountNumber: String?

    @OptionalField(key: "EmailUpdated")
    var emailUpdated: String?

    @OptionalField(key: "AssociatedAddress")
    var associatedAddress: String?

    @OptionalField(key: "ServiceKey")
    var serviceKey: String?

    /// FileMetadataID for the Service Account logo, if one is attached.
    @OptionalField(key: "LogoFileMetadataID")
    var logoFileMetadataID: String?

    // DateCreated and DateUpdated remain database-managed text columns.

    init() {}

    /// Creates a Service Account using the columns available in the existing table.
    init(
        id: Int? = nil,
        service: String,
        logoKey: String? = nil,
        type: String? = nil,
        expenseGroup: String? = nil,
        monthlyAmount: Double? = nil,
        interestRate: Double? = nil,
        apr: Double? = nil,
        due: String? = nil,
        occurrence: String? = nil,
        status: String? = nil,
        since: String? = nil,
        website: String? = nil,
        notes: String? = nil,
        notionPage: String? = nil,
        paymentMethod: String? = nil,
        accountNumber: String? = nil,
        emailUpdated: String? = nil,
        associatedAddress: String? = nil,
        serviceKey: String? = nil,
        logoFileMetadataID: String? = nil
    ) {
        self.id = id
        self.service = service
        self.logoKey = logoKey
        self.type = type
        self.expenseGroup = expenseGroup
        self.monthlyAmount = monthlyAmount
        self.interestRate = interestRate
        self.apr = apr
        self.due = due
        self.occurrence = occurrence
        self.status = status
        self.since = since
        self.website = website
        self.notes = notes
        self.notionPage = notionPage
        self.paymentMethod = paymentMethod
        self.accountNumber = accountNumber
        self.emailUpdated = emailUpdated
        self.associatedAddress = associatedAddress
        self.serviceKey = serviceKey
        self.logoFileMetadataID = logoFileMetadataID
    }
}
