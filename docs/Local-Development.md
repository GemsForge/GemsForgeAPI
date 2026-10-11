# Local development

## Prerequisites

- macOS 14 or newer.
- Xcode with Swift support.
- Swift 6.1 or newer.
- The checked-out `GemsForgeAPI` repository.

Xcode provides the IDE, debugger, test interface, and source-control view.
Swift Package Manager, invoked by Xcode or the terminal, resolves the Vapor,
Fluent, and SQLite dependencies declared in `Package.swift`.

## Build and test

From the repository directory:

```bash
swift build
swift test
```

`swift test` is the normal verification step before a branch is reviewed. The
tests use an in-memory database where database state is needed, so they do not
modify the local SQLite file.

## Run locally

Start the API with:

```bash
swift run
```

Verify the health endpoint:

```bash
curl http://127.0.0.1:8080/health
```

The expected response is:

```text
ok
```

The root URL `/` is not an application route, so a `404 Not Found` response at
that URL is expected. It does not indicate that the server failed to start.

## Database location

The application requires the existing Gem Life database path through
`DATABASE_PATH`:

```text
/absolute/path/to/GemLife_DB_rebuild.sqlite
```

To use another database location:

```bash
DATABASE_PATH=/path/to/GemsForgeAPI.sqlite swift run
```

The running API reads and writes the configured database. Configure the value
in the Xcode Scheme or export it in a terminal:

```bash
export DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite"
swift run
```

Do not point it at a copy unless that copy has the same schema. Do not commit
SQLite database files,
credentials, environment files, Xcode derived data, or personal setup notes.
The repository `.gitignore` protects these local-only files.

## Development workflow

Each meaningful change should have its own issue and feature branch based on
`master`:

```text
master
    └── feat-or-docs/<issue>-<short-description>
```

The expected sequence is:

1. Start from an up-to-date `master` branch.
2. Create one branch for the issue.
3. Make one significant change at a time.
4. Add or update tests for behavior changes.
5. Run `swift test` and inspect the result.
6. Review the changed files.
7. Commit only the approved significant change.
8. Push the branch and open a pull request targeting `master`.
9. Include a closing keyword such as `Closes #8` in the pull request body.
10. Merge only after review and verification, then delete the merged branch.

## Private hosting assumption

The intended deployment is private. During development, the API is bound for
local use and should not be exposed through router port forwarding. Remote
access can later be provided through a private encrypted VPN, while the API
runs on a Mac at home or an always-on Mac mini.

This means availability depends on the host being awake and connected. It is
also why database backups remain an independent responsibility rather than
being treated as a feature of the API process.
