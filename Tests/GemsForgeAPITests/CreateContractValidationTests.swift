import XCTest
@testable import GemsForgeAPI

final class CreateContractValidationTests: XCTestCase {
    func testRequiredReportsMissingAndWhitespaceValues() {
        XCTAssertEqual(
            CreateContractValidation.required(nil, field: "title", label: "Title"),
            CreateFieldError(field: "title", message: "Title is required.")
        )
        XCTAssertEqual(
            CreateContractValidation.required("  ", field: "title", label: "Title"),
            CreateFieldError(field: "title", message: "Title is required.")
        )
        XCTAssertNil(CreateContractValidation.required("Life", field: "title", label: "Title"))
    }

    func testImmutableIdentifiesServerOwnedFields() {
        XCTAssertEqual(
            CreateContractValidation.immutable("dateCreated", label: "Date created"),
            CreateFieldError(field: "dateCreated", message: "Date created is managed by the server.")
        )
    }
}
