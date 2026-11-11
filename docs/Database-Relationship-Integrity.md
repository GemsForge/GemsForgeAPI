# Database relationship integrity

## Rule for new work

Persisted relationships between record tables must be enforced by database
constraints wherever the database supports them. Do not make the API the only
thing preventing orphaned references or mismatched parent/child IDs.

- Add a foreign key for each persisted reference and choose its delete/update
  behavior deliberately.
- Use a composite foreign key when validity depends on a pair of values, such as
  a transaction's category and subcategory belonging together.
- Add the required primary/unique key on the referenced columns, plus indexes
  and uniqueness constraints needed by the relationship.
- Keep server validation as a second layer: check Hub ownership, authorization,
  business rules, and return useful errors before database constraints reject
  invalid writes.
- Keep isolated test/development schema definitions aligned with the verified
  live schema. A test that only exercises server validation does not prove the
  database constraint exists.

## Exceptions

Some references are logical metadata rather than record-to-record columns. For
example, Table Kit view columns and relation definitions store table and column
names so they can describe existing, changing schemas. Those names cannot be
ordinary foreign keys. The server must resolve and validate them against the
live schema and Hub. Document each such exception and do not treat metadata
validation as a substitute for a physical foreign key on the underlying record
column.

For legacy tables where a physical constraint cannot yet be added, document
the reason, keep server validation, and record the migration needed to remove
the exception. Do not silently make new relationships follow that legacy
pattern.

## Migration and verification

Before adding a relationship, inspect the actual schema and existing data.
Define the constraint in the migration or table-creation contract, validate
existing references before applying it, and use the repository's reviewed
backup/preview/approval workflow for live schema changes. Verify the resulting
foreign keys and run SQLite `foreign_key_check` against isolated databases and
each approved environment. Never run a documentation or code change as an
implicit database migration.

See [`Database-Relationship-Inventory.md`](Database-Relationship-Inventory.md)
for the current DEV schema snapshot and known fixture differences.
