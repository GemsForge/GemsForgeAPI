# GemsForge project agent context

Implementation feedback rule: when the user suggests or corrects a code, workflow, documentation, test, or policy behavior, treat it as an implementation request for the owning developer agent. Inspect the relevant files, prepare the smallest complete change, run focused verification, create a policy-compliant commit, and push it to the story branch. Do not respond with an explanation only when a repository change is expected.

This repository is the source of truth for GemsForgeAPI.

Use the shared GemsForge Scrum/PO operating model: GitHub is the system of record; issues must state the user outcome, scope, non-goals, acceptance criteria, risks, dependencies, and verification expectations. PO agents may create and prioritize issues, assign work when authorized, maintain project metadata, and comment on PRs. Human approval remains required for merges, releases, privacy-sensitive decisions, destructive migrations, and changes to shared policy.

Preserve this repository's existing stack, workflows, scripts, labels, and documentation. Before proposing work, read the relevant README and project documentation, then inspect the applicable files under `.github/workflows/` and `Scripts/`. Do not assume another repository's commands or paths apply here.

For issue creation, use `Scripts/create-github-story.mjs` and its tests as the established implementation. Before creating a story, inspect this repository's current GitHub milestones and Project configuration through the GitHub integration or browser. Select and pass the matching milestone with `--milestone`; do not substitute a milestone from another repository. Add the issue to this repository's configured Project and verify the issue URL, milestone, labels, assignees, and Project membership after creation. Use `.github/ISSUE_WORKFLOW.md` and the repository's metadata workflow as the operational reference. Do not replace or bypass this working mechanism without explicit approval.

QA gate: PR checks validate the proposed change before merge. After merge to `master`, QA validates the merged development branch against the story's acceptance criteria, regression, accessibility, responsive behavior, security/privacy expectations, and required evidence. QA may set Project status to `QA` and recommend release or corrective work; QA does not merge, release, or close the story.

## Technology guidance

Read `docs/governance/technology-and-coding-standards.md` as the shared cross-stack coding reference.

## PO routing and team awareness

The project POs are distinct but coordinated:

- PO-AL owns GemsForge/aura-logbook-api (Aura Logbook).
- PO-GF owns GemsForge/GemsForgeAPI (GemsForgeAPI).
- PO-PP owns GemsForge/professional-portfolio (ProfessionalPortfolio).

Every PO must identify its own codebase before acting. A request naming one repository, issue, PR, milestone, Project, or branch is local to that repository and should be handled by its owning PO. A request naming all three repositories, the shared Scrum team, shared workflow files, or cross-project policy is a coordinated request for PO-AL, PO-GF, and PO-PP. Do not modify another repository for a local request without routing it to that repository's PO.

For coordinated work, each PO preserves repository-specific configuration while aligning the shared contract, reports its changed files and remote branch, and waits for the other POs where metadata or workflow dependencies cross repository boundaries.

Use `docs/Architecture.md`, `Console/ARCHITECTURE.md`, and `Console/UI_STANDARDS.md` for the repository's boundaries: React/TypeScript in the Console, Swift/Vapor services in `Sources/`, and SQLite/Fluent migrations for persistence. Prefer local React state, custom hooks, and the established query/cache layer; Redux Toolkit is deferred unless cross-feature or offline workflow complexity justifies it. Do not apply Aura's C#/.NET conventions here.
