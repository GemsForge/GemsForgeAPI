# @gemsforge/ui

Private source package for reusable GemsForge React components and design
values. The Console consumes it through the npm workspace dependency; imports
should use the package root:

```tsx
import { GemButton, GemPageTitle, gemColors } from "@gemsforge/ui";
```

## Ownership boundary

The package owns presentation components, accessibility semantics, Tamagui
configuration, and neutral field presentation types. Console features own API
calls, query hooks, record models, workspace behavior, and domain adapters.
Retired table/list/card renderers remain in the Console because they depend on
its pagination and presentation code.

React, React DOM, Tamagui, `@tamagui/config`, and Day.js are peer dependencies so
the app and package use one runtime copy. The source package is private and is
not currently built or published independently.

## Styling and future consumers

The Console imports `src/styles.css` once. Shared components currently use some
selectors from that compatibility stylesheet, so another app cannot consume
this package independently yet. Before adding a second consumer, move the
required component selectors into package-owned CSS, define its import contract,
and add a distributable build with declaration files. SwiftUI consumers should
use generated design values rather than the React components.
