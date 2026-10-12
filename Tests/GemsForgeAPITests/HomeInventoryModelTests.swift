import XCTest
@testable import GemsForgeAPI

final class HomeInventoryModelTests: XCTestCase {
    func testHomeInventoryUsesGeneratedUUIDIdentifiers() {
        XCTAssertTrue(HomeInventoryIdentifier.isValid("550E8400-E29B-41D4-A716-446655440000"))
        XCTAssertTrue(HomeInventoryIdentifier.isValid(HomeInventoryIdentifier.generate()))
        XCTAssertFalse(HomeInventoryIdentifier.isValid("INV-0001"))
        XCTAssertFalse(HomeInventoryIdentifier.isValid("not-a-uuid"))
    }

    func testHomeInventoryMapsThePilotFields() throws {
        let inventory = HomeInventory(
            id: "550E8400-E29B-41D4-A716-446655440000",
            itemName: "Desk lamp",
            category: "Lighting",
            itemDescription: "Adjustable reading lamp",
            quantity: 1,
            purchasePrice: 29.99,
            currentValue: 20.00,
            condition: "Good",
            location: "Office"
        )

        XCTAssertEqual(inventory.id, "550E8400-E29B-41D4-A716-446655440000")
        XCTAssertEqual(inventory.itemName, "Desk lamp")
        XCTAssertEqual(inventory.currentValue, 20.00)
        XCTAssertEqual(HomeInventory.schema, "HomeInventory")
    }
}
