# Service layer

The service layer is the boundary between HTTP routes and the database.

```text
HTTP route
    ↓
DomainService
    ↓
Fluent model and database
```

`DomainService` owns the database operations for `Domain` records:

- `list()` retrieves all domains.
- `find(id:)` retrieves one domain by its stable identifier.
- `save(_:)` creates or updates a domain.
- `delete(id:)` removes a domain when it exists.

Routes will use this service later. Keeping the queries here means route
handlers do not need to know table names, Fluent query syntax, or how a record
is saved. That makes the API easier to test and gives the persistence logic one
place to evolve.

The service does not create migrations and does not define HTTP endpoints. Those
responsibilities remain with the migration and route layers.

## Layer distinction

```text
Migrations → change database structure
Services   → read and change database records
Routes     → expose services through HTTP
Models     → describe database records in Swift
Tests      → verify the behavior
```

For example, adding a `Status` column is a migration, updating a domain title
is a service operation, `PATCH /domains/:id` is a route, and a table model
represents the row being read or changed.

## EducationService

`EducationService` performs database operations for Life-area education records
in the existing `Education` table. The table is not linked to `Domains`, so the
service does not apply a domain filter.

```text
Education route
    ↓
EducationService
    ↓
Education table model
    ↓
Education table
```

The service provides `list()`, `find(id:)`, `save(_:)`, and `delete(id:)`.
The local testing console uses the read operations first: `list()` and
`find(id:)`. See [`Education.md`](Education.md) for the field map and endpoint
contract.

## ForgeKeeperService

`ForgeKeeperService` performs persistence operations for pages in the existing
`ForgeKeeper` table. It uses the mapped `ForgeKeeper` table model and does not
create tables or run migrations.

```text
ForgeKeeper route
    ↓
ForgeKeeperService
    ↓
ForgeKeeper table model
    ↓
ForgeKeeper table
```

### List every page

```swift
let service = ForgeKeeperService(database: request.db)
let pages = try await service.list()
```

Pages are returned in title order.

### List pages for one domain

```swift
let pages = try await service.list(domainID: "LIFE")
```

The domain ID is the existing stable value from the `Domains` table, such as
`POS`, `FOUNDATION`, `LIFE`, or `KNOWLEDGE`.

### Find one page

```swift
guard let page = try await service.find(id: pageID) else {
    throw Abort(.notFound)
}
```

### Save a page

```swift
let page = ForgeKeeper(
    domainID: "LIFE",
    title: "Household",
    description: "Household pages."
)

try await service.save(page)
```

`save` inserts a new record when the page has no ID. It updates an existing
record when the page already has an ID.

### Delete a page

```swift
try await service.delete(id: pageID)
```

Deletion is currently used by isolated tests and remains separate from the
read-focused production workflow until a deliberate API endpoint is approved.

## EmploymentService

`EmploymentService` performs persistence operations for Life-area employment
records in the existing `Employment` table. The table is not linked to
`Domains`, so the service does not apply a domain filter.

```text
Employment route
    ↓
EmploymentService
    ↓
Employment table model
    ↓
Employment table
```

The service provides `list()`, `find(id:)`, `save(_:)`, and `delete(id:)`.
`list()` orders records by start date and employer name. The local testing
console will use the read operations first. See [`Employment.md`](Employment.md)
for the field map, endpoint contract, and privacy boundary.

## AddressService

`AddressService` performs persistence operations for the existing `Addresses`
table. Education and Employment routes use the address model through this
database boundary when expanding their foreign-key references into response
objects.

The service provides `list()`, `find(id:)`, `save(_:)`, and `delete(id:)`.
The Addresses list route applies a summary DTO so street lines, postal codes,
and notes are not returned in a collection response.

## GemHueService

`GemHueService` reads Foundation reference data from the existing `GemHues` and
`GemHueImages` tables:

- `list()` returns the Gem Hue records.
- `find(id:)` returns one Gem Hue by ID.
- `image(id:)` returns the associated image blob when one exists.

The current console uses these read operations only. Gem Hues are not assigned
to a domain in the current database schema.

## ExpenseTransactionService

`ExpenseTransactionService` performs persistence operations for expense records
in the existing `Transactions` table. The service preserves the database's
existing category and subcategory references and does not create a Service
Account or file relationship before those focused schema contracts are defined.

The service provides:

- `list()` for the documented expense transaction collection.
- `find(id:)` for one transaction by its stable transaction ID.
- `save(_:)` for the test and API write workflow.
- `delete(id:)` for the test and API delete workflow.

See [`Expense-Transactions.md`](Expense-Transactions.md) for the field map,
endpoint contract, migration boundary, and verification checkpoint.

## ExpenseCategoryService

`ExpenseCategoryService` persists reusable expense classifications in the
existing `BudgetCategories` table. It provides:

- `list()` for categories ordered by name.
- `find(id:)` for one stable category identifier.
- `save(_:)` for create and update operations.
- `delete(id:)` for unused categories; transaction foreign keys remain the
  final protection for referenced records.

The service does not store emoji presentation values. See
[`Expense-Categories.md`](Expense-Categories.md) for the field map and
relationship boundary.

## ExpenseSubcategoryService

`ExpenseSubcategoryService` persists hierarchical classifications in the
existing `BudgetSubcategories` table. It provides:

- `list(categoryID:)` for all subcategories or one parent category.
- `find(id:)` for one stable subcategory identifier.
- `save(_:)` for create and update operations.
- `delete(id:)` for unused subcategories; transaction foreign keys remain the
  final protection for referenced records.

The route layer verifies that the parent category exists and that the name is
unique within that parent. See [`Expense-Subcategories.md`](Expense-Subcategories.md)
for the field map and hierarchy contract.

## FileMetadataService

`FileMetadataService` persists descriptions of files stored in the local asset
directory. It does not read, write, move, or delete files on disk. The service
provides:

- `list()` for metadata records ordered by file kind and name.
- `find(id:)` for one metadata record.
- `save(_:)` for create and replace operations.
- `delete(id:)` for metadata deletion only.

The service keeps file storage separate from database persistence so a later
upload feature can define its own security and lifecycle rules. See
[`File-Metadata.md`](File-Metadata.md) for the complete field map and route
contract.

## ServiceAccountService

`ServiceAccountService` performs persistence operations for recurring services
and obligations in the existing `Services` table. The API calls these records
Service Accounts to distinguish them from individual expense transactions.

The service provides `list()`, `find(id:)`, `save(_:)`, and `delete(id:)`.
Future transaction-to-service relationships must be defined explicitly rather
than inferred from display names or duplicated into transaction rows.

See [`Service-Accounts.md`](Service-Accounts.md) for the field map, endpoint
contract, and migration boundary.

## ServiceLogoService

`ServiceLogoService` reads logo assets from the existing `ServiceLogoAssets`
table. It returns the legacy image record to the route layer, where collection
and detail responses are converted to metadata summaries and the binary is
served only through the explicit image endpoint.

The service provides:

- `list()` for all logo assets ordered by `LogoKey`.
- `find(id:)` for one logo asset by `LogoAssetID`.

It does not alter the personal database or assume the future FileMetadata
relationship. See [`Service-Logos.md`](Service-Logos.md) for the compatibility
boundary and image response contract.
