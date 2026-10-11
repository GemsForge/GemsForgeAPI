# Live schema inspection

Issue #72 adds a read-only schema snapshot for the configured Gem Life SQLite
database. It is the first step toward safely creating and evolving tables from
the testing console.

## Endpoint

```text
GET /live-database/schema
```

The response includes:

- A non-path database label.
- The number of application tables.
- Each table's name.
- Column names, SQLite data types, nullability, primary-key status, and default
  values.
- Foreign-key columns and their referenced tables and columns.
- Index names, uniqueness, and indexed columns.

SQLite system tables and Fluent's internal migration table are excluded from
the application-table list.

## Safety boundary

This endpoint performs metadata reads only. It does not:

- Create or alter tables.
- Insert, update, or delete records.
- Run migrations.
- Expose the absolute `DATABASE_PATH`.

The API reads the database already configured through `DATABASE_PATH`. The
endpoint therefore provides visibility into the existing Gem Life schema
without changing it.

## Implementation

- `Sources/Services/LiveSchemaService.swift` runs SQLite metadata queries and
  maps them into typed response structures.
- `Sources/Routes/LiveSchemaRoutes.swift` exposes the HTTP endpoint.
- `Tests/GemsForgeAPITests/LiveSchemaRouteTests.swift` verifies table names,
  columns, primary keys, and foreign-key relationships using an isolated
  SQLite database.

The next UI issue will display this response in the React testing console. Only
after that read-only baseline is available should the project add migration
preview or live schema changes.
