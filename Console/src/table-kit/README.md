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

The query contract in `query.ts` provides normalized state, deterministic
client-side derivation, and the adapter shape for server-side results. It does
not own a transport, cache, or feature-specific filter vocabulary.
