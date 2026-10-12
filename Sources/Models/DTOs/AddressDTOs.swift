import Vapor

/// Fields accepted when creating or replacing an address record.
struct AddressRequest: Content {
    let id: String?
    let addressType: String?
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let country: String?
    let startDate: String?
    let endDate: String?
    let addressStatus: String
    let notes: String?
    var imageFileMetadataID: String? = nil
}

/// Safe list representation that omits street lines, postal code, and notes.
struct AddressSummaryResponse: Content {
    let id: String?
    let addressType: String
    let city: String?
    let state: String?
    let country: String
    let startDate: String?
    let endDate: String?
    let addressStatus: String
    let imageFileMetadataID: String?

    init(_ address: Address) {
        id = address.id
        addressType = address.addressType
        city = address.city
        state = address.state
        country = address.country
        startDate = address.startDate
        endDate = address.endDate
        addressStatus = address.addressStatus
        imageFileMetadataID = address.imageFileMetadataID
    }
}

/// Complete representation returned only when one address is requested.
struct AddressDetailResponse: Content {
    let id: String?
    let addressType: String
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let country: String
    let startDate: String?
    let endDate: String?
    let addressStatus: String
    let notes: String?
    let imageFileMetadataID: String?

    init(_ address: Address) {
        id = address.id
        addressType = address.addressType
        addressLine1 = address.addressLine1
        addressLine2 = address.addressLine2
        city = address.city
        state = address.state
        postalCode = address.postalCode
        country = address.country
        startDate = address.startDate
        endDate = address.endDate
        addressStatus = address.addressStatus
        notes = address.notes
        imageFileMetadataID = address.imageFileMetadataID
    }
}

/// Address data embedded in another record that references an address.
///
/// The relationship is represented as an object in API responses so clients
/// do not need a second request just to render the address. The stable ID is
/// retained inside the object for identity and future updates.
struct AddressReferenceResponse: Content {
    let id: String?
    let addressType: String
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let country: String
    let startDate: String?
    let endDate: String?
    let addressStatus: String

    init(_ address: Address) {
        id = address.id
        addressType = address.addressType
        addressLine1 = address.addressLine1
        addressLine2 = address.addressLine2
        city = address.city
        state = address.state
        postalCode = address.postalCode
        country = address.country
        startDate = address.startDate
        endDate = address.endDate
        addressStatus = address.addressStatus
    }
}
