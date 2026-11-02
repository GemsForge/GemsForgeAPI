# Table View metadata

The finalized Table View architecture is documented in
[`Table-View-Metadata-Architecture.md`](Table-View-Metadata-Architecture.md).

This page remains the concise entry point for the metadata feature. The
essential invariant is **One Table -> Multiple Views -> One Source of Truth**:
views store presentation and query metadata for an existing logical table;
they never copy, mutate, or delete that table's canonical records.

`TableViews` stores `ViewID`, `HubID`, `TableName`, `Name`, `ViewType`,
`IsDefault`, `SortOrder`, `ConfigurationVersion`, optional `WorkspaceState`,
`CreatedAt`, and `UpdatedAt`.
`ViewType` is one of `Table`, `List`, `Gallery`, or `Grid`.

`ViewColumnConfigurations` stores presentation metadata per View and Column:
visibility, sibling order, and an optional pixel width. `(ViewID, ColumnName)`
is unique. `ColumnName` is a logical reference validated against the live
SQLite schema; it is not a physical foreign key.

`ViewQueryConfigurations` stores a server-validated query tree. Nodes are
`Group`, `Condition`, `Sort`, or `RecordGroup`. Filter Groups use `AND` or
`OR`; Sort nodes use `Ascending` or `Descending`. Query values have explicit
`ValueType` metadata and canonical encodings, so a number, Boolean, date, and
null are never ambiguous display strings.

The migration order is:

```text
TableViews
├── ViewColumnConfigurations
└── ViewQueryConfigurations
```

`WorkspaceState` stores the active record and collection navigation state for a
view. The dedicated `PUT /table-views/:tableName/:viewType/workspace-state`
route updates this field without replacing saved columns or query settings.
The dedicated `PUT /table-views/:tableName/:viewType/columns` route updates
visible columns and order without replacing saved queries or workspace state.

Per-record visual presentation is stored separately in `RecordPresentations`,
keyed by `(HubID, TableName, RecordID)`. `GET /record-presentations/:tableName`
loads a Hub's saved covers, `PUT /record-presentations/:tableName/:recordID`
creates or replaces one JSON presentation, and `DELETE` clears it. A `PUT`
requires a supported cover `source`; send `DELETE` to remove the cover rather
than sending an empty presentation object. Cover images
use the existing file upload and content routes; the saved cover retains its
`FileMetadataID`, while the Console fetches image bytes through authenticated
API transport. Uploaded cover metadata must belong to the authenticated Hub and
the same table/record owner. The Console caches view and presentation state with
TanStack Query; covers are not stored in browser local storage.

The owning Hub cascades to its Table Views, and a View cascades to both child
configuration tables. A partial unique index permits at most one default View
for each `(HubID, TableName)` while allowing any number of non-default Views.

## Query tree grammar

Each View has one non-empty filter root. A Group may contain Conditions or
Groups from the same View, in `SortOrder`; a Condition and a Sort/RecordGroup
node cannot have children. Sort and record grouping are separate nodes rather
than Boolean filter expressions. Parent IDs are checked for same-View
ownership, missing parents, self-reference, and indirect cycles before query
translation.

Comparison operators are a closed server vocabulary. `IsNull` and `IsNotNull`
take no operand, ordinary comparisons take one, `Between` takes two, and `In`
takes one or more. The API validates operator compatibility with the live
SQLite column type and never executes arbitrary client SQL.

## Schema drift policy

`TableName` and `ColumnName` are exact logical identifiers. When a Table or
Column is removed or renamed, the saved metadata is preserved and reported as
stale/unavailable with an error naming the View and missing identifier. The API
does not guess a similar name, silently reinterpret the reference, or mutate
personal records. An intentional rename requires an explicit, reviewed schema
migration that updates the metadata and is covered by the normal backup,
confirmation, verification, and audit workflow.

Representative value encodings are:

```text
MonthlyAmount > 20       ValueType=Decimal, Value="20"
IsActive = true           ValueType=Boolean, Value="true"
DueDate < 2026-11-01     ValueType=Date, Value="2026-11-01"
Category IS NULL          ValueType=Null, Value=NULL
```

The migration files support isolated development/FIT databases only. They are
not registered as automatic startup migrations for the personal database.
