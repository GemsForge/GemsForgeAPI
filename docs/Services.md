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
