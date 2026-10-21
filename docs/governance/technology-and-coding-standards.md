# GemsForge coding standards and technology boundaries

This shared reference consolidates architecture, UI standards, component APIs,
accessibility, responsive behavior, database practice, workflow policy, and
Definition-of-Done guidance. Repository-local paths and stack rules remain
authoritative.

## 1. Boundary-first development

| Concern | React/TypeScript | SwiftUI/Swift/Vapor | C#/.NET/SQL |
| --- | --- | --- | --- |
| Screens/routes | pages, routes, app | SwiftUI views/navigation | controllers/endpoints |
| Reusable UI | components/ui, components | views/modifiers | client component layer |
| Temporary state | hooks, local state, reducers | observable models | client state |
| Server state | API layer, RTK Query where adopted | API client/repositories | services/API clients |
| Business rules | domain/application modules | services | application services |
| Persistence | lib/data | repositories/models | repositories, Dapper/EF |
| Schema | migration tooling | ordered migrations | ordered SQL migrations |

Read the local README and architecture guide before changing code. Preserve
established names, dependency injection, error models, routes, query/cache layers,
generated-file workflows, and public contracts. Do not move logic across layers
just to simplify a local edit.

## 2. React, Redux, and component APIs

Route-level pages own composition and metadata. Feature screens own feature flows.
Shared UI components own reusable semantic markup, visual states, and accessibility.
Hooks own reusable browser interactions and related state transitions. API/data
modules own transport, parsing, query keys, caching, invalidation, and mutations.

Use existing primitives and design tokens before adding components. Public component
props describe intent, variants, labels, and handlers—not CSS mechanics. Components
must make loading, empty, error, retry, disabled, and success states explicit.

Keep derived values derived. Keep temporary form values, selection, dialogs, filters,
and view-only state near the feature. Use reducers for related workflow transitions,
revisions, approvals, and operation locks. Effects synchronize external systems; they
are not ordinary render calculations.

Server results are the source of truth for server records. Detail query keys include
record IDs. Mutations update or invalidate affected detail/list caches and are not
automatically retried unless explicitly safe. When Redux Toolkit is established,
use slices for client state and RTK Query for server state; do not add a second
state library or duplicate a server cache.

Centralize HTTP transport and preserve status in API errors. Propagate cancellation.
Components must not construct raw request URLs or duplicate response parsing. Never
put credentials or personal query data in browser storage. Revoke object URLs on
preview change/unmount.

## 3. UI quality

Every user-facing change reviews semantic headings, landmarks, labels, descriptions,
error associations, keyboard navigation, visible focus, tab order, screen-reader
updates, contrast, non-color status, touch targets, reduced motion, and compact,
tablet, and desktop layouts. Preserve empty, loading, retry, and not-found states.
Use established palette, typography, spacing, radii, and responsive tokens rather
than one-off visual constants.

## 4. SwiftUI and Swift/Vapor

SwiftUI owns lifecycle, native navigation, permissions, file selection, sharing, and
platform services. React owns web routes, forms, tables, responsive layouts, and API
presentation when both exist. Cross-boundary communication uses one explicit typed
bridge with stable identifiers; never expose arbitrary paths or native objects.

Keep SwiftUI views declarative and native capabilities behind focused services.
In Vapor, keep routes/controllers thin: decode, authorize, call a service, and map
the response. Business rules belong in services; persistence belongs in repositories
and models; request/response contracts use explicit types. Preserve cancellation,
authorization, structured errors, privacy, and migration boundaries.

## 5. C#/.NET and SQL

Controllers/endpoints handle transport, authorization, binding, status, and contract
mapping. Application services own business rules, orchestration, and transaction
decisions. Repositories own queries and mapping. Keep DTOs/contracts separate from
persistence models where the repository defines that boundary. Preserve dependency
injection, validation, structured logging, and exception handling.

SQL belongs in the documented migration/query boundary. Inspect current schema and
migration history first. Migrations are ordered, reviewable, environment-aware, and
safe to apply. Preserve foreign keys, indexes, constraints, transactions, seed
boundaries, and local/staging/production separation. Use prescribed generators;
never hand-edit generated schema output. Destructive data changes require approval
and a recovery plan. Keep secrets and personal data out of source and logs.

## 6. Testing and delivery

Run the narrowest relevant checks first, then required checks: React lint/tests/
startup/build/accessibility; Aura `dotnet test`, UI checks, build, and DEV/FIT smoke;
Swift/Vapor package, API, migration, and bridge tests; .NET contract and migration
tests; database migration and environment reviews. Also verify commit policy, branch
policy, labels, issue linkage, metadata sync, PR checks, and delivery evidence.

If a check cannot run, record the exact command and blocker. Do not claim full
verification from partial evidence.

Stories state outcome, scope, non-goals, acceptance criteria, risks, dependencies,
and verification. Use the repository's own milestone, labels, assignees, and
Project. Developers make focused changes, commit, push to the issue branch, verify
the remote head and PR state, and rebase onto the PR target before final handoff
when required. QA validates merged development code against acceptance criteria,
regression, accessibility, responsive behavior, security/privacy, and evidence.
QA may set QA status and recommend corrective work; QA does not merge, release, or
close stories.
