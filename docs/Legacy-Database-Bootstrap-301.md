# Safe first-run database bootstrap — #301

Use this procedure when an existing local Gem Life database predates the
authentication, hub, or hub-ownership schema. Protected live-migration routes
require a bearer session, so they cannot be used to create the schema required
for the first session. This narrowly scoped command runs locally without
starting an HTTP server; it is not a public migration endpoint.

## Before running

1. Keep the API private and stop Gem Life, the API, and any other process that
   may write to the selected database.
2. Check the ignored repository `.env` configuration described in
   [`Workflow-Operations.md`](Workflow-Operations.md). The selected environment
   must be `dev`, `DATABASE_PATH` must name the existing `.sqlite` file, and
   `LIVE_DATABASE_BACKUP_DIRECTORY` must be an existing directory separate
   from the database's parent directory. The command refuses production, a
   missing or symbolic-link database, and a mismatched confirmation filename.
3. Make sure the database is the intended local file. The command never
   creates, replaces, or selects another database as a fallback.

## Run the bootstrap

From the repository root, provide the exact filename shown by `DATABASE_PATH`:

```bash
Scripts/bootstrap-legacy-database.sh GemLife_DB_dev.sqlite
```

The script loads the ignored `.env` using the same safe environment-loading
rules as the local launcher. The command then creates a verified SQLite backup
before changing the database, applies the repository's named development
migration profile, verifies the hub/session tables and `HubID` columns, and
records success or failure in `SchemaMigrationAudits`. Its output includes the
backup filename and size. It never assigns legacy records to a hub.

If the command fails, preserve both the current database and the named backup.
Inspect the failure before retrying. Follow the restore safeguards in
[`Live-Schema-Management.md`](Live-Schema-Management.md); do not delete or
recreate the database. A backup is not restored automatically.

## Review legacy ownership separately

After the schema bootstrap, start the private API and sign in as the configured
owner. Use the operator-only ownership preview to review unassigned counts by
table and confirm the intended owner hub. Only after reviewing the data should
you submit the assignment request with the preview's exact counts and
confirmation phrase. The detailed authorization and endpoint procedure is in
[`Deployment-Security.md`](Deployment-Security.md).

Assignment is separate from schema migration, startup, and sign-in. It changes
only records whose `HubID` is null, rejects stale previews, and must not be used
for ambiguous ownership. Until reviewed and explicitly assigned, legacy rows
remain invisible to authenticated users.
