# View Query Execution

The Schema Builder Console can execute a validated table query in SQLite with
`POST /schema-builder/tables/:tableName/query`. The endpoint requires an
authenticated Hub and only exposes tables eligible for the shared schema-page
workflow. Saved views are addressed with `viewID`; ad-hoc requests provide
`nodes`. These fields are mutually exclusive.

```json
{
  "nodes": [
    { "id": "root", "parentQueryID": null, "nodeType": "Group", "columnName": null,
      "comparisonOperator": null, "valueType": null, "value": null,
      "booleanOperator": "AND", "direction": null, "sortOrder": 0 }
  ],
  "search": "travel",
  "limit": 50,
  "offset": 0
}
```

The response includes `records` (each with a string-valued `row` and optional
`groupKey`), `total`, `limit`, and `offset`. The default limit is 50; limits
must be 1–200. Offsets must be non-negative. The count and page run in one read
transaction.

Filter groups support AND/OR and may be empty, in which case they match all
rows. The validated query tree allows at most four group levels and 50
conditions. Supported predicates include typed comparisons, escaped
Contains/StartsWith/EndsWith, inclusive Between, In with at most 100 values,
text IsNull semantics that include empty strings, and whole-option MultiSelect
matching. Unsupported Relation/Lookup references and invalid schema references
return 422. Search and filter values are bound parameters; identifiers are
accepted only after exact live-schema validation.

Every query is Hub scoped and excludes rows present in `TrashEntries`. Sort
columns are evaluated in persisted SortOrder with nulls last, followed by the
primary key as a stable tie-breaker. A RecordGroup node adds the leading group
sort and populates `groupKey` in the response.

For larger custom tables, index `HubID` first. Add a composite index beginning
with `HubID` and followed by frequently filtered columns, or by the common sort
columns and primary key. Search uses escaped substring `LIKE` predicates and
does not gain the same benefit from an ordinary B-tree index. Choose indexes
from observed query patterns; the server does not create them automatically.

The Console retains its existing client-side query path if the server query
request fails. Server query support is enabled only for eligible schema-page
tables; dedicated collections continue using their existing behavior.
