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
- `GET /health` endpoint.
- Domain and ForgeKeeper models aligned with the Gem Life database.
- Fluent migrations for the `domains` and `forgekeeper` tables.
- A domain service and CRUD routes.
- Automated health and domain CRUD endpoint tests.

Authentication, production hosting, and remote private-network access remain planned work.

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
├── Sources/
│   ├── main.swift
│   ├── DatabaseConfiguration.swift
│   ├── Migrations/
│   ├── Models/
│   ├── Routes/
│   └── Services/
├── Tests/
│   └── GemsForgeAPITests/
└── docs/
    ├── Architecture.md
    ├── Database-Migrations.md
    ├── Local-Development.md
    └── Services.md
```

### Entry file

`Sources/main.swift` is the application entry point. It creates the Vapor application, registers the database, defines the initial health route, starts the server, and handles asynchronous shutdown.

### Dependency registry

`Package.swift` is the Swift Package Manager manifest. It declares the project dependencies and determines which libraries are available to the application and test targets.

### Documentation

- [`docs/Architecture.md`](docs/Architecture.md) explains the project layers,
  entry point, dependency registry, database flow, and testing boundary.
- [`docs/Database-Migrations.md`](docs/Database-Migrations.md) explains schema
  changes and migration ordering.
- [`docs/Local-Development.md`](docs/Local-Development.md) explains building,
  testing, running, branching, and private-hosting assumptions.
- [`docs/Services.md`](docs/Services.md) explains the database service layer.

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

## Authenticating GitHub for source control

Xcode has its own GitHub authentication area, separate from the GitHub connection used by Codex and separate from the Git credentials used by the command line.

To connect Xcode to GitHub:

1. Open Xcode Settings and select **Source Control**.
2. Enable source control if it is disabled.
3. Choose **Account…** and sign in to the `GemsForge` GitHub account.
4. Create a GitHub personal access token when Xcode requests one.
5. Use a limited expiration period and select only the scopes required by the intended Xcode workflow.
6. Enter the account name and token into Xcode, then sign in.
7. Reopen the project so Xcode refreshes its repository and branch information.

For this project, GitHub source control authentication is used to let Xcode recognize the repository, display branches, review changes, and perform Git operations. Never store a personal access token in the repository or share it in chat.

## Architecture and development

See [`docs/Architecture.md`](docs/Architecture.md) and
[`docs/Local-Development.md`](docs/Local-Development.md) for the current
architecture and development workflow. Route handlers coordinate requests and
responses, while database access belongs in services so it can be tested,
changed, and reused independently.

## Privacy and hosting direction

The intended deployment is private. The API should not be exposed directly to the public internet or require router port forwarding. A secure private VPN can provide access from an iPhone, iPad, or remote Mac while the API runs on a home Mac or future always-on Mac mini.

If the host Mac is asleep or offline, the API will be temporarily unavailable. Independent database backups remain necessary even when the API is hosted locally.

## Project management

Development work is tracked in the private GitHub repository and its Kanban project:

- Repository: `GemsForge/GemsForgeAPI`
- Initial milestone: `v0.1 - MVP API`
- Workflow: Backlog → Ready → In progress → In review → Done

## Personal setup notes

`PROJECT_SETUP_NOTES.md` is a local, ignored file containing the personal
chronological setup history. It is intentionally not part of the repository.
