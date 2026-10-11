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
