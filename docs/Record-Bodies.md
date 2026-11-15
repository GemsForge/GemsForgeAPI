# Record page bodies

`RecordBodies` stores optional Markdown content alongside, rather than inside,
the canonical record. Each row is scoped by `(HubID, TableName, RecordID)` and
has an integer revision. Empty bodies read as revision `0`; a successful save
increments the revision. The table name and record ID are logical references,
so these rows do not impose a foreign key on user tables.

## API

- `GET /record-bodies/:tableName/:recordID` returns `{recordID, markdown,
  revision, updatedAt}`. A record with no saved body returns an empty Markdown
  string and revision `0`.
- `PUT /record-bodies/:tableName/:recordID` accepts `{markdown,
  baseRevision}`. Markdown is limited to 1 MB of UTF-8 and line endings are
  normalized to LF. A stale `baseRevision` returns `409` with the current body
  so the client can resolve the conflict.
- `GET /record-bodies/:tableName` returns Hub-scoped, plain-text excerpts of at
  most 200 characters for records with bodies.

All routes validate that the referenced record exists in the authenticated
Hub. Saves are conditional on the revision read inside their transaction.

## Supported Markdown

The editor supports CommonMark blocks and inline text plus GitHub Flavored
Markdown tables, strikethrough, task lists, and autolinks. HTML embedded in
Markdown is omitted. Links and images may use `http`, `https`, or `mailto`;
uploaded images use only the app's `/file-metadata/:id/content` route.
JavaScript, data, and other URL schemes are removed at render time. No raw HTML
plugin is enabled.

The Console autosaves after 800 ms of inactivity and when the editor loses
focus. A revision conflict displays the remote body and offers **Use saved**
or **Keep mine**. Pasted images upload through the file service and are
inserted as Markdown references. File metadata referenced by a saved image
cannot be deleted until the body reference is removed.

Trash snapshots include body Markdown and revision. Restore reinstates that
content and advances the revision; permanent deletion removes the body in the
same transaction. Table-sidecar cleanup is exposed by
`RecordSidecarCleanupService.deleteTableSidecars(tableName:hubID:on:)` for a
reviewed table-drop workflow. It removes only the selected Hub/table's record
bodies, presentations, and (when present) column definitions. No current route
calls this service.

These migrations are additive and intended for isolated development/FIT
databases. They are not an automatic migration path for personal databases.

## Verification

The API route, migration, trash, attachment-reference, and sidecar-cleanup
tests live in `Tests/GemsForgeAPITests`. Console rendering, URL filtering,
autosave, and conflict resolution are covered by
`Console/src/features/workspace/WireframeRecordBody.test.tsx`.
