# GemsForge Component API Conventions

This document defines how React components expose structure and behavior in the Gem Life console.

The standard is based on React's [Thinking in React](https://react.dev/learn/thinking-in-react) and [Rules of React](https://react.dev/reference/rules), adapted to the GemsForge design system and application architecture.

## Core principle

Feature code provides values and user intent. Components provide structure, styling, accessibility, and repeated behavior.

Prefer:

```tsx
<GemEmptyState icon="✦" title="No education records" description="The Education table did not return any records." />
```

over rebuilding the same empty-state markup in every feature.

## Component layers

### Design-system primitives

These components own reusable visual and semantic building blocks:

- `GemButton`
- `GemField`
- `GemCard`
- `GemStatusPill`
- `GemLoadingState`
- `GemEmptyState`
- `GemSectionHeader`

### Shared application components

These components compose primitives into recurring application patterns:

- `GemPageHeader`
- `GemRecordList`
- `GemRecordCard`
- `GemDetailPanel`
- `GemFieldGroup`
- `GemErrorState`
- `GemAttachmentSection`

### Feature components

These components own domain-specific behavior and data coordination:

- `EducationView`
- `EmploymentView`
- `TransactionsView`
- `SchemaBuilderView`
- `AttachmentControl`

Feature components should compose shared components rather than rebuild their markup and styling.

## API design rules

### Props describe meaning

Props should describe what a component represents, not how it is implemented.

Prefer:

```tsx
<GemButton tone="primary">Save changes</GemButton>
```

over exposing implementation-specific class names or layout values.

Use semantic names such as:

- `tone`
- `status`
- `selected`
- `busy`
- `open`
- `onSelect`
- `onSubmit`
- `onRetry`

### Props are typed and constrained

Use interfaces for reusable component props and union types for finite variants:

```tsx
interface GemStatusPillProps {
  tone: "success" | "warning" | "danger" | "default";
  children: ReactNode;
}
```

Avoid `any`, arbitrary configuration objects, and unconstrained string variants when the valid values are known.

### Components own repeated semantics

A shared component should own the complete pattern it represents, including:

- Markup structure
- Layout
- Styling
- Accessibility semantics
- Visual states
- Responsive behavior

Consumers should provide values and intent rather than reconstructing the pattern.

### Styling remains intentional

Consumers may provide styling overrides only when the component explicitly supports them. Do not require feature views to know internal class names or layout mechanics.

Use existing Gem Life design tokens before introducing new visual constants. Add a new prop or variant when a recurring semantic distinction exists; do not add props for one-off visual exceptions.

## Feature-view responsibilities

Feature views may:

- Read query results
- Select records
- Pass values into shared components
- Handle feature-specific events
- Coordinate feature-specific hooks
- Choose which component to render

Feature views should not:

- Rebuild shared loading, empty, or error layouts
- Duplicate common field structures
- Duplicate accessibility behavior
- Own generic visual styling
- Mix unrelated workflows into one component

## When to extract a component

Extract a component when:

- The same markup appears more than once.
- The same visual pattern appears in multiple features.
- The same accessibility behavior is repeated.
- Dense markup obscures the feature's intent.
- A typed API makes usage clearer.
- The pattern has an established design-system role.

Do not create a component merely to rename a single `div` or hide markup without adding structure, semantics, behavior, or meaningful reuse.

## State and data ownership

- Server data belongs in TanStack Query.
- Temporary input belongs in component state.
- Related workflows belong in custom hooks.
- Multi-step transitions belong in `useReducer`.
- Derived values should be calculated rather than stored as duplicate state.
- Effects should synchronize with external systems; they should not replace ordinary calculations or event handlers.

See React's [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure), [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components), and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

## Review checklist

Before accepting a component implementation, ask:

- Does the component have one understandable responsibility?
- Does its API expose semantic, typed props?
- Does it own the structure and accessibility of the pattern it represents?
- Is repeated markup represented by a shared component?
- Are loading, empty, error, and success states consistent?
- Is state located at the correct owner?
- Does the consumer provide values and intent instead of implementation details?
- Does the abstraction solve a recurring problem?
- Does the implementation use existing Gem Life tokens and primitives?

## Relationship to the coding policy

This document is the implementation-focused companion to `React-TypeScript-Coding-Policy.md`. The coding policy defines the broader engineering standard; this document defines how that standard applies to component APIs and UI structure.
