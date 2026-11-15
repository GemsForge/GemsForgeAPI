# Multi-select properties

Schema Builder stores Select, MultiSelect, and Status semantics as Hub-scoped
metadata in `TableColumnDefinitions`. The live SQLite column remains the source
of record data and must have TEXT affinity; defining a property never changes
the physical table schema.

## Stored values

Multi-select values use a canonical semicolon-delimited string in the existing
TEXT column. The codec trims whitespace, normalizes Unicode to NFC, removes
empty and duplicate tags, and joins values with `;`. Option names cannot
contain semicolons because semicolons separate tags. API writes accept either
the legacy delimited string or an array of strings. Arrays are preferred for
new clients. Unknown values fail unless the authenticated write explicitly
sets `createMissingOptions: true`; option creation and record writes occur in
the same database transaction.

Changing an option's value requires an explicit `{ from, to }` rename mapping.
The API updates complete tag tokens for records owned by the Hub and reports
how many rows changed. Substrings are never rewritten. Deleting definition
metadata does not delete or rewrite stored values.

## Query behavior

The Console matches a filter against one complete normalized tag. `Home` does
not match `Homework`. Saved query metadata accepts the MultiSelect operators
Equals, NotEquals, Contains, In, IsNull, and IsNotNull, with operands that name
configured options exactly. Other operators and unknown option values fail
validation. Server-side SQL execution is not part of this contract yet; any
future executor must use bound parameters and the same whole-tag semantics.
For SQLite, the token match pattern is
`(';' || "Column" || ';') LIKE '%;' || ? || ';%'`, with the option supplied
as a bound value. Escape LIKE metacharacters (`%`, `_`, and `\\`) in the bound
option so the match remains literal.

## Legacy workspace settings

Earlier Console versions stored primitive types and option arrays inside
Table View workspace JSON. The new API reads and writes durable definitions
separately. Existing workspace JSON is retained for compatibility and is not
silently converted or used to overwrite saved definitions.

An authenticated operator can review a table's legacy metadata with
`GET /table-column-definitions/:tableName/backfill/preview`. The response lists
pending definitions and conflicts. `POST /table-column-definitions/:tableName/backfill/apply`
adds only missing Hub-scoped definitions and can be repeated safely. Existing
definitions are preserved. The backfill reads current Hub-owned text values to
include observed tags, but it does not rewrite record values.
