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
7. Execute only the approved operation through the later schema workflow.

The preview/confirmation service is intentionally not an arbitrary SQL runner.
It gives the UI a reviewable contract while keeping schema execution in the
separate approved-table issue.
