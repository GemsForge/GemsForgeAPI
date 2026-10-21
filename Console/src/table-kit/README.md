# Table Kit

The Table Kit is a reusable React/TypeScript compound component boundary. It
owns generic table composition and interaction state without importing routes,
API clients, Tamagui, or GemsForge domain models.

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
integration. External querying, persistence, styling, and design-system
adapters remain the responsibility of the consuming UI layer.
