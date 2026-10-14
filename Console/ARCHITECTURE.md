# Gem Life UI Architecture

## Purpose

The Console is the React and TypeScript client for developing and verifying the GemsForgeAPI. Milestone 3 will evolve its reusable UI foundations into the official Gem Life interface without creating a sibling copy of the project.

## Application boundary

### React route ownership

`src/routes/AppRoutes.tsx` declares exact routes rather than copying the current
URL into component state. The shared shell and sidebar remain mounted; only the
active feature requests its records. Home is `/`; `/domains` lists domains and
`/domains/:domainID` loads their pages. `/forgekeeper` shows roots, with children
at `/forgekeeper/:pageID/children`. Life routes are `/education`, `/employment`,
`/addresses`, and `/transactions` (`/expenses` redirects). Reference and developer
routes are `/gemhues`, `/local-databases`, and `/schema-builder`.

Use router links for web navigation. Direct links and history navigation use the
same query keys. Unknown paths/IDs show not-found; pending requests and failures
have loading/retry states. Screen render failures are caught inside the shell.
Native navigation remains a separate bridge concern. Vite serves HTML navigation
requests locally while proxying API fetches on the same paths. Production hosting
must likewise serve index.html for React route requests, not API JSON.

```text
SwiftUI native shell
└── WKWebView
    └── React + TypeScript Gem Life UI
        ├── reusable UI components
        ├── feature screens
        └── API/query layer
```

SwiftUI owns native capabilities: application lifecycle, native navigation, permissions, file selection, sharing, and platform-specific services. React owns Gem Life screens, web-side navigation, responsive layouts, forms, tables, and API presentation.

The two layers communicate through an explicit typed bridge. React must not reach directly into SwiftUI implementation details, and SwiftUI must not duplicate the React feature interface.

## Repository boundary

The implementation remains in the existing `GemsForgeAPI` repository:

```text
Console/
├── src/
│   ├── components/       shared React components
│   ├── features/         feature-specific screens
│   ├── hooks/            reusable state and workflow hooks
│   ├── data/             API client and query hooks
│   ├── routes/           React navigation
│   └── bridge/           SwiftUI/React messages
└── ARCHITECTURE.md
```

The SwiftUI host will be added to the same repository and must not be implemented as a copied sibling project.

## State ownership

### Server data conventions

`src/api.ts` owns HTTP transport. JSON, upload, and binary requests preserve
HTTP status in `APIError`; status 0 means the local API could not be reached.
Cancellation is propagated without replacing it with a connection error.
Never put credentials in this client or persist personal query data to storage.

`src/data` owns list/detail query keys, cancellation signals, loading/error
state, and mutations. Detail keys include the record ID so selecting another
record cannot replace the current selection with a late response. Use
`QueryFeedback` for initial loading and retryable failures. Query results, not
copied component state, are the source of truth for server records.

Successful attachment mutations update detail caches and invalidate their list;
page edits invalidate all page scopes; table creation and CSV imports invalidate
live-schema inspection. Mutations are never automatically retried. Reads are
fresh for 30 seconds and retry once except HTTP 4xx failures. Binary file preview
URLs remain viewer-owned and are revoked on change/unmount.
These patterns follow [TanStack mutation invalidation guidance](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations).

- SwiftUI state: native navigation, permissions, file pickers, lifecycle, and native session concerns.
- React local state: temporary form values, selected records, open dialogs, filters, and view-only state.
- Custom hooks: related state and workflows such as schema building, database creation, and file upload.
- `useReducer`: workflows with multiple related transitions.
- API/query layer: server data, loading, errors, caching, invalidation, and mutations.
- Redux Toolkit: deferred until offline queues or cross-feature workflows demonstrate a need for centralized client state.

## Component rules

The Tamagui source of truth is `src/design-system/tamagui.config.ts`. It defines
the existing Gem Life palette, system-font typography, semantic spacing
(`gemCompact`, `gemControl`, `gemSection`, `gemPage`), and control/card radii.
The dark theme remains the application default; a light theme is available.
Responsive thresholds are compact 640px, tablet 900px, desktop 1200px; the
reduced-motion media key supports user motion preferences. Prefer semantic
tokens in shared primitives instead of adding one-off visual constants.

Feature screens compose shared components rather than rebuilding markup and styling. Shared components should expose behavior and semantic intent through typed props, preserve accessibility, and receive visual styling from the Gem Life design tokens.

The shared component inventory lives in `Console/src/components/ui`:

- `GemButton` — semantic primary and secondary actions.
- `GemField` — labelled text inputs with a stable accessible association.
- `GemCard` — reusable Gem Life surface for grouped content.
- `GemSectionHeader` — consistent page headings with optional trailing status or actions.
- `GemStatusPill` — compact success, warning, danger, and default states.
- `GemEmptyState` and `GemLoadingState` — consistent unavailable and in-flight states.
- `GemDataTable` — captioned, keyboard-friendly tabular records.

Feature-specific controls such as `AttachmentControl` remain outside the shared
primitive folder because they own API behavior. They should compose the shared
primitives as they are expanded.

## Navigation ownership

SwiftUI owns native destinations and deep-link entry points. React owns navigation within the Gem Life web application. Route values and bridge messages should use stable identifiers rather than passing complete database models between layers.

## API boundary

React communicates with Vapor through the typed API client. Components should not construct raw request URLs or duplicate response parsing. Query hooks own server-state behavior; feature components consume typed results and render loading, empty, error, and success states.

## Native bridge boundary

The native host registers one `gemLife` WebKit message handler. React sends a
typed envelope through `Console/src/bridge/index.ts`, and SwiftUI decodes the
same message types in `GemLifeHost/GemLifeBridge.swift`. Messages use stable
identifiers and optional string payloads for navigation, file/image requests,
local-file results, sharing, session events, and native errors. The bridge
does not expose arbitrary filesystem paths or native implementation objects.

## Implementation sequence

1. Define architecture and boundaries.
2. Configure Tamagui tokens and themes.
3. Build reusable components.
4. Extract feature workflows into hooks.
5. Establish React navigation.
6. Add the API/query layer.
7. Add the SwiftUI host and typed bridge.
8. Connect Gem Life feature screens.
9. Add accessibility, responsive behavior, security, packaging, performance, tests, and documentation.
