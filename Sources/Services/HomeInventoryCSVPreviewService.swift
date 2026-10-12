import Fluent
import Foundation
import Vapor

struct HomeInventoryCSVPreviewRequest: Content {
    let csv: String
}

struct HomeInventoryCSVRowPreview: Content, Sendable {
    let rowNumber: Int
    let values: [String: String]
    let errors: [String]
}

struct HomeInventoryCSVPreviewResponse: Content, Sendable {
    let headers: [String]
    let validRows: [HomeInventoryCSVRowPreview]
    let invalidRows: [HomeInventoryCSVRowPreview]
    let readyToImport: Bool
    let warnings: [String]
}

enum HomeInventoryCSVPreviewError: Error, CustomStringConvertible {
    case emptyCSV
    case missingRequiredHeader(String)
    case unsupportedHeader(String)
    case malformedRow(Int)

    var description: String {
        switch self {
        case .emptyCSV: return "CSV content is required."
        case .missingRequiredHeader(let header): return "The CSV is missing the required header: \(header)."
        case .unsupportedHeader(let header): return "The CSV contains an unsupported header: \(header)."
        case .malformedRow(let row): return "The CSV row is malformed: \(row)."
        }
    }
}

/// Previews HomeInventory CSV data without writing any records.
///
/// The parser accepts quoted values and escaped quotes, then validates the
/// fields against the same identifier and numeric rules used by manual entry.
struct HomeInventoryCSVPreviewService: Sendable {
    static let supportedHeaders = [
        "InventoryID", "ItemName", "Category", "Description", "Quantity",
        "PurchaseDate", "PurchasePrice", "CurrentValue", "Condition", "Location", "Notes"
    ]

    private let database: any Database

    init(database: any Database) {
        self.database = database
    }

    func preview(csv: String) async throws -> HomeInventoryCSVPreviewResponse {
        guard !csv.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw HomeInventoryCSVPreviewError.emptyCSV
        }

        let rows = try parse(csv)
        guard let headers = rows.first, !headers.isEmpty else {
            throw HomeInventoryCSVPreviewError.emptyCSV
        }

        for header in headers where !Self.supportedHeaders.contains(header) {
            throw HomeInventoryCSVPreviewError.unsupportedHeader(header)
        }
        for required in ["ItemName", "Quantity"] where !headers.contains(required) {
            throw HomeInventoryCSVPreviewError.missingRequiredHeader(required)
        }

        var seenIDs: Set<String> = []
        var validRows: [HomeInventoryCSVRowPreview] = []
        var invalidRows: [HomeInventoryCSVRowPreview] = []

        for (offset, row) in rows.dropFirst().enumerated() {
            let rowNumber = offset + 2
            guard row.count == headers.count else {
                invalidRows.append(HomeInventoryCSVRowPreview(rowNumber: rowNumber, values: [:], errors: [HomeInventoryCSVPreviewError.malformedRow(rowNumber).description]))
                continue
            }

            var values = Dictionary(uniqueKeysWithValues: zip(headers, row).map { ($0.0, $0.1.trimmingCharacters(in: .whitespacesAndNewlines)) })
            var errors: [String] = []
            let suppliedID = values["InventoryID"] ?? ""
            let id = suppliedID.isEmpty ? HomeInventoryIdentifier.generate() : suppliedID
            values["InventoryID"] = id
            let itemName = values["ItemName"] ?? ""
            let quantity = values["Quantity"] ?? ""

            if !HomeInventoryIdentifier.isValid(id) { errors.append("InventoryID must be a valid UUID when supplied.") }
            if itemName.isEmpty { errors.append("ItemName is required.") }
            if Int(quantity).map({ $0 > 0 }) != true { errors.append("Quantity must be a positive whole number.") }

            for field in ["PurchasePrice", "CurrentValue"] {
                if let value = values[field], !value.isEmpty,
                   let number = Double(value), number >= 0 {
                    _ = number
                } else if let value = values[field], !value.isEmpty {
                    errors.append("\(field) must be a nonnegative number.")
                }
            }

            if !id.isEmpty && !seenIDs.insert(id).inserted {
                errors.append("InventoryID is duplicated in this CSV.")
            } else if !id.isEmpty, try await HomeInventory.find(id, on: database) != nil {
                errors.append("InventoryID already exists in the database.")
            }

            let preview = HomeInventoryCSVRowPreview(rowNumber: rowNumber, values: values, errors: errors)
            if errors.isEmpty { validRows.append(preview) } else { invalidRows.append(preview) }
        }

        return HomeInventoryCSVPreviewResponse(
            headers: headers,
            validRows: validRows,
            invalidRows: invalidRows,
            readyToImport: !validRows.isEmpty && invalidRows.isEmpty,
            warnings: [
                "Preview only: no database rows were created or changed.",
                "InventoryID is optional; the API generates a UUID when it is omitted.",
                "Images are not imported from CSV; attach them through FileMetadata after import."
            ]
        )
    }

    private func parse(_ csv: String) throws -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var value = ""
        var quoted = false
        var index = csv.startIndex

        func finishValue() {
            row.append(value)
            value = ""
        }

        while index < csv.endIndex {
            let character = csv[index]
            if quoted {
                if character == "\"" {
                    let next = csv.index(after: index)
                    if next < csv.endIndex, csv[next] == "\"" {
                        value.append("\"")
                        index = next
                    } else {
                        quoted = false
                    }
                } else {
                    value.append(character)
                }
            } else {
                switch character {
                case "\"" where value.isEmpty:
                    quoted = true
                case ",":
                    finishValue()
                case "\n":
                    finishValue()
                    rows.append(row)
                    row = []
                case "\r": break
                default:
                    value.append(character)
                }
            }
            index = csv.index(after: index)
        }

        guard !quoted else { throw HomeInventoryCSVPreviewError.malformedRow(rows.count + 1) }
        if !value.isEmpty || !row.isEmpty {
            finishValue()
            rows.append(row)
        }
        return rows
    }
}
