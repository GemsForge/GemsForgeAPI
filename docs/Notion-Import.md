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

## Import safety and remaining story work

`NotionImportReferences` provides a Hub-scoped unique key for the Notion page
ID, so the importer can update or skip an existing source page instead of
creating duplicates. Its migration is included in the isolated development
profile and must go through the repository's reviewed live-migration and
backup process before any live import.

The authenticated preview is the first server-side increment. The approved
writer, complete block traversal, file copying, relationship linking, and the
owner-reviewed live dry-run/import steps are still required before issue #545
meets its full acceptance criteria. Do not run an import against personal data
until the owner has reviewed the preview and approved the target mapping.
