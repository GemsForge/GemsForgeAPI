# Notion import foundation

Issue #545 tracks a one-time, one-way move from Notion into GemLife. The import
API is server-side and operator-only because its preview can expose private
workspace metadata.

## Read-only preview

Set `NOTION_API_KEY` in the API process environment. Do not put the token in the
repository, a shared Xcode scheme, request payloads, or logs. The integration
must have access to the pages and data sources being reviewed. The preview is
available at:

```text
GET /notion-import/preview
```

The route uses the authenticated session and requires the configured operator
account. It searches both pages and data sources, follows Notion pagination,
queries data-source rows, and returns each visible resource, its proposed
GemLife target, property storage types, row count, and properties that need
review. This is read-only: it does not write to Notion or GemLife.

The preview marks unknown page/database targets and unsupported property types
for review. Formula values are represented as plain text and flagged. The
current Markdown converter supports common headings, paragraphs, lists, quotes,
code, dividers, checkboxes, and child-page titles; unsupported block types are
reported rather than silently represented as imported content.

## Reviewed import

The preview returns a short-lived, single-use confirmation token bound to the
authenticated Hub and a fingerprint of the captured Notion workspace. Review
every target and unmapped property before submitting:

```text
POST /notion-import/commit
```

The JSON body must contain the `confirmationToken` from the preview,
`confirmImport: true`, and may contain `excludedNotionIDs` for resources that
should be skipped. The server refreshes the snapshot and rejects the request if
the workspace changed or the token expired. Before writing, it creates and
verifies a SQLite backup. The idempotency map is Hub-scoped and uses each
Notion page ID to update the same GemLife record on a repeat run.

`NotionImportReferences` is available through the reviewed live-migration flow
as `notion-import-references`. Apply it with the live database migration
preview/execute routes before importing. File copying requires
`ASSET_DIRECTORY`; files hosted by Notion are copied into GemLife storage and
registered in `FileMetadata`. External attachments and unsupported mappings
are reported. Markdown block children are traversed recursively, and supported
relations, select options, and rollups are installed as table properties where
their targets can be resolved.

The commit response lists created or updated rows, skips, failures, unmapped
properties, and the verified backup name and size. This is a one-way import;
the backup is the recovery point. Do not submit the commit request against
personal data until the owner has reviewed the actual preview and approved its
target mapping.
