# Live schema management and recovery

Issue #78 documents the workflow for carefully changing the existing Gem Life
SQLite database from the local testing console. The personal database is an
existing source of truth. It is not recreated from the repository's isolated
test migrations.

## Two database workflows

| Workflow | Purpose | Database selected |
| --- | --- | --- |
| Isolated local database creation | Create a fresh development database for testing | A new file under `LOCAL_DATABASE_DIRECTORY` |
| Live schema management | Review and apply an approved schema change | The existing file in `DATABASE_PATH` |

The isolated workflow may apply the repository's development migration profile.
The live workflow may only apply a named, server-owned migration after the
preview, backup, confirmation, execution, and verification steps below.

## Required configuration

Live schema management requires both environment variables:

```text
DATABASE_PATH=/absolute/path/to/GemLife_DB_rebuild.sqlite
LIVE_DATABASE_BACKUP_DIRECTORY=/absolute/path/to/database-backups
```

The backup directory must already exist and must be different from the
database file's location. Xcode users set these values in the Run scheme;
terminal users can export them before starting the API. Never commit the real
values, `.env`, SQLite files, or personal setup notes.

## Safe execution sequence

The testing console and API use this sequence for every live schema change:

1. **Inspect** — read the current schema through `GET /live-database/schema`.
2. **Preview** — request a named change or approved table through the preview
   endpoint. The API returns the affected objects, warnings, and a short-lived
   confirmation token.
3. **Review** — show the exact operation and warnings in the console. The
   browser never supplies SQL, column definitions, or arbitrary identifiers.
4. **Back up** — create a verified SQLite snapshot in the configured backup
   directory immediately before execution.
5. **Confirm** — send the short-lived token for the exact reviewed operation.
6. **Execute** — apply the server-owned migration only if the token is valid
   and the operation is not already present in the live schema.
7. **Verify** — inspect the schema again and confirm the expected table,
   column, index, or foreign key exists.
8. **Audit** — record the migration name, timestamp, result, safe database
   identity, backup filename, and failure details when applicable.

The token expires after five minutes and can be used only once. A migration
that is already reflected in the schema is rejected without changing records.

## Operational endpoints

```text
GET  /live-database/schema
GET  /live-database/migrations/history
POST /live-database/migrations/preview
POST /live-database/migrations/confirm
POST /live-database/migrations/execute
POST /live-database/schema-changes/preview
POST /live-database/schema-changes/execute
```

`GET /live-database/migrations/history` reads the `SchemaMigrationAudits`
table. The response includes only the database filename as its identity; it
does not expose the absolute `DATABASE_PATH`.

## Migration naming and scope

Each meaningful schema change gets one focused, named migration. Names should
describe the approved change, for example:

```text
file-metadata-add-domain-id
file-metadata-index-relative-path
file-metadata-create
```

Approved live changes are additive only unless a separate design review
explicitly expands the safety boundary. Arbitrary SQL, table drops, column
drops, silent rewrites, and the isolated development migration profile are not
permitted in this workflow.

## Recovery procedure

If execution or verification fails:

1. Stop the API so no process is writing to the database.
2. Open the configured backup directory and identify the backup filename shown
   in the migration result or audit history.
3. Preserve the current database file before attempting recovery. Do not delete
   it; it may contain useful failure evidence.
4. Confirm the backup is readable using a copy or SQLite inspection tool.
5. Restore the verified backup only after confirming the target path and that
   the API is stopped.
6. Restart the API and call `GET /live-database/schema` to verify the restored
   structure.
7. Review `GET /live-database/migrations/history` before retrying. A failed
   record should explain whether backup, execution, or verification failed.

Restoration is an intentional operator action. The API does not automatically
replace the personal database with a backup, and it never runs recovery from a
browser request.

## What the API does not do

- It does not create a fallback database when `DATABASE_PATH` is missing.
- It does not run all repository migrations against the personal database.
- It does not accept SQL submitted by the browser.
- It does not expose absolute local paths or secrets in responses or audit rows.
- It does not overwrite the personal database automatically.

See [`Live-Migration-Preview.md`](Live-Migration-Preview.md),
[`Live-Database-Backups.md`](Live-Database-Backups.md), and
[`Local-Database-Creation.md`](Local-Database-Creation.md) for the individual
API contracts and isolated-database workflow.
