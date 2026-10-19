import Fluent
import Vapor

/// Represents one address record in the Gem Life data layer.
///
/// This model maps to the existing `Addresses` table. Addresses are currently
/// treated as Life-area data, but the table does not store a `DomainID`
/// relationship, so no domain relationship is invented here.
final class Address: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "Addresses"

    // Stable values such as ADDR-0001 identify existing address records.
    @ID(custom: "AddressID")
    var id: String?

    @OptionalField(key: "HubID")
    var hubID: String?

    @Field(key: "AddressType")
    var addressType: String

    @OptionalField(key: "AddressLine1")
    var addressLine1: String?

    @OptionalField(key: "AddressLine2")
    var addressLine2: String?

    @OptionalField(key: "City")
    var city: String?

    @OptionalField(key: "State")
    var state: String?

    @OptionalField(key: "PostalCode")
    var postalCode: String?

    @Field(key: "Country")
    var country: String

    // The existing table stores dates as text rather than managed timestamps.
    @OptionalField(key: "StartDate")
    var startDate: String?

    @OptionalField(key: "EndDate")
    var endDate: String?

    @Field(key: "AddressStatus")
    var addressStatus: String

    @OptionalField(key: "Notes")
    var notes: String?

    /// FileMetadataID for the address image, if one is attached.
    @OptionalField(key: "ImageFileMetadataID")
    var imageFileMetadataID: String?

    @OptionalField(key: "DateUpdated")
    var updatedAt: String?

    init() {}

    /// Creates an Address model using the columns available in the existing table.
    init(
        id: String? = nil,
        addressType: String = "Residence",
        addressLine1: String? = nil,
        addressLine2: String? = nil,
        city: String? = nil,
        state: String? = nil,
        postalCode: String? = nil,
        country: String = "US",
        startDate: String? = nil,
        endDate: String? = nil,
        addressStatus: String,
        notes: String? = nil,
        imageFileMetadataID: String? = nil
    ) {
        self.id = id
        self.addressType = addressType
        self.addressLine1 = addressLine1
        self.addressLine2 = addressLine2
        self.city = city
        self.state = state
        self.postalCode = postalCode
        self.country = country
        self.startDate = startDate
        self.endDate = endDate
        self.addressStatus = addressStatus
        self.notes = notes
        self.imageFileMetadataID = imageFileMetadataID
    }
}
