# React and Redux Best Practices

This guide records the agreed approach for building React features in GemsForgeAPI.
The goal is predictable, modular code with clear ownership of state and behavior.

## Default architecture

Use the simplest state owner that satisfies the feature:

| Concern | Preferred owner |
| --- | --- |
| Temporary input, dialog, selection, filter, or view state | Component or feature-local state |
| Related transitions with explicit rules | A local reducer or custom hook |
| Reusable browser interaction | Custom hook |
| Server records, loading, errors, caching, and invalidation | Existing query/cache layer |
| Cross-feature client state or offline workflows | Redux Toolkit, when justified |
| Reusable markup and accessibility behavior | Tamagui-based shared component |

Start local. Promote state only when there is a demonstrated ownership problem.
Do not introduce Redux merely because a component has several state values.

## When Redux Toolkit is appropriate

Use Redux Toolkit when state is:

- consumed by multiple unrelated features;
- long-lived across route changes or workflows;
- coordinated across several asynchronous transitions;
- required for undo/redo, approvals, operation locks, or offline behavior; or
- difficult to reason about because multiple owners are synchronizing it.

Use slices for client-owned state. Use RTK Query for server state when Redux
Toolkit is already established for that feature. Do not create a second server
cache or copy query results into a slice without a clear synchronization contract.

## When Redux is not appropriate

Keep state local for:

- an open/closed dialog;
- a selected card or temporary multi-selection;
- gallery card size, media-fit preference, or drag-to-reposition mode;
- form drafts and validation state;
- a search field, sort control, or pagination cursor used by one feature; or
- values that can be derived from props, query results, or route parameters.

Prefer derived values over duplicated state. If a value can be calculated from
the current records and selected IDs, calculate it rather than storing another
source of truth.

## Component boundaries

Route-level pages compose the screen and provide metadata. Feature components own
domain workflows. Shared UI components own semantic markup, visual states,
accessibility, and reusable interaction contracts. Table Kit components remain
domain-neutral and receive prepared records plus typed intent.

Keep data preparation separate from rendering:

1. Feature adapters retain API and domain knowledge.
2. Shared query logic prepares filtering, sorting, pagination, and selection.
3. List, gallery, and table render the same prepared result.
4. Details and edit forms own record-level workflows.

Do not move domain fetching into generic UI components. Do not make shared
components reconstruct feature-specific data or duplicate query-cache behavior.

## Tamagui and styling

Use Tamagui primitives and the project’s typed wrappers for layout, controls,
labels, text, headings, switches, buttons, and accessibility semantics. Prefer
component props, variants, and design tokens over hand-written CSS behavior.

CSS or Tailwind may provide layout utilities where the project already uses them,
but behavior belongs in React state and component handlers. Avoid CSS that silently
changes interaction state, selection semantics, or media behavior.

Public component props should describe intent—such as `fillMedia`, `size`,
`disabled`, or `onChange`—rather than exposing implementation-specific CSS knobs.

## Server state and mutations

Treat server results as the source of truth. Query keys must include record IDs
where detail data is involved. After a mutation, update or invalidate the affected
list and detail caches. Do not automatically retry mutations unless they are
explicitly safe and idempotent.

Centralize transport, preserve API error status, propagate cancellation, and keep
raw request construction out of components. Components should not parse API
responses or duplicate request URLs.

## Testing expectations

Test the ownership boundary, not implementation trivia:

- local state transitions and reducer rules;
- query/cache invalidation after mutations;
- equivalent prepared records across list, gallery, and table views;
- selection and view switching;
- loading, empty, error, retry, and disabled states;
- accessible names, roles, keyboard behavior, and visible focus; and
- responsive behavior at compact, tablet, and desktop widths.

Run focused tests first, then the relevant lint, format, build, accessibility,
and full Console checks. If a check is blocked or fails outside the change,
record the exact command and affected files instead of claiming full verification.

## Decision checklist

Before adding Redux, ask:

1. Who owns this state today?
2. Is it client state or server state?
3. Can a custom hook or local reducer express the transitions clearly?
4. Which independent features need the same state?
5. What persistence, reset, invalidation, or offline guarantees are required?
6. What tests will prove that there is only one source of truth?

If the answers do not demonstrate cross-feature or workflow complexity, keep the
state local and document the hook or reducer boundary instead.
