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
the legacy table components. Later stories may supply those adapters and
renderers without changing the existing table implementation.

The query contract in `query.ts` provides normalized state, deterministic
client-side derivation, and the adapter shape for server-side results. It does
not own a transport, cache, or feature-specific filter vocabulary.

## Record contracts

`recordContracts.ts` defines the domain-neutral boundary used by future record
renderers. A feature adapter supplies a stable string ID, optional title,
subtitle, image, and status metadata, plus property definitions with semantic
kind, visibility, ordering, primary-property, sorting, and filtering hints.
Property values keep both a display payload and optional raw value so a view can
render the same record without reimplementing domain mapping.

Selection and expansion are controlled integration contracts: the Table Kit
renderer receives the current state and reports changes through callbacks. The
contracts intentionally do not store selection, expansion, query, or server
state. A feature may provide uncontrolled defaults in its own adapter, while a
persisted or collaborative consumer remains the owner of controlled state.

```tsx
const adapter: RecordAdapter<Service> = {
  getId: (service) => String(service.id),
  getTitle: (service) => service.name,
  getProperties: (service) => [
    { id: "name", label: "Name", primary: true, getValue: () => ({ display: service.name }) },
  ],
};
```

Use `orderRecordProperties` before rendering and
`getPrimaryRecordProperty` when a view needs one canonical title/property.
Adapters remain responsible for domain-specific formatting and validation.
