import Fluent
import Vapor

/// Represents one education record in the Gem Life data layer.
///
/// This model maps to the existing `Education` table. Education is currently
/// treated as Life-area data by the application, but the table does not store
/// a `DomainID` relationship, so no domain relationship is invented here.
final class Education: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "Education"

    // Stable values such as EDU-0001 identify existing education records.
    @ID(custom: "EducationID")
    var id: String?

    @Field(key: "EducationType")
    var educationType: String

    @Field(key: "InstitutionName")
    var institutionName: String

    @OptionalField(key: "Program")
    var program: String?

    @OptionalField(key: "FieldOfStudy")
    var fieldOfStudy: String?

    @OptionalField(key: "Credential")
    var credential: String?

    @OptionalField(key: "CredentialID")
    var credentialID: String?

    // These dates remain strings because the existing table stores text dates.
    @OptionalField(key: "StartDate")
    var startDate: String?

    @OptionalField(key: "EndDate")
    var endDate: String?

    @OptionalField(key: "AwardedDate")
    var awardedDate: String?

    @Field(key: "Status")
    var status: String

    @OptionalField(key: "LocationAddressID")
    var locationAddressID: String?

    @OptionalField(key: "Website")
    var website: String?

    @OptionalField(key: "Notes")
    var notes: String?

    /// FileMetadataID for an attached certificate or education document.
    @OptionalField(key: "DocumentFileMetadataID")
    var documentFileMetadataID: String?

    @OptionalField(key: "DateUpdated")
    var updatedAt: String?

    init() {}

    /// Creates an Education model using the columns available in the existing table.
    init(
        id: String? = nil,
        educationType: String,
        institutionName: String,
        program: String? = nil,
        fieldOfStudy: String? = nil,
        credential: String? = nil,
        credentialID: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        awardedDate: String? = nil,
        status: String = "Completed",
        locationAddressID: String? = nil,
        website: String? = nil,
        notes: String? = nil,
        documentFileMetadataID: String? = nil
    ) {
        self.id = id
        self.educationType = educationType
        self.institutionName = institutionName
        self.program = program
        self.fieldOfStudy = fieldOfStudy
        self.credential = credential
        self.credentialID = credentialID
        self.startDate = startDate
        self.endDate = endDate
        self.awardedDate = awardedDate
        self.status = status
        self.locationAddressID = locationAddressID
        self.website = website
        self.notes = notes
        self.documentFileMetadataID = documentFileMetadataID
    }
}
