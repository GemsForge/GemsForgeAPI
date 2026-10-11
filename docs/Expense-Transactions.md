# Expense Transactions integration

Expense Transactions represent documented purchases in the existing
`Transactions` table. The API maps the table as it exists in the Gem Life
database and does not run a production migration at startup.

## Table mapping

| Database column | Swift property | Purpose |
| --- | --- | --- |
| `TransactionID` | `id` | Stable identifier such as `TRX-0001`. |
| `ReceiptID` | `receiptID` | Optional receipt or source-document identifier. |
| `Item` | `item` | Item or expense description. |
| `FirstReceiptItem` | `firstReceiptItem` | Whether this row begins a receipt group. |
| `CategoryID` | `categoryID` | Existing category reference. |
| `SubcategoryID` | `subcategoryID` | Optional existing subcategory reference. |
| `MerchantCode` | `merchantCode` | Existing merchant or store code. |
| `TransactionDate` | `transactionDate` | Existing transaction date text. |
| `Quantity` | `quantity` | Number of units recorded. |
| `RegularPrice` | `regularPrice` | Original unit or listed price. |
| `PaidPrice` | `paidPrice` | Price paid for the item. |
| `Total` | `total` | Recorded transaction total. |
| `Discount` | `discount` | Recorded discount amount. |
| `Notes` | `notes` | Additional transaction context. |
| `Image` | `image` | Optional `FileMetadataID` for an attached image. |
| `DateCreated` | database-managed | Existing creation timestamp text. |
| `DateUpdated` | database-managed | Existing update timestamp text. |

The existing SQLite `NUMERIC` fields are represented as Swift `Double` in this
first API slice. This preserves compatibility with the current database while
leaving room for a dedicated money type if exact financial arithmetic becomes
necessary. Amounts and discounts are validated as non-negative values.

## Service operations

`ExpenseTransactionService` keeps database queries out of the HTTP routes:

- `list()` returns transactions ordered by transaction date and ID.
- `find(id:)` returns one transaction by `TransactionID`.
- `save(_:)` creates or updates a transaction.
- `delete(id:)` deletes one transaction by `TransactionID`.

Image metadata lookup is handled by the transaction route after the reference
has been validated. The service never loads binary file contents.

Category, subcategory, Service Account, and image-reference validation will be
tightened as their focused issues are implemented.

## HTTP endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/transactions` | Returns documented expense transactions. |
| `GET` | `/transactions/:id` | Returns one transaction by ID. |
| `GET` | `/transactions/:id/image` | Returns the referenced FileMetadata record. |
| `POST` | `/transactions` | Creates a transaction with a supplied stable ID. |
| `PUT` | `/transactions/:id` | Replaces editable fields on an existing transaction. |
| `DELETE` | `/transactions/:id` | Deletes one transaction. |

The local testing console integration remains a separate follow-up under issue
#41. The API slice is complete enough to support read-only list and detail
views without adding write controls to the console yet.

## Migration boundary

`CreateExpenseTransactions` exists only for isolated in-memory tests. The
application does not register it against the real Gem Life database because the
`Transactions` table already exists there.

Read-only inspection of the configured Gem Life database found 49 existing
records ranging from `TRX-0001` through `TRX-0049`. No records were changed.
## Image references

Transactions store an optional `Image` value containing a `FileMetadataID`.
The transaction row never stores image bytes. File descriptions remain in the
`FileMetadata` table, where `RelativePath` is portable and absolute filesystem
paths are not returned by the API.

Use `GET /transactions/:id/image` to retrieve the attached file metadata. A
transaction without an image, or with a missing metadata record, returns
`404 Not Found`. Creating or replacing a transaction with an unknown
`FileMetadataID` returns `422 Unprocessable Entity`.

The `AddTransactionImage` migration adds the nullable column to an existing
`Transactions` table. It is separate from `CreateExpenseTransactions` because
schema changes must alter the existing table rather than recreate it.
