# GemsForge project agent context

Implementation feedback rule: when the user suggests or corrects a code, workflow, documentation, test, or policy behavior, treat it as an implementation request for the owning developer agent. Inspect the relevant files, prepare the smallest complete change, run focused verification, create a policy-compliant commit, and push it to the story branch. Do not respond with an explanation only when a repository change is expected.

This repository is the source of truth for GemsForgeAPI.

Use the shared GemsForge Scrum/PO operating model: GitHub is the system of record; issues must state the user outcome, scope, non-goals, acceptance criteria, risks, dependencies, and verification expectations. PO agents may create and prioritize issues, assign work when authorized, maintain project metadata, and comment on PRs. Human approval remains required for merges, releases, privacy-sensitive decisions, destructive migrations, and changes to shared policy.

Preserve this repository's existing stack, workflows, scripts, labels, and documentation. Before proposing work, read the relevant README and project documentation, then inspect the applicable files under `.github/workflows/` and `Scripts/`. Do not assume another repository's commands or paths apply here.

Code documentation rule: every code change must include an appropriate
documentation comment for the changed behavior or public contract. Use focused
comments for implementation logic, JSDoc/TSDoc for JavaScript or TypeScript
APIs and reusable components, and XML documentation comments for Swift or
other XML-documentation-supported APIs. Keep comments accurate and explain
intent, invariants, inputs, outputs, or constraints; do not add empty comments
solely to satisfy this rule. Review and update nearby comments when a change
makes them stale.

Automation coordination: the active Scrum Master automation is the shared
coordinator for Aura Logbook, GemsForgeAPI, and Professional Portfolio. It is
attached to the shared SCRUM TEAM project and covers all three repository
working directories. Do not create duplicate per-project automations that
could work the same stories concurrently.

For issue creation, use `Scripts/create-github-story.mjs` and its tests as the established implementation. Before creating a story, inspect this repository's current GitHub milestones and Project configuration through the GitHub integration or browser. Select and pass the matching milestone with `--milestone`; do not substitute a milestone from another repository. Add the issue to this repository's configured Project and verify the issue URL, milestone, labels, assignees, and Project membership after creation. Use `.github/ISSUE_WORKFLOW.md` and the repository's metadata workflow as the operational reference. Do not replace or bypass this working mechanism without explicit approval.

Lifecycle gate: when a PR is created, the linked issue and PR move to `QA` for internal Codex Review. An approved Codex Review moves them to `In review` for the human PR decision. A merged PR moves them to `Merged` and closes the linked story; the resulting closed story becomes `Done`. Required corrections use `Changes requested`; QA does not merge or release.

## Technology guidance

Read `docs/governance/technology-and-coding-standards.md` as the shared cross-stack coding reference.

## Shared agent target contract

All three project teams use the same agent-facing file contract. Target the
repository-local copies of these files when the request is shared policy or
workflow work:

- `AGENTS.md` for routing, handoff, commit/push, rebase, and QA rules.
- `Scripts/create-github-story.mjs` and `Scripts/create-github-story.test.mjs`
  for issue/story creation.
- `Scripts/commit-policy.mjs`, `Scripts/commit-policy.json`, and their tests
  for focused commit subjects.
- `.github/workflows/branch-policy.yml` for branch and base-branch policy.
- `.github/workflows/commit-policy.yml` for commit and PR-title policy.
- `.github/workflows/label-policy.yml` for required labels.
- `.github/workflows/sync-issue-metadata.yml` for issue metadata and Project
  synchronization.
- `.github/workflows/sync-pr-metadata.yml` for PR metadata synchronization.
- `.github/agents/*.agent.md` for the PO, developer, Scrum Master, and QA
  operating instructions.
- `docs/governance/gemsforge-ai-scrum-team.md`,
  `docs/governance/github-actions-standard.md`, and the technology,
  accessibility, definition-of-done, and workflow documents for the shared
  process contract.

Preserve this repository's `Scripts/` casing and repository-specific project,
milestone, label, base-branch, and technology values. A cross-repository
request updates the equivalent file in each repository; a project-local
request updates only this repository.

## PO routing and team awareness

The project POs are distinct but coordinated:

- PO-AL owns GemsForge/aura-logbook-api (Aura Logbook).
- PO-GF owns GemsForge/GemsForgeAPI (GemsForgeAPI).
- PO-PP owns GemsForge/professional-portfolio (ProfessionalPortfolio).

Every PO must identify its own codebase before acting. A request naming one repository, issue, PR, milestone, Project, or branch is local to that repository and should be handled by its owning PO. A request naming all three repositories, the shared Scrum team, shared workflow files, or cross-project policy is a coordinated request for PO-AL, PO-GF, and PO-PP. Do not modify another repository for a local request without routing it to that repository's PO.

For coordinated work, each PO preserves repository-specific configuration while aligning the shared contract, reports its changed files and remote branch, and waits for the other POs where metadata or workflow dependencies cross repository boundaries.

Use `docs/Architecture.md`, `Console/ARCHITECTURE.md`, and `Console/UI_STANDARDS.md` for the repository's boundaries: React/TypeScript in the Console, Swift/Vapor services in `Sources/`, and SQLite/Fluent migrations for persistence. Prefer local React state, custom hooks, and the established query/cache layer; Redux Toolkit is deferred unless cross-feature or offline workflow complexity justifies it. Do not apply Aura's C#/.NET conventions here.
