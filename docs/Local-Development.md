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

For the full existing-database verification checkpoint, see
[`ForgeKeeper.md`](ForgeKeeper.md). It uses a temporary port and read-only
endpoints so an existing Xcode server on port `8080` is not disturbed.

## Browser testing console

The repository retains the original local browser console in `Public/` as a
fallback. The active testing console is the React + TypeScript project in
`Console/`.

Start the API on port `8081`, then run the console in a second terminal:

```bash
cd Console
VITE_API_TARGET="http://127.0.0.1:8081" npm run dev
```

Open the React console:

```text
http://127.0.0.1:5173/
```

The API-served prototype remains available at the root of the Vapor server:

```text
http://127.0.0.1:8080/
```

Both consoles display stable domains, retrieve ForgeKeeper pages, navigate to
immediate children, exercise page PATCH requests, render Gem Hue records and
image previews, and read Education records. The Notes upload area is currently a design placeholder
because page creation/import has not yet been defined as an API workflow. See
[`Testing-Console.md`](Testing-Console.md).

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

For the planned live schema workflow, configure a separate backup directory
with `LIVE_DATABASE_BACKUP_DIRECTORY`. The backup service uses SQLite's
consistent `VACUUM INTO` snapshot operation and never replaces the source
database. See [`Live-Database-Backups.md`](Live-Database-Backups.md).
The complete preview, confirmation, audit, and recovery procedure is in
[`Live-Schema-Management.md`](Live-Schema-Management.md).

## Create an isolated local database

The API can create a new SQLite file for development and testing. This feature
is disabled by default and is separate from the personal database selected by
`DATABASE_PATH`.

1. Create a dedicated local directory yourself, such as:

   ```text
   /Users/your-name/GemsForgeAPI-local-databases
   ```

2. Set these environment variables in the Xcode Run scheme or terminal:

   ```text
   LOCAL_DATABASE_CREATION_ENABLED=true
   LOCAL_DATABASE_DIRECTORY=/absolute/path/to/local/test-databases
   ```

3. Open the React testing console and select **Developer → Local Databases**.

The console sends only a database filename and migration profile. It never
sends an absolute filesystem path. The API accepts simple `.sqlite` filenames,
requires explicit confirmation, rejects path traversal, refuses to overwrite
existing files, and protects the personal `DATABASE_PATH` file. The approved
`gem-life-development` profile applies the isolated migrations listed in
[`Local-Database-Creation.md`](Local-Database-Creation.md).

Keep this capability local. Do not expose the route through a public or
forwarded network connection.

## Local image uploads

The API accepts image uploads at `POST /file-uploads` when
`ASSET_DIRECTORY` is configured. The directory is intentionally separate from
the SQLite file. The API writes each upload beneath an `uploads/` subdirectory
using a generated filename, then stores only its portable relative path and
metadata in `FileMetadata`.

Configure:

```text
ASSET_DIRECTORY=/absolute/path/to/your/local-assets
ASSET_MAX_BYTES=10485760
```

`ASSET_MAX_BYTES` defaults to 10 MiB. Only image MIME types are accepted, and
the API rejects path traversal, oversized files, and mismatched owner fields.
The response never exposes the absolute asset directory. Uploading a file does
not alter the personal database schema; it creates a `FileMetadata` record in
the configured database.

After upload, retrieve the file through `GET /file-metadata/:id/content` and
attach its metadata ID to an owner record. See
[`Attachment-Lifecycle.md`](Attachment-Lifecycle.md) for the owner fields,
replacement order, cleanup boundary, and testing-console workflow.

## Development workflow

Each meaningful change should have its own issue and feature branch based on
`master`:

```text
master
    └── feat-or-docs/<issue>-<short-description>
```

### Commit message policy

Commit messages use the Conventional Commits shape:

```text
type(scope): #issue short imperative description
```

The `type` and `scope` are always lowercase. Keep the scope specific to the
primary focus of the commit and include the issue number for tracked work.
Separate significant changes into focused commits rather than combining a
model, service, route, migration, test, and documentation change into one
large commit.

Use these established types:

- `feat` — new application behavior.
- `fix` — correction of an existing defect.
- `refactor` — internal restructuring without intended behavior change.
- `test` — tests or test infrastructure.
- `docs` — documentation and project procedure.
- `chore` — maintenance and tooling.

Install local push blocking with `node Scripts/install-git-hooks.mjs`.
The GitHub **Commit policy** Action uses the same validator and checks PR
titles for squash merging. See [Commit-Policy.md](Commit-Policy.md) for setup,
legacy history, merge/revert rules, and required-check configuration.

Examples:

```text
feat(crud): #34 add expense tracker model
docs(database): #48 clarify local database configuration
test(service): #34 cover transaction persistence
chore(ui): #35 organize testing console
```

The expected sequence is:

1. Start from an up-to-date `master` branch.
2. Create one branch for the issue.
3. Make one significant change at a time.
4. Add or update tests for behavior changes.
5. Run `swift test` and inspect the result.
6. Review the changed files.
7. Review the staged files and commit only the approved significant change,
   using the lowercase commit-message policy above.
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
