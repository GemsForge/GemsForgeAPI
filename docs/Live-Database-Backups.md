# Live database backups

The backup service is now used by the confirmed live migration workflow. See
docs/Workflow-Operations.md for the current end-to-end procedure.

Issue #73 establishes the backup service that will protect the existing Gem
Life SQLite database before a later schema-changing workflow runs.

## What it does

The service uses SQLite's `VACUUM INTO` operation to create a consistent,
non-destructive snapshot of the configured database. It writes a new,
timestamped SQLite file to `LIVE_DATABASE_BACKUP_DIRECTORY` and verifies that
the resulting file is non-empty before reporting success.

The source database is never replaced, deleted, or moved. The API response
returns only the generated backup filename and size; it does not disclose the
absolute local path.

## Configuration

Set this value in the Xcode Run scheme or in the local terminal environment:

```text
LIVE_DATABASE_BACKUP_DIRECTORY=/absolute/path/to/database-backups
```

Create the directory before starting the API. Keep it outside the repository,
do not commit the real `.env`, and do not point it at the personal database
file itself. The service currently has no route or automatic trigger. The
future schema workflow will call it only after an explicit preview and user
confirmation.

## Why this is separate from migrations

Migrations change database structure. Backups preserve a recoverable copy
before that structural change. The intended sequence is:

1. Inspect the live schema.
2. Preview the approved migration.
3. Create and verify a live database backup.
4. Require explicit confirmation.
5. Apply the migration.
6. Record the result in migration history.

This issue implements step 3 as a reusable service. Issues #75 and #79 will
integrate it into the confirmed migration workflow and audit trail.
