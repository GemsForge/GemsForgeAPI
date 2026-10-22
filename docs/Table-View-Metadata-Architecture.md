# Table View metadata architecture

Status: finalized repository contract for Table View metadata.

This document is the canonical architecture reference for the Table View
metadata introduced by Milestone 5. [`Table-Views.md`](Table-Views.md) remains
the short operational summary and links here. Earlier proposal material was
reconciled into this document; this finalized contract is authoritative.

## Governing principle

**One Table -> Multiple Views -> One Source of Truth.**

A Table View is a saved presentation and query definition for one existing
logical SQLite table. It never copies, recreates, or owns the table's records.
Multiple views may target the same table, but every view reads the same
canonical records and live schema. Changing view metadata changes presentation
or retrieval, never the underlying data model.

## Five logical schema contracts

The logical architecture has five contracts. They describe behavior and
ownership; they are intentionally not five physical tables.

### 1. Hub-scoped view identity and ownership

A view belongs to exactly one Hub and targets exactly one logical table. Its
stable identity, user-facing name, renderer type, default flag, sibling order,
configuration version, and timestamps form the view contract. Supported view
types are `Table`, `List`, `Gallery`, and `Grid`.

All reads, writes, updates, and deletes are constrained to the authenticated
Hub. A view cannot be used to cross Hub boundaries. There may be any number of
views for a `(HubID, TableName)` pair, but at most one may be the default.

### 2. Exact target-table and schema-reference contract

`TableName` and every `ColumnName` are exact logical identifiers resolved
against the live SQLite schema. They are references, not physical foreign
keys, because the canonical tables and columns are managed by the broader
schema lifecycle.

The API must not fuzzy-match, silently rename, or reinterpret a missing table
or column. When schema drift removes or renames a reference, saved metadata is
preserved and reported as stale/unavailable with the affected View and
identifier. An intentional rename requires an explicit reviewed schema
migration, backup, confirmation, verification, and audit trail. Drift handling
never mutates canonical records.

### 3. Per-view column-presentation contract

Column metadata controls only presentation: visibility, deterministic sibling
order, and an optional non-negative pixel width. Hidden columns remain saved so
they can be restored. `(ViewID, ColumnName)` is unique, and a column
configuration cannot affect another view or the target table schema.

### 4. Server-owned nested query-tree contract

Each view has one non-empty Boolean filter root. Filter groups contain only
conditions or nested groups, preserve sibling `SortOrder`, and combine with
`AND` or `OR`. `Sort` and `RecordGroup` nodes are independent result-shaping
metadata; they are not Boolean expressions and cannot have parents.

The validator requires stable unique node IDs, same-view parent ownership,
existing parents, non-negative and unique sibling order, no self-reference or
indirect cycles, legal parent/child kinds, and exactly one filter root. Query
translation receives only this validated tree; clients cannot submit arbitrary
SQL.

### 5. Typed operand and validation contract

Comparison operators are a closed vocabulary: `Equals`, `NotEquals`,
`Contains`, `StartsWith`, `EndsWith`, `GreaterThan`, `GreaterThanOrEqual`,
`LessThan`, `LessThanOrEqual`, `IsNull`, `IsNotNull`, `Between`, and `In`.

`IsNull` and `IsNotNull` take zero operands; ordinary comparisons take one;
`Between` takes exactly two; `In` takes one to one hundred operands. Every
operand declares a `ValueType`: `Text`, `Integer`, `Decimal`, `Boolean`,
`Date`, `DateTime`, or `Null`. Values use canonical encodings (`true`/`false`,
canonical integers and decimals, ISO dates, and the repository's canonical
ISO-8601 DateTime representation). Multi-operand values are stored as a JSON
array of same-typed scalar values; null is a database null, never the text
`"null"`.

Validation checks operator cardinality, value encoding, operand type
compatibility, live-column type compatibility, schema references, and tree
ownership before translation or persistence. Invalid stored enum values cannot
be coerced into a supported DTO value.

## Three normalized persistence tables

The physical schema is deliberately limited to these three metadata tables:

```text
Hub
└── TableViews
    ├── ViewColumnConfigurations
    └── ViewQueryConfigurations
```

### `TableViews`

Stores `ViewID`, `HubID`, `TableName`, `Name`, `ViewType`, `IsDefault`,
`SortOrder`, `ConfigurationVersion`, `CreatedAt`, and `UpdatedAt`.

`HubID` is a foreign key to `Hubs.HubID` with cascade delete. SQLite enforces
the closed view-type vocabulary, non-negative sort order, and positive
configuration version. A partial unique index allows at most one default per
`(HubID, TableName)` while allowing multiple non-default views. The compound
`(HubID, TableName, SortOrder)` index supports deterministic view ordering.

### `ViewColumnConfigurations`

Stores `ViewColumnID`, `ViewID`, `ColumnName`, `IsVisible`, `SortOrder`, and
nullable `Width`. `ViewID` cascades to the owning view. SQLite enforces
non-negative order and width, and a unique constraint enforces one row per
`(ViewID, ColumnName)`. The view/order index supports ordered configuration
loading.

### `ViewQueryConfigurations`

Stores one normalized node per row: `ViewQueryID`, `ViewID`, nullable
`ParentQueryID`, `NodeType`, optional column/operator/value fields,
`BooleanOperator`, `Direction`, and `SortOrder`. Both view ownership and
parent-child deletion cascade from the owning view. SQLite constrains the node,
operator, value-type, Boolean-operator, and direction vocabularies and requires
non-negative order. View/parent/order indexes support tree loading; the Swift
validator enforces the cross-row rules SQLite cannot express.

The migrations are ordered `TableViews` -> `ViewColumnConfigurations` ->
`ViewQueryConfigurations`. They are isolated development/FIT/test database
migrations and are not automatic startup migrations for the personal database.

## Ownership and deletion

Hub-scoped ownership is an authorization boundary, not only a relationship in
the schema. Hub deletion is an explicit authorized metadata operation and may
remove only that Hub's Table Views and their column/query metadata. View
deletion removes only that view's configuration rows. No operation in this
architecture deletes or rewrites `Services`, `Transactions`, or any other
canonical record table; no cascade crosses into another Hub.

`TableViewService` performs default changes transactionally. Creating a
conflicting default is rejected. Promoting a view clears other defaults, and
removing the current default promotes the remaining lowest-sort-order view.
Foreign-key enforcement and post-operation `PRAGMA foreign_key_check` are
required verification for deletion boundaries.

## Responsibility boundaries

| Layer | Responsibility |
| --- | --- |
| Table/View models | Map the three persistence tables and expose stable stored fields. They do not interpret arbitrary SQL. |
| Contract enums and codecs | Define the closed vocabularies, operand cardinality, and canonical typed-value encoding. |
| DTOs | Transport stable IDs, Hub/view ownership, presentation metadata, and typed query semantics. They do not expose persistence-only details or accept SQL. |
| Routes/request validation | Authenticate the Hub, decode transport input, apply request-level validation, and map structured errors and responses. |
| Query validator | Inspect the live schema; validate exact table/column references, node ownership, tree shape, operators, values, and type compatibility before translation. |
| Persistence services | Apply Hub/view ownership, transactions, default uniqueness/promotion, and metadata-only deletion behavior. |
| Migrations | Create the three normalized tables, foreign keys, indexes, checks, and cascade boundaries for isolated databases. |
| Table Kit/clients | Render a domain-neutral view from typed records, properties, query state, selection, and configuration. Feature adapters retain API transport, permissions, formatting, and mutations. |

## Migration and physical-constraint decisions

The metadata tables are normalized to avoid repeating view identity, column
settings, or query nodes inside canonical records. Logical table and column
references remain application-validated rather than physical foreign keys so
schema changes can be preserved and reported instead of silently destroying
metadata. SQLite checks enforce closed scalar vocabularies and simple numeric
invariants; Swift validation enforces live-schema compatibility and recursive
tree invariants that SQLite cannot express portably.

The migration files support isolated development/FIT databases and disposable
test databases. They must not be registered as automatic startup migrations
against the personal `DATABASE_PATH`. A live schema change or intentional
identifier rename follows the repository's reviewed backup, confirmation,
verification, and audit workflow.

## Related references

- [`Table-Views.md`](Table-Views.md) — concise operational summary.
- [`Architecture.md`](Architecture.md) — repository layer and database flow.
- [`Database-Migrations.md`](Database-Migrations.md) — migration safety and
  ordering.
- [`Milestone-5-Implementation-Ledger.md`](Milestone-5-Implementation-Ledger.md)
  — issue and verification history.
