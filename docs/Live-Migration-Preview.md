# Live migration preview and confirmation

Issue #75 adds a safe API contract for reviewing a schema change before a
future execution workflow applies it to the existing Gem Life database.

## Endpoints

### `POST /live-database/migrations/preview`

Accepts structured operations such as `create-table` and `add-column`. It
returns the named operations, affected table and column identifiers, warnings,
and a short-lived confirmation token.

The endpoint does not execute SQL and does not modify the database. Raw SQL,
destructive operations, system-table identifiers, invalid identifiers, and
overly large requests are rejected.

### `POST /live-database/migrations/confirm`

Accepts the confirmation token from a preview. A valid token is single-use and
expires after five minutes. Confirmation returns `confirmed-not-applied` because
the later table-creation issue will perform execution only after backup and
additional safeguards.

## Intended workflow

1. Inspect the current schema.
2. Generate a migration preview.
3. Show the operations and warnings in the testing console.
4. Create and verify a database backup.
5. Ask the user to confirm the exact preview.
6. Confirm the short-lived token.
7. Execute only the approved operation through `POST /live-database/migrations/execute`.

The preview/confirmation service is intentionally not an arbitrary SQL runner.
It gives the UI a reviewable contract while keeping schema execution in the
separate approved-table issue.

## Approved additive schema changes

Issue #76 adds named, server-owned changes at:

```text
POST /live-database/schema-changes/preview
POST /live-database/schema-changes/execute
```

The initial catalog contains two separate changes for `FileMetadata`:

- `file-metadata-add-domain-id` adds a nullable `DomainID` foreign key to
  `Domains`.
- `file-metadata-index-relative-path` adds an index for `RelativePath`.

Each change is previewed and executed independently. The browser submits only
the approved change ID and short-lived token. It cannot submit SQL or alter the
column, index, or foreign-key definition. Destructive changes remain out of
scope until a separate design review.

## Current approved table

Issue #74 starts with the `file-metadata` table. Its schema is defined on the
server by the existing `CreateFileMetadata` migration. The browser can request
that named table, but it cannot submit its own columns or SQL. Execution first
checks the token, verifies the table is absent, creates a backup, applies the
server-side migration, and re-inspects the schema.

## Migration history

Issue #79 adds a read-only audit endpoint:

```text
GET /live-database/migrations/history
```

Approved live table and schema changes write one record to
`SchemaMigrationAudits` after execution. Each record includes the named
migration, timestamp, result, safe database filename, backup filename, and
failure details when verification or execution fails. The API never stores the
absolute database path or secrets in an audit record.

The audit table is created idempotently when the live migration workflow first
needs it, so an existing personal database can adopt migration history without
being replaced or reset. The testing console can use the history endpoint to
show whether a reviewed change succeeded, failed, or still needs attention.
