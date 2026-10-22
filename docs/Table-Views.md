# Table View metadata

The finalized Table View architecture is documented in
[`Table-View-Metadata-Architecture.md`](Table-View-Metadata-Architecture.md).

This page remains the concise entry point for the metadata feature. The
essential invariant is **One Table -> Multiple Views -> One Source of Truth**:
views store presentation and query metadata for an existing logical table;
they never copy, mutate, or delete that table's canonical records.

For the complete five-contract model, three-table persistence design,
Hub-scoped deletion boundary, layer responsibilities, nested Boolean query
grammar, physical constraints, and migration decisions, use the canonical
architecture document above.
