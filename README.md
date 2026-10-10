# GemsForgeAPI

Private Swift and Vapor API for GemsForge personal data services.

The project is designed to run locally on a Mac and remain private behind a secure network connection. It uses Vapor for HTTP services, Fluent for database access, and SQLite for the initial local database.

## Current status

The project currently includes:

- Swift Package Manager project configuration.
- Vapor web framework.
- Fluent database abstraction.
- FluentSQLiteDriver for SQLite support.
- Swift 6-compatible asynchronous application startup.
- SQLite database configuration.
- Temporary `GET /health` endpoint.
- Automated health endpoint test.

The CRUD layer, authentication, production hosting, and remote private-network access are planned next.

## Requirements

- macOS.
- Xcode with Swift support.
- Swift 6.1 or newer.
- A private network connection for remote access when the API is hosted at home.

## Project structure

```text
GemsForgeAPI/
├── Package.swift
├── Package.resolved
├── README.md
├── PROJECT_SETUP_NOTES.md
├── Sources/
│   └── main.swift
└── Tests/
    └── GemsForgeAPITests/
        └── HealthTests.swift
```

### Entry file

`Sources/main.swift` is the application entry point. It creates the Vapor application, registers the database, defines the initial health route, starts the server, and handles asynchronous shutdown.

### Dependency registry

`Package.swift` is the Swift Package Manager manifest. It declares the project dependencies and determines which libraries are available to the application and test targets.

### Tests

Tests are stored separately under `Tests/GemsForgeAPITests`. This prevents application sources from being included in the test target and keeps the project structure predictable.

## Dependencies

- [Vapor](https://github.com/vapor/vapor) — Swift web framework.
- [Fluent](https://github.com/vapor/fluent) — database abstraction and ORM layer.
- [FluentSQLiteDriver](https://github.com/vapor/fluent-sqlite-driver) — SQLite driver for Fluent.

Swift Package Manager resolves the exact dependency versions recorded in `Package.resolved`.

## Database configuration

The API uses SQLite during initial development. By default, the database file is created as:

```text
GemsForgeAPI.sqlite
```

The database location can be overridden with the `DATABASE_PATH` environment variable. This keeps the implementation portable between local development, tests, backups, and future hosting environments.

## Running the project

Open the project directory in Xcode:

```text
/Users/gemsforge/GemsForgeAPI
```

The project can also be built and tested with Swift Package Manager:

```bash
swift build
swift test
```

The current verification checkpoint is the health test:

```text
GET /health → 200 OK → ok
```

## Planned architecture

The API will be developed in this order:

1. Entry point and application configuration.
2. Dependency registration.
3. Domain models.
4. Database migrations.
5. Database services or repositories.
6. CRUD routes.
7. Authentication and authorization.
8. Automated tests.
9. Private hosting and backups.

Route handlers should coordinate requests and responses without containing all database logic. Database access belongs in services or repositories so it can be tested, changed, and reused independently.

## Privacy and hosting direction

The intended deployment is private. The API should not be exposed directly to the public internet or require router port forwarding. A secure private VPN can provide access from an iPhone, iPad, or remote Mac while the API runs on a home Mac or future always-on Mac mini.

If the host Mac is asleep or offline, the API will be temporarily unavailable. Independent database backups remain necessary even when the API is hosted locally.

## Project management

Development work is tracked in the private GitHub repository and its Kanban project:

- Repository: `GemsForge/GemsForgeAPI`
- Initial milestone: `v0.1 - MVP API`
- Workflow: Backlog → Ready → In progress → In review → Done

## Development notes

See [`PROJECT_SETUP_NOTES.md`](PROJECT_SETUP_NOTES.md) for the step-by-step project history and explanations of the setup process.
