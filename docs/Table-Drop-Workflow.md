# Reviewed user-created table deletion

Issue #548 adds a Hub-scoped deletion workflow for eligible user-created
tables. It is separate from the generic live migration preview and executor;
the Console cannot submit SQL or arbitrary table identifiers for execution.

## Safety sequence

1. Open **Delete table** from an eligible schema collection. The API inspects
   the live schema and returns a read-only preview.
2. Review the Hub row count, metadata inventory (including Notion import
   mappings), blockers, and file references
   that would become unreferenced. File contents are never removed by table
   deletion.
3. Type the exact table name. The token expires after five minutes and can be
   used once.
4. The API rechecks the table data and metadata snapshot. If it changed, the
   request returns `409` with a new preview and requires another review.
5. The API creates and verifies a full SQLite backup before starting a
   transaction. A backup failure prevents deletion.
6. In one transaction, the API removes only the authenticated Hub's views,
   query/view configuration, property and column definitions, record
   presentations and bodies, trash entries, Notion import mappings, and
   attachment metadata for the table, so a later Notion import does not reuse
   the dropped table's name or record IDs. It then validates the table identifier from the inspected schema,
   drops the table, verifies the result, and writes an audit row with the
   backup filename and affected counts.

The route is authenticated and Hub scoped:

```text
POST /live-schema/tables/:tableName/drop-preview
POST /live-schema/tables/:tableName/drop
```

Built-in migration tables and protected service tables are never eligible.
Foreign-key references, Relation or Lookup definitions targeting the table,
data owned by another Hub, and metadata owned by another Hub block deletion.
Stale attachment metadata whose owner record is missing also blocks deletion
until that reference is repaired; the workflow never widens cleanup to
unrelated owner IDs.
The generic live migration routes continue to reject `drop-table` operations.

The endpoint requires the same `DATABASE_PATH` and
`LIVE_DATABASE_BACKUP_DIRECTORY` configuration as live schema changes. Backup
files are returned by filename, not absolute path. Audit history is available
from `GET /live-database/migrations/history`.
The verified schema executor also records a failed attempt when backup creation
fails; the target table and its owned metadata remain unchanged in that case.

Recovery remains an operator action. Stop the API, preserve the current file,
verify the named backup, and restore it only after confirming the destination.
See [`Live-Database-Backups.md`](Live-Database-Backups.md) for backup
validation and recovery details.
