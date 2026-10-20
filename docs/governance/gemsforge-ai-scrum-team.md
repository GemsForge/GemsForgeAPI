# GemsForge AI Scrum Team

This is shared GemsForge governance, adapted to GemsForge/GemsForgeAPI. It is additive guidance; local repository policy remains authoritative.

## Roles

- Scrum Master: owns sprint goal, work-in-progress limits, blockers, and stopping points.
- Business Analyst: turns intent into issues with outcome, acceptance criteria, relationships, and verification.
- GitHub Steward: preserves repository metadata, labels, Projects, Actions, branch, commit, and PR conventions.
- Product Designer: protects user flows, accessibility, responsiveness, and product identity.
- Frontend Engineer: implements client behavior within established components and state boundaries.
- Backend & Data Engineer: implements API, persistence, validation, security, and contracts within existing architecture.
- QA/DevOps: defines evidence, runs checks, reviews Actions, and reports blockers.

These are responsibilities that ChatGPT/Codex may perform; they are not separate accounts or permissions.

## Local context

- Repository: GemsForge/GemsForgeAPI
- Stack: Swift 6 / Vapor / Fluent / SQLite with React + TypeScript Console
- Local authority: README.md, .github/ISSUE_WORKFLOW.md, docs/Commit-Policy.md, docs/Workflow-Operations.md, architecture and security docs
- Default branch: use the repository's current default branch; this branch is not a universal convention.

## GitHub-first workflow

1. Inspect repository policies, current work, labels, Projects, Actions, architecture, and security boundaries.
2. Create or update the working issue with goal, scope, acceptance criteria, relationships, and exact verification.
3. Report a plan checkpoint before materially ambiguous work.
4. Implement on an issue-numbered branch using local branch and commit rules.
5. Verify with named automated and manual checks.
6. Open a linked PR only when authorized; include evidence and remaining work.
7. Stop at a delivery report. Merge, deploy, close, Project changes, secrets, and credentials are separate approvals.

## Approval boundary

Implementation, documentation, tests, and a reviewable PR are allowed when scoped by the user and local policy permits them. Require explicit approval for merge, deployment/publishing, issue closure, Project status or milestone changes, branch protection, Actions secrets/variables, credentials, destructive cleanup, or material new dependencies.

## Checkpoints

- Plan: goal, stories, acceptance criteria, risks, dependencies, stop condition.
- Development: branch, files, implementation notes, checks, blockers.
- Delivery: delivered/outstanding, evidence, decisions, risks, next sprint.
- Approval: approve changes, request revision, approve merge, approve deploy, or defer.

Use docs/governance/templates/sprint-delivery-report.md and docs/governance/templates/development-checkpoint.md.
