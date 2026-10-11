# Local database creation

Issue #61 adds a guarded workflow for creating disposable SQLite databases for
development and testing. It does not replace or migrate the personal Gem Life
database.

## Why this exists

The API normally connects to the existing database through `DATABASE_PATH`.
That database is the source of truth and must not be changed implicitly at
startup. Some development work needs a fresh schema, however, especially when
testing migrations or creating tables that do not yet exist in the personal
database. The local database workflow creates a separate file for that work.

## Configuration

The feature is disabled by default. Set these values in the local `.env` file
or the Xcode Run scheme:

```text
LOCAL_DATABASE_CREATION_ENABLED=true
LOCAL_DATABASE_DIRECTORY=/absolute/path/to/local/test-databases
```

`LOCAL_DATABASE_DIRECTORY` must already exist and must be a directory. Keep it
separate from the directory containing the personal database. The committed
`.env.example` contains placeholders only; never commit the real `.env` file
or a real database path.

## API contract

### `GET /local-databases/capabilities`

Returns whether creation is enabled and ready, the available profiles, the
migration names for each profile, and the safety rules displayed by the
console. This endpoint does not create or modify anything.

### `POST /local-databases`

Accepts:

```json
{
  "databaseName": "GemLife_Test.sqlite",
  "profile": "gem-life-development",
  "confirmCreation": true
}
```

The response reports the created filename and migration count. It intentionally
does not return the absolute filesystem path.

## Safety boundaries

- The feature must be explicitly enabled.
- The destination directory must already exist.
- Only simple `.sqlite` filenames are accepted; path separators and traversal
  segments are rejected.
- The request must explicitly confirm creation.
- Existing files cannot be overwritten.
- The personal database selected by `DATABASE_PATH` is protected.
- Only the approved `gem-life-development` migration profile is available.
- The route is intended for local development and must not be exposed through
  public or forwarded network access.

## Implementation map

- `Sources/LocalDatabaseConfiguration.swift` reads configuration and enforces
  destination safety.
- `Sources/Services/LocalDatabaseService.swift` reserves the new file,
  registers the profile migrations, and runs `autoMigrate()` in an isolated
  Vapor application.
- `Sources/Routes/LocalDatabaseRoutes.swift` exposes the capabilities and
  creation endpoints.
- `Console/src/features/databases/LocalDatabaseView.tsx` provides the browser
  form and migration preview.

## Failure behavior

Validation failures leave the existing filesystem unchanged. If migration of a
new file fails after the file is reserved, the file is left in place so the
failure can be inspected or removed deliberately; it is never silently
overwritten or redirected to the personal database.

## Verification

`LocalDatabaseRouteTests` verifies the disabled state, explicit confirmation,
successful creation of the full profile in a temporary directory, duplicate
filename rejection, personal-database protection, and path traversal
rejection. The full test suite remains the required verification before review.
