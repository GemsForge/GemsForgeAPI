# Table Kit

The Table Kit is a reusable React/TypeScript compound component boundary. It
owns typed composition and scoped integration state without importing routes,
API clients, Tamagui, or GemsForge domain models. It does not own record
rendering, query execution, persistence, or pagination controls; later stories
compose those behaviors through these slots.

```tsx
<Table.Root rows={rows} columns={columns} rowKey={(row) => row.id}>
  <Table.Header />
  <Table.Views />
  <Table.Toolbar />
  <Table.Content />
  <Table.Pagination />
</Table.Root>
```

`viewId`/`onViewChange` and `pagination`/`onPaginationChange` form controlled
boundaries. `defaultViewId` and `defaultPagination` provide uncontrolled
integration. External querying, persistence, rendering, styling, and
design-system adapters remain the responsibility of the consuming UI layer.

## Source API

`types.ts` contains the domain-neutral contracts. `context.tsx` exposes the
scoped `useTableContext` hook. `Table.tsx` provides the compound composition
slots. `query.ts` contains normalized query state, client-side derivation, and
the optional server adapter contract.

The intended integration shape is:

```tsx
const query = useTableQueryState({ viewId: activeViewId });
const result = deriveClientQuery(query.state, {
  rows,
  searchText: (row) => row.name,
});

return (
  <Table.Root rows={result.rows} columns={columns} rowKey={(row) => row.id}>
    <Table.Header />
    <Table.Views />
    <Table.Toolbar />
    <Table.Content />
    <Table.Pagination />
  </Table.Root>
);
```

The toolkit does not import feature routes, API clients, persistence models, or
the legacy table components. `RecordTable` uses AG Grid Community behind a
small renderer adapter; AG Grid types and configuration do not cross the
domain-neutral Table Kit contracts. `RecordList` and `RecordGallery` remain
Tamagui-based renderers. Enterprise-only AG Grid modules are intentionally out
of scope for this toolkit.

AG Grid initializes its row and column model after mount, so renderer tests
provide deterministic jsdom layout metrics and await the accessible grid
content. This keeps the contract tests focused on Table Kit behavior while the
production build verifies the real AG Grid integration.

The query contract in `query.ts` provides normalized state, deterministic
client-side derivation, and the adapter shape for server-side results. It does
not own a transport, cache, or feature-specific filter vocabulary.

## Shared selection

`Table.Root` owns one scoped selection context for its child components. Add
`<Table.Selection />` inside the root to provide the accessible current-page
Select All control, an explicit all-matching action when the adapter supplies
IDs beyond the current page, selected-count feedback, and clear selection.

```tsx
<Table.Root
  rows={pageRows}
  columns={columns}
  rowKey={(row) => row.id}
  selection={{
    matchingIds: queryResult.matchingIds,
    isSelectable: (row) => !row.archived,
    isSelectableId: (id) => !queryResult.nonSelectableIds.has(id),
    onSelectionChange: setSelectedIds,
  }}
>
  <Table.Selection />
  <Table.Content />
</Table.Root>
```

`matchingIds` represents the complete effective filtered/sorted result set and
must already represent the effective result set. Use `isSelectable` for loaded
rows and `isSelectableId` when the adapter also needs to exclude disabled
off-page IDs. The selection state is local to each root, preserves IDs across
pagination and view changes, and never persists or mutates records by itself.

## Record contracts

`recordContracts.ts` defines the domain-neutral boundary used by future record
renderers. A feature adapter normalizes each record through `toTableRecord`,
which supplies a stable string ID, optional title, subtitle, image, and status
metadata. It separately supplies one collection-level property schema through
`getPropertyDefinitions`; each definition resolves its value for a record while
keeping semantic kind, visibility, ordering, primary-property, sorting, and
filtering hints stable across every row. Property values keep both a display
payload and optional raw value so a view can render the same record without
reimplementing domain mapping.

Selection and expansion are controlled integration contracts: the Table Kit
renderer receives the current state and reports changes through callbacks. The
contracts intentionally do not store selection, expansion, query, or server
state. A feature may provide uncontrolled defaults in its own adapter, while a
persisted or collaborative consumer remains the owner of controlled state.

```tsx
const adapter: RecordAdapter<Service> = {
  toTableRecord: (service) => ({
    id: String(service.id),
    source: service,
    title: service.name,
  }),
  getPropertyDefinitions: () => [
    { id: "name", label: "Name", primary: true, getValue: (service) => ({ display: service.name }) },
  ],
};
```

Use `orderRecordProperties` before rendering and
`getPrimaryRecordProperty` when a view needs one canonical title/property.
Adapters remain responsible for domain-specific formatting and validation.
