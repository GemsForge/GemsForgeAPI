import Fluent
import Vapor

struct HomeInventoryCSVImportRequest: Content {
    let csv: String
    let confirmImport: Bool
}

struct HomeInventoryCSVImportResponse: Content, Sendable {
    let importedCount: Int
    let identifiers: [String]
    let status: String
}

enum HomeInventoryCSVImportError: Error, CustomStringConvertible {
    case confirmationRequired
    case previewNotReady

    var description: String {
        switch self {
        case .confirmationRequired: return "CSV import requires explicit confirmation."
        case .previewNotReady: return "The CSV contains invalid or duplicate rows and cannot be imported."
        }
    }
}

/// Commits a previously previewed HomeInventory CSV as one atomic batch.
struct HomeInventoryCSVImportService: Sendable {
    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    func importCSV(_ request: HomeInventoryCSVImportRequest) async throws -> HomeInventoryCSVImportResponse {
        guard request.confirmImport else { throw HomeInventoryCSVImportError.confirmationRequired }

        let preview = try await HomeInventoryCSVPreviewService(database: database).preview(csv: request.csv)
        guard preview.readyToImport else { throw HomeInventoryCSVImportError.previewNotReady }

        let identifiers = preview.validRows.compactMap { $0.values["InventoryID"] }
        try await database.transaction { database in
            for row in preview.validRows {
                let values = row.values
                guard let id = values["InventoryID"],
                      let itemName = values["ItemName"],
                      let quantity = values["Quantity"].flatMap(Int.init) else {
                    throw HomeInventoryCSVImportError.previewNotReady
                }

                guard try await HomeInventory.find(id, on: database) == nil else {
                    throw Abort(.conflict, reason: "InventoryID already exists in the database.")
                }

                let record = HomeInventory(
                    id: id,
                    itemName: itemName,
                    category: values["Category"].nonEmpty,
                    itemDescription: values["Description"].nonEmpty,
                    quantity: quantity,
                    purchaseDate: values["PurchaseDate"].nonEmpty,
                    purchasePrice: values["PurchasePrice"].flatMap(Double.init),
                    currentValue: values["CurrentValue"].flatMap(Double.init),
                    condition: values["Condition"].nonEmpty,
                    location: values["Location"].nonEmpty,
                    notes: values["Notes"].nonEmpty
                )
                try await record.create(on: database)
            }
        }

        return HomeInventoryCSVImportResponse(
            importedCount: identifiers.count,
            identifiers: identifiers,
            status: "imported"
        )
    }
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}
