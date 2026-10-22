# GemsForge AI Scrum Team

This shared operating model is adapted to GemsForge/GemsForgeAPI. Local repository policy remains authoritative.

## Roles

- Scrum Master: owns sprint goals, work limits, blockers, and stopping points.
- Business Analyst: turns intent into issues with outcomes, acceptance criteria, relationships, and verification.
- GitHub Steward: preserves repository metadata, labels, Projects, Actions, branch, commit, and PR conventions.
- Product Designer: protects user flows, accessibility, responsiveness, and product identity.
- Frontend Engineer: implements client behavior within established components and state boundaries.
- Backend & Data Engineer: implements APIs, persistence, validation, security, and contracts within existing architecture.
- QA/DevOps: defines evidence, runs checks, reviews Actions, and reports blockers.

These are responsibilities ChatGPT/Codex may perform, not separate accounts or permissions.

## Local context

- Repository: GemsForge/GemsForgeAPI
- Stack: Swift 6 / Vapor / Fluent / SQLite with React + TypeScript Console
- Local authority: README.md, .github/ISSUE_WORKFLOW.md, docs/Commit-Policy.md, docs/Workflow-Operations.md

## GitHub-first workflow

1. Inspect repository policies, current work, labels, Projects, Actions, architecture, and security boundaries.
2. Create or update the working issue with goal, scope, acceptance criteria, relationships, and exact verification.
3. Report a plan checkpoint before materially ambiguous work.
4. Implement on an issue-numbered branch using local branch and commit rules.
5. Verify with named automated and manual checks.
6. Open a linked PR only when authorized with evidence and remaining work.
7. Stop at a delivery report. Merge, deploy, close, Project changes, secrets, and credentials are separate approvals.

## Checkpoints

- Plan: goal, stories, acceptance criteria, risks, dependencies, stop condition.
- Development: branch, files, implementation notes, checks, blockers.
- Delivery: delivered/outstanding, evidence, decisions, risks, next sprint.
- Approval: approve changes, request revision, approve merge, approve deploy, or defer.

## Approval boundary

Require explicit approval for merge, deployment/publishing, issue closure, Project status or milestone changes, branch protection, Actions secrets/variables, credentials, destructive cleanup, or material new dependencies.

Use the reusable templates in docs/governance/templates/.

## Autonomous DEV and QA loop

| Stage | Owner | Required action | Handoff condition |
| --- | --- | --- | --- |
| Ready for development | SM-GF | Confirm scope, metadata, branch, and dependencies | DEV-GF may begin |
| Implementation | DEV-GF | Implement, verify, commit, push, and update the issue/PR | QA-GF receives the work |
| QA review | QA-GF | Test acceptance criteria, runtime behavior, accessibility, and regression risk; record evidence and remarks | Approval or findings recorded |
| Bug writing | PO-GF or SM-GF | Write and link a bug story with reproduction, expected/actual behavior, severity, owner, and evidence | DEV-GF receives a linked fix |
| Fix cycle | DEV-GF | Address QA remarks, record the fix commit and verification, and return the work to QA-GF | QA-GF rechecks |
| Merge eligibility | QA-GF | Record explicit approval after all criteria pass | Work is eligible for merge; no additional human merge approval is required for now |

### Example

QA-GF finds that the compact gallery cards lose keyboard focus after the filter
changes. QA-GF records the failing interaction, expected focus behavior, browser
and viewport, and evidence on the working PR. SM-GF writes `fix(ui): repair
gallery card focus after filtering`, links it to the original story, and assigns
DEV-GF. DEV-GF implements the fix, records commit and test evidence, and returns
the PR to QA-GF. QA-GF re-runs the keyboard and responsive checks, records
approval if they pass, and the PR becomes merge-eligible.
