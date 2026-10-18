# Gem Life workflow operations

This is the current operational guide for the local API, React testing
console, live SQLite migrations, and GitHub workflow automation.

## Local configuration

The API reads the selected SQLite database from DATABASE_PATH. Set
`GEMLIFE_ENVIRONMENT` to `dev`, `fit`, or `prod` so the active environment is
explicit in startup logs. If omitted, the API uses the safe `dev` default;
it never defaults to `prod`. Live
migrations also require LIVE_DATABASE_BACKUP_DIRECTORY.

For terminal launches, define both values in the ignored repository .env:

~~~text
DATABASE_PATH=/absolute/path/to/GemLife_DB_rebuild.sqlite
LIVE_DATABASE_BACKUP_DIRECTORY=/absolute/path/to/database-backups
~~~

Xcode Run schemes may define the same variables for an Xcode-launched API.
The terminal launcher does not read Xcode schemes, so terminal sessions must
load .env or export the variables separately. Never commit the real .env or
a token.

Pull requests validate against the FIT GitHub Actions environment through
`.github/workflows/database-validation.yml`. The workflow uses temporary
runner-local paths and receives no production database or production secrets.
The GitHub `prod` environment should remain protected by required reviewers
and must not be referenced by pull-request workflows.

To refresh the local FIT copy, stop processes that can write to either file and
run `Scripts/refresh-fit-database.sh` with an approved source database, the FIT
target, and the FIT backup directory. The script refuses to use the same source
and target and refuses target names other than `GemLife_DB_fit.sqlite`.

## API and console startup

From the repository root:

~~~bash
swift run GemLife
~~~

The launcher starts the API and Gem Life host. The API defaults to port 8081
to avoid colliding with existing local API instances on port 8080. Override
the port with `API_PORT` when needed. The React console can also be run
independently from `Console/` with `npm run dev`.

The active console routes include /schema-builder and /live-database.
/live-database is the reviewed interface for inspecting the configured live
schema and applying the repository migration profile.

## Live database migration workflow

The live migration flow is intentionally explicit:

1. Start the API with the intended DATABASE_PATH and backup directory.
2. Open /live-database.
3. Request a repository migration preview.
4. Review the migration names and warnings.
5. Confirm within five minutes.
6. The API creates and verifies a SQLite backup.
7. Existing schema is reconciled with Fluent's migration ledger.
8. Only migrations not already represented by the live schema are applied.
9. The API records success or failure in SchemaMigrationAudits.
10. Reopen the schema view and verify the result.

Confirmation tokens are single-use, expire after five minutes, and are
invalidated when the API restarts. Generate a new preview after a restart or
an expired-token response.

The repository migration path does not blindly replay table-creation
migrations against an existing database. It creates a backup first and
baselines existing tables and columns before calling Fluent's migrator. This
prevents errors such as table "Addresses" already exists while allowing
missing changes such as HomeInventory to be applied.

If execution fails, keep the generated backup, do not delete or recreate live
tables, correct the reported configuration or migration issue, restart the
API if necessary, and generate a fresh preview.

For the pre-first-login case, when the missing authentication schema prevents
access to protected migration routes, use the offline dev-only procedure in
[`Legacy-Database-Bootstrap-301.md`](Legacy-Database-Bootstrap-301.md). It
backs up the existing database before applying the repository profile and
keeps legacy ownership assignment as a separate operator decision.

## FileMetadata and attachments

FileMetadata stores the relationship between a local file and structured
records. Binary content remains in the configured local storage area; the
database stores the metadata and stable identifier.

Attachment-bearing records use a FileMetadata identifier:

- Addresses.ImageFileMetadataID
- Education.DocumentFileMetadataID
- HomeInventory.ImageFileMetadataID
- Services.LogoFileMetadataID
- Transactions.Image
- GemHueImages.FileMetadataID
- ServiceLogoAssets.FileMetadataID

Replacing an attachment creates or selects a new metadata record and updates
the owner reference. Historical metadata can remain available for retrieval
or restoration according to the attachment lifecycle policy.

## GitHub workflow

The working issue is the source of truth. A branch includes its issue number,
for example fix/205-live-metadata-migration, and a pull request includes a
closing reference such as Closes #205.

Before implementation, check out the dedicated issue branch, push it to the
remote, and link that branch to the GitHub story. Keep the branch and commits
focused on that story; every commit subject must include its issue number.
Create multiple small, coherent commits for independently reviewable parts of
the implementation (for example contracts/types, shared implementation,
resource integrations, and tests/docs). Never collapse an entire story's
implementation into one commit or squash its focused commits into a single
commit. Push the focused commits so progress is visible on the story branch.
Keep stacked PRs based on their parent story branch, make the dependency clear,
and do not merge any PR unless explicitly instructed.

The issue workflow synchronizes:

- labels, assignees, and milestone from the issue to its pull request;
- issue and pull-request membership in the user-owned GemsForgeAPI Project
  (#7), using the PROJECTS_TOKEN repository secret;
- ProjectV2 status from lifecycle state;
- native parent/sub-issue and blocked-by/blocking relationships when supplied;
- issue closure when a closing pull request is merged into master.

The metadata workflow uses GITHUB_TOKEN for repository issue and pull-request
operations and PROJECTS_TOKEN for user-owned ProjectV2 operations. Project
access failures are distinct from issue metadata failures and must be
diagnosed as token/project visibility or permission problems.

Merged-branch cleanup is best effort. The workflow preserves the repository's
least-privilege token and reports a notice when branch deletion is unavailable
to that token; metadata synchronization does not fail solely because cleanup
cannot run.

## Commit policy

Commit subjects and pull-request titles use:

~~~text
type(scope): #issue short imperative description
~~~

The type and scope are lowercase, the issue number is positive, and the
description begins with a lowercase word. Approved types are defined in
Scripts/commit-policy.json.

The local pre-push hook and GitHub Action validate new commits. GitHub-generated
standard merge commits, including Merge pull request #N from ..., are
recognized as merge commits and are exempt from the subject format. Arbitrary
merge, revert, or fixup messages are still rejected.

The complete DEV → FIT → PROD promotion, backup, verification, and restore
procedure is documented in `docs/Database-Promotion-Workflow.md`.

Property-level API updates follow the contract in
`docs/Property-Patch-Contract.md`. Resource handlers and UI controls must use
that document as the source of truth for omission, nullability, immutable
fields, relationship updates, and field-level errors.

## Story creation

Use Scripts/create-github-story.mjs as the repository story-creation entry
point. The helper infers the type and scope labels from the required
`type(scope): short imperative description` title, preserves any explicit
additional labels, and rejects unknown mappings. Use existing labels only and
provide relationship inputs explicitly. A story should receive its standard
assignee, milestone, project membership, and initial Backlog status unless a
branch or pull request establishes a later lifecycle state.

Native relationships belong in GitHub relationship fields rather than being
duplicated as prose. The issue description should still contain implementation
context and acceptance criteria.

## Verification commands

For the API:

~~~bash
swift build
swift test
~~~

For the console:

~~~bash
npm run format:check
npm run lint
npm run test
npm run build
~~~

These checks are also run by the repository GitHub Actions where configured.
