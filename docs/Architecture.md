# Architecture

GemsForgeAPI is a private Swift/Vapor API for the Gem Life personal operating
system. Its first persistence layer is SQLite accessed through Fluent.

## Request and data flow

```text
HTTP request
    ↓
Sources/main.swift
    ↓
Routes (request validation and HTTP responses)
    ↓
Services (database operations)
    ↓
Models (Swift representation of records)
    ↓
Fluent migrations and SQLite database
```

The layers have deliberately separate responsibilities:

- **Entry point** starts and shuts down the Vapor application.
- **Configuration** registers the database and migrations.
- **Routes** translate HTTP requests into validated application operations and
  return HTTP responses.
- **Services** contain reusable database operations.
- **Models** describe the shape of records in Swift and map them to tables.
- **Migrations** create or change the database schema in a repeatable order.
- **Tests** verify behavior without requiring a running production server.

## Project structure

```text
GemsForgeAPI/
├── Package.swift
├── Package.resolved
├── README.md
├── Sources/
│   ├── main.swift
│   ├── DatabaseConfiguration.swift
│   ├── Migrations/
│   │   ├── CreateDomains.swift
│   │   └── CreateForgeKeeper.swift
│   ├── Models/
│   │   ├── Domain.swift
│   │   └── ForgeKeeper.swift
│   ├── Routes/
│   │   └── DomainRoutes.swift
│   └── Services/
│       └── DomainService.swift
├── Tests/
│   └── GemsForgeAPITests/
│       ├── HealthTests.swift
│       └── DomainRouteTests.swift
└── docs/
    ├── Architecture.md
    ├── Database-Migrations.md
    ├── Local-Development.md
    └── Services.md
```

## Entry file

`Sources/main.swift` is the executable entry point. It:

1. Creates a Vapor `Application`.
2. Calls `app.configureDatabase()` to register SQLite and migrations.
3. Registers the health endpoint.
4. Registers the domain routes.
5. Starts the server with `app.execute()`.
6. Shuts down the application cleanly with `app.asyncShutdown()`.

The entry file is intentionally small. Feature-specific configuration,
database access, and route definitions live in their own files so they can be
understood and tested independently.

## Dependency registry

`Package.swift` is the Swift Package Manager manifest. It is the dependency
registry for the project:

- **Vapor** provides the HTTP server and application lifecycle.
- **Fluent** provides the model, query, migration, and database abstractions.
- **FluentSQLiteDriver** connects Fluent to SQLite.
- **XCTVapor** and **VaporTesting** support endpoint tests.

`Package.resolved` records the exact versions resolved for the project. Source
code should import only the library it directly uses.

## Database flow

`Sources/DatabaseConfiguration.swift` registers the SQLite file and adds the
migrations in dependency order:

```text
CreateDomains
    ↓
CreateForgeKeeper
```

`forgekeeper.domain_id` references `domains.id`, so the domains table must be
created first. Fluent applies migrations when the application starts. The
database path defaults to `GemsForgeAPI.sqlite` and can be overridden with the
`DATABASE_PATH` environment variable.

The current Gem Life structure is:

```text
domains
    └── forgekeeper
            └── parent/child pages
```

The four root domain identifiers are `POS`, `FOUNDATION`, `LIFE`, and
`KNOWLEDGE`. These identifiers are stable values and should not be casually
renamed because other records can refer to them.

## Testing boundary

Route tests create an application configured with an in-memory SQLite database,
run the migrations, and exercise the HTTP endpoints. This keeps tests isolated
from the local development database while still verifying the full route →
service → model → database path.

The test target is explicitly limited to `Tests/GemsForgeAPITests` in
`Package.swift`. This prevents application files from being accidentally
included in the test target.
