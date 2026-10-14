# Gem Life UI Architecture

## Purpose

The Console is the React and TypeScript client for developing and verifying the GemsForgeAPI. Milestone 3 will evolve its reusable UI foundations into the official Gem Life interface without creating a sibling copy of the project.

## Application boundary

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

- SwiftUI state: native navigation, permissions, file pickers, lifecycle, and native session concerns.
- React local state: temporary form values, selected records, open dialogs, filters, and view-only state.
- Custom hooks: related state and workflows such as schema building, database creation, and file upload.
- `useReducer`: workflows with multiple related transitions.
- API/query layer: server data, loading, errors, caching, invalidation, and mutations.
- Redux Toolkit: deferred until offline queues or cross-feature workflows demonstrate a need for centralized client state.

## Component rules

Feature screens compose shared components rather than rebuilding markup and styling. Shared components should expose behavior and semantic intent through typed props, preserve accessibility, and receive visual styling from the Gem Life design tokens.

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
