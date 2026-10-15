# Gem Life database promotion and backup workflow

This procedure moves a schema or migration change from DEV through FIT to
PROD without treating a database copy as a substitute for verification.

## Environments

| Environment | Purpose | Writes allowed |
| --- | --- | --- |
| DEV | Design and local development | Normal development work |
| FIT | Rehearsal and functional validation | Test data and migration rehearsal |
| PROD | Live personal database | Only an approved migration |

FIT must never be refreshed by writing to PROD. Refresh FIT from a verified
PROD backup or from an approved fixture, using a separate destination file.

## Promotion checkpoints

### 1. Design in DEV

- Update the schema or migration in the repository.
- Run the API and migration tests against `GemLife_DB_dev.sqlite`.
- Preview the change and inspect affected tables, columns, indexes, and foreign
  keys.
- Confirm the migration has a stable identity and is safe to run more than
  once.

### 2. Rehearse in FIT

- Use `GEMLIFE_ENVIRONMENT=fit` and the FIT-specific database and backup paths.
- Refresh FIT only from an approved source copy.
- Run the migration preview, execute the migration, and verify the resulting
  schema and API behavior.
- Record the migration identity, source database or fixture, environment,
  operator, timestamp, and outcome.

No PROD approval is valid without a successful FIT rehearsal.

### 3. Approve PROD

- Review the FIT result and migration diff.
- Confirm the PROD environment is selected explicitly; never rely on a default.
- Confirm the backup directory is outside the repository and is writable.
- Obtain the required PROD approval before execution.

### 4. Back up before changing PROD

- Stop API processes that could write to the PROD file.
- Create a timestamped SQLite backup in the protected backup directory.
- Record the backup filename and checksum in the migration audit record or
  operator log. Do not place the database, backup, token, or database contents
  in GitHub artifacts or workflow logs.
- Keep the backup until post-migration verification is complete.

### 5. Preview and execute

- Start the API with `GEMLIFE_ENVIRONMENT=prod` and the PROD paths.
- Request a migration preview and review its confirmation token and expiry.
- Execute only the reviewed migration set.
- Record migration identity, source backup, environment, operator, and result.

### 6. Verify

- Reopen the schema view and verify tables, columns, indexes, and foreign keys.
- Run the affected API routes and attachment or relationship checks.
- Confirm the migration audit records a successful result.
- Keep the pre-change backup until all checks pass.

## Rollback and restore

If preview, execution, or verification fails:

1. Stop the API and prevent further writes.
2. Preserve the failed database and its logs for diagnosis.
3. Do not delete or overwrite the pre-change backup.
4. Restore the backup to a separate temporary file first and inspect it.
5. Replace the PROD database only during a controlled maintenance window after
   confirming the restored copy opens and passes the schema checks.
6. Record the restore operator, source backup, destination, reason, and result.
7. Correct the migration in DEV and repeat the DEV → FIT → PROD sequence.

## Dry-run checklist

The procedure is considered rehearsed when a non-PROD run demonstrates that:

- A backup is created before a schema change.
- The backup remains outside the repository and is not emitted in logs.
- A migration preview can be reviewed before execution.
- Schema and API verification can detect a failed change.
- A separate copy can be restored without modifying PROD.

