import XCTest
@testable import GemsForgeAPI

final class HomeInventoryModelTests: XCTestCase {
    func testHomeInventoryUsesStableInventoryIdentifierRules() {
        XCTAssertTrue(HomeInventoryIdentifier.isValid("INV-0001"))
        XCTAssertTrue(HomeInventoryIdentifier.isValid("INV-12345"))
        XCTAssertFalse(HomeInventoryIdentifier.isValid("HOME-0001"))
        XCTAssertFalse(HomeInventoryIdentifier.isValid("INV-01"))
        XCTAssertFalse(HomeInventoryIdentifier.isValid("INV-0001-A"))
    }

    func testHomeInventoryMapsThePilotFields() throws {
        let inventory = HomeInventory(
            id: "INV-0001",
            itemName: "Desk lamp",
            category: "Lighting",
            itemDescription: "Adjustable reading lamp",
            quantity: 1,
            purchasePrice: 29.99,
            currentValue: 20.00,
            condition: "Good",
            location: "Office"
        )

        XCTAssertEqual(inventory.id, "INV-0001")
        XCTAssertEqual(inventory.itemName, "Desk lamp")
        XCTAssertEqual(inventory.currentValue, 20.00)
        XCTAssertEqual(HomeInventory.schema, "HomeInventory")
    }
}
