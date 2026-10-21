# GemsForge technology and coding standards

This document is the shared coding reference for GemsForge repositories. Apply the
technology section that matches the code being changed, while preserving the
repository's local architecture and paths.

## UI: React, Redux, and component APIs

- Keep route-level composition in the application/page layer.
- Put reusable visual and semantic primitives in the component UI layer.
- Put reusable browser interaction and temporary UI state in focused hooks.
- Keep server data, caching, loading, errors, mutations, and invalidation in the API/query layer.
- Use Redux Toolkit and RTK Query when the repository already adopts them, especially for cross-feature state and server data.
- Prefer derived values over duplicated state and reducers for related multi-step transitions.
- Components expose typed props based on user intent, not CSS or implementation mechanics.
- Use semantic HTML, keyboard support, labels, focus behavior, contrast, responsive layouts, and established design tokens.
- Do not construct raw API requests in presentational components.

## SwiftUI and Swift/Vapor

- SwiftUI owns native navigation, lifecycle, permissions, file selection, sharing, and platform capabilities.
- React owns web-side screens when a React client exists; do not duplicate a feature across SwiftUI and React without an explicit boundary.
- Communicate across native/web boundaries through typed messages and stable identifiers.
- In Vapor, keep routing/controllers thin, business rules in services, persistence in repositories/models, and contracts in explicit types.
- Preserve cancellation, error propagation, authorization checks, and privacy boundaries.
- Do not place credentials, personal data, or secrets in client code or logs.

## C#/.NET and data access

- Keep ASP.NET controllers focused on transport and authorization.
- Put business rules in application services and data access in repositories.
- Keep DTOs/API contracts separate from persistence models where the repository establishes that boundary.
- Use existing dependency-injection, validation, logging, and exception-handling conventions.
- SQL belongs in the documented migration/query boundary. Migrations are ordered, repeatable, reviewed, and safe for the target environment.
- Preserve transaction, seeding, foreign-key, and environment-specific database rules.

## Delivery and verification

Before a PR, read the local README, architecture guide, applicable workflow, and tests. Make the smallest complete change, update relevant documentation, and run the narrowest relevant checks plus required repository checks. Review accessibility, responsive behavior, security, privacy, API contracts, migrations, and regression risk when applicable.

After modifying code, create one focused policy-compliant commit and push it to the issue branch. Verify the remote branch head and PR state before reporting completion. QA validates the merged development branch against acceptance criteria; QA does not merge, release, or close the story.
