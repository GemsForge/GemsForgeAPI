# Table View metadata

Table Views are Hub-scoped metadata records that describe how an existing
logical SQLite table is presented. They do not copy or recreate the underlying
Table, and changing a View never changes the records or columns in that Table.

## Physical contract

`TableViews` stores `ViewID`, `HubID`, `TableName`, `Name`, `ViewType`,
`IsDefault`, `SortOrder`, `ConfigurationVersion`, `CreatedAt`, and `UpdatedAt`.
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

The owning Hub cascades to its Table Views, and a View cascades to both child
configuration tables. A partial unique index permits at most one default View
for each `(HubID, TableName)` while allowing any number of non-default Views.

## Metadata deletion policy

Hub deletion is an explicit, authorized metadata operation. It may remove only
the selected Hub's Table Views and those Views' column/query configurations.
View deletion has the narrower boundary of removing only that View's
configurations. Neither operation deletes or rewrites canonical records such as
Services or Transactions, affects another Hub, or runs implicitly during an
ordinary record operation. Foreign-key enforcement and a post-operation
`PRAGMA foreign_key_check` are required verification for this boundary.

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
