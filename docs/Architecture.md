# Architecture

GemsForgeAPI is a private Swift/Vapor API for the Gem Life personal operating
system. Its first persistence layer is SQLite accessed through Fluent.

## Request and data flow

```text
React testing console, fallback browser console, or other HTTP client
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
├── Console/
│   ├── package.json
│   ├── src/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── features/
│   └── README.md
├── Public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── Sources/
│   ├── main.swift
│   ├── DatabaseConfiguration.swift
│   ├── Migrations/
│   │   ├── CreateAddresses.swift
│   │   ├── CreateDomains.swift
│   │   ├── CreateEducation.swift
│   │   ├── CreateEmployment.swift
│   │   ├── CreateExpenseTransactions.swift
│   │   ├── CreateFileMetadata.swift
│   │   ├── CreateServiceAccounts.swift
│   │   ├── CreateForgeKeeper.swift
│   │   ├── CreateGemHues.swift
│   │   └── CreateGemHueImages.swift
│   ├── Models/
│   │   ├── DTOs/
│   │   │   ├── AddressDTOs.swift
│   │   │   └── ForgeKeeperPatchRequest.swift
│   │   └── Table/
│   │       ├── Address.swift
│   │       ├── Domain.swift
│   │       ├── Education.swift
│   │       ├── Employment.swift
│   │       ├── ExpenseTransaction.swift
│   │       ├── FileMetadata.swift
│   │       ├── ServiceAccount.swift
│   │       ├── ForgeKeeper.swift
│   │       ├── GemHue.swift
│   │       └── GemHueImage.swift
│   ├── Routes/
│   │   ├── AddressRoutes.swift
│   │   ├── DomainRoutes.swift
│   │   ├── EducationRoutes.swift
│   │   ├── EmploymentRoutes.swift
│   │   ├── ExpenseTransactionRoutes.swift
│   │   ├── FileMetadataRoutes.swift
│   │   ├── ServiceAccountRoutes.swift
│   │   ├── ForgeKeeperRoutes.swift
│   │   └── GemHueRoutes.swift
│   └── Services/
│       ├── AddressService.swift
│       ├── DomainService.swift
│       ├── EducationService.swift
│       ├── EmploymentService.swift
│       ├── ExpenseTransactionService.swift
│       ├── FileMetadataService.swift
│       ├── ServiceAccountService.swift
│       ├── ForgeKeeperService.swift
│       └── GemHueService.swift
├── Tests/
│   └── GemsForgeAPITests/
│       ├── HealthTests.swift
│       ├── DomainRouteTests.swift
│       ├── ExpenseTransactionRouteTests.swift
│       ├── FileMetadataRouteTests.swift
│       └── ServiceAccountRouteTests.swift
└── docs/
    ├── Architecture.md
    ├── Database-Migrations.md
    ├── File-Metadata.md
    ├── Local-Development.md
    └── Services.md
```

## Entry file

`Sources/main.swift` is the executable entry point. It:

1. Creates a Vapor `Application`.
2. Calls `app.configureDatabase()` to register the SQLite database selected by
   `DATABASE_PATH`.
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

`Sources/DatabaseConfiguration.swift` registers the existing Gem Life SQLite
file selected by `DATABASE_PATH`. The application does not automatically create
or migrate these tables at startup because they already exist outside the API
project. The migrations in the repository mirror the schema for isolated tests.

The test target uses isolated in-memory SQLite databases and registers test
migrations that mirror the existing schema. Those test migrations are not
executed against the Gem Life database.

The existing table relationship is:

```text
domains
    └── forgekeeper
            └── parent/child pages
```

`ForgeKeeper.DomainID` references `Domains.DomainID`, so the Domains table is
the parent table. The API model maps to the existing names, including
`DomainID`, `Description`, `DateCreated`, and `DateUpdated`.

The database path is supplied through the required `DATABASE_PATH` environment
variable. The real local value is kept in Xcode's Scheme settings rather than
in source code.

The four root domain identifiers are `POS`, `FOUNDATION`, `LIFE`, and
`KNOWLEDGE`. These identifiers are stable values and should not be casually
renamed because other records can refer to them. See
[`ForgeKeeper.md`](ForgeKeeper.md) for the complete endpoint and schema map.

Education is currently classified conceptually as Life-area data, but its table
does not contain a `DomainID` relationship. The API preserves that schema and
does not force Education records into the Domains hierarchy.

Employment is also classified conceptually as Life-area data, but its table
does not contain a `DomainID` relationship. The API preserves that schema and
does not force Employment records into the Domains hierarchy. Its employer
contact fields are sensitive and should remain behind local or authenticated
access.

Employment feature files are organized with the other table-backed features:

- `Sources/Models/Table/Employment.swift` maps the existing table.
- `Sources/Services/EmploymentService.swift` owns persistence operations.
- `Sources/Routes/EmploymentRoutes.swift` exposes the HTTP contract.
- `Sources/Migrations/CreateEmployment.swift` supports isolated tests only.
- `Tests/GemsForgeAPITests/EmploymentRouteTests.swift` verifies the route
  behavior with an in-memory database.

Expense Transactions are Life-area financial records in the existing
`Transactions` table. The current table stores category and subcategory IDs,
but it does not yet contain a Service Account or image relationship. Those
relationships remain separate focused changes so the API preserves the
database schema instead of inventing links.

Expense Transaction feature files are organized with the other table-backed
features:

- `Sources/Models/Table/ExpenseTransaction.swift` maps the existing table.
- `Sources/Services/ExpenseTransactionService.swift` owns persistence
  operations.
- `Sources/Routes/ExpenseTransactionRoutes.swift` exposes the HTTP contract.
- `Sources/Migrations/CreateExpenseTransactions.swift` supports isolated tests
  only.
- `Tests/GemsForgeAPITests/ExpenseTransactionRouteTests.swift` verifies CRUD
  behavior with an in-memory database.

FileMetadata is the local-file bridge for future image, document, and other
asset workflows. It stores portable file descriptions in SQLite rather than
large binary file contents. The current feature deliberately stops at metadata:
the upload workflow that writes files to disk will be designed separately.

FileMetadata feature files are organized with the other table-backed features:

- `Sources/Models/Table/FileMetadata.swift` maps the metadata table.
- `Sources/Services/FileMetadataService.swift` owns metadata persistence only.
- `Sources/Routes/FileMetadataRoutes.swift` exposes metadata CRUD and safety
  validation.
- `Sources/Migrations/CreateFileMetadata.swift` supports isolated tests only.
- `Tests/GemsForgeAPITests/FileMetadataRouteTests.swift` verifies the route
  contract and path/ownership validation.

See [`File-Metadata.md`](File-Metadata.md) for the field map, endpoint
contract, and file-operation boundary.

Service Accounts map the existing `Services` table under the clearer API
concept used for recurring services and obligations. They are distinct from
individual expense transactions. The API preserves the table's historical
name and existing identifiers while exposing `/service-accounts` routes.

The Service Account migration is test-only; the production API does not create
or alter the real `Services` table at startup. See
[`Service-Accounts.md`](Service-Accounts.md) for the field map and relationship
boundary.

Gem Hues are Foundation reference data rather than a domain child. Their table
and image model, service, and routes live alongside the other table-backed
features. Education, Employment, and Addresses are classified as Life-area
data, but their existing tables do not contain a `DomainID`; the API preserves
that schema instead of inventing a relationship. Address references are
expanded into response DTOs when they resolve.

## Testing boundary

Route tests create an application configured with an in-memory SQLite database,
run the migrations, and exercise the HTTP endpoints. This keeps tests isolated
from the local development database while still verifying the full route →
service → model → database path.

The test target is explicitly limited to `Tests/GemsForgeAPITests` in
`Package.swift`. This prevents application files from being accidentally
included in the test target.
