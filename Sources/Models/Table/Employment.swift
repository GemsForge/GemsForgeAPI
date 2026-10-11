import Fluent
import Vapor

/// Represents one employment record in the Gem Life data layer.
///
/// This model maps to the existing `Employment` table. Employment is currently
/// treated as Life-area data by the application, but the table does not store
/// a `DomainID` relationship. Employer contact fields are mapped for local,
/// authenticated use and should not be exposed publicly without authorization.
final class Employment: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "Employment"

    // Stable values such as EMP-0001 identify existing employment records.
    @ID(custom: "EmploymentID")
    var id: String?

    @Field(key: "EmployerName")
    var employerName: String

    @Field(key: "EmployerType")
    var employerType: String

    @OptionalField(key: "Industry")
    var industry: String?

    @OptionalField(key: "Website")
    var website: String?

    @Field(key: "PositionTitle")
    var positionTitle: String

    @Field(key: "EmploymentType")
    var employmentType: String

    @OptionalField(key: "StartDate")
    var startDate: String?

    @OptionalField(key: "EndDate")
    var endDate: String?

    @Field(key: "EmploymentStatus")
    var employmentStatus: String

    @OptionalField(key: "WorkAddressID")
    var workAddressID: String?

    @OptionalField(key: "EmployerContact")
    var employerContact: String?

    @OptionalField(key: "EmployerContactNumber")
    var employerContactNumber: String?

    @OptionalField(key: "EmployerContactEmail")
    var employerContactEmail: String?

    @OptionalField(key: "Notes")
    var notes: String?

    init() {}

    /// Creates an Employment model using the columns available in the existing table.
    init(
        id: String? = nil,
        employerName: String,
        employerType: String = "Organization",
        industry: String? = nil,
        website: String? = nil,
        positionTitle: String,
        employmentType: String = "Employee",
        startDate: String? = nil,
        endDate: String? = nil,
        employmentStatus: String,
        workAddressID: String? = nil,
        employerContact: String? = nil,
        employerContactNumber: String? = nil,
        employerContactEmail: String? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.employerName = employerName
        self.employerType = employerType
        self.industry = industry
        self.website = website
        self.positionTitle = positionTitle
        self.employmentType = employmentType
        self.startDate = startDate
        self.endDate = endDate
        self.employmentStatus = employmentStatus
        self.workAddressID = workAddressID
        self.employerContact = employerContact
        self.employerContactNumber = employerContactNumber
        self.employerContactEmail = employerContactEmail
        self.notes = notes
    }
}
