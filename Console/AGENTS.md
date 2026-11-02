# Console UI architecture

The table workspace is schema-driven. New table views should use the shared workspace shell rather than creating a feature-specific page component.

- The left pane renders available tables and views from table configuration.
- The central collection renders records generically from the table schema and data.
- The record inspector renders properties from semantic field definitions.
- Property types select shared controls such as text, number, date, select/status, checkbox, and media primitives.
- Table-specific code should provide schema metadata, record mapping, query/cache wiring, and mutation contracts—not duplicate the left pane, central table, or inspector layout.
- A bespoke view is an explicit exception for behavior the shared workspace cannot express; document that exception before adding it.

Prefer extending `src/features/workspace/WireframeCollectionView.tsx`, the table-kit contracts, and shared Tamagui primitives before creating a new `*WireframeView.tsx`.
