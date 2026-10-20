# Definition of Done and verification matrix

This matrix supplements README.md, .github/ISSUE_WORKFLOW.md, docs/Commit-Policy.md, and docs/Workflow-Operations.md. It does not replace local policy.

## Definition of Done

A story is done for review when:

- Acceptance criteria and explicit native relationships are satisfied or exceptions are documented.
- The issue-numbered branch and commit/PR title follow repository policy.
- API routes, services, models, migrations, and live-database boundaries remain coherent.
- Private-hosting, owner authorization, credentials, and database safety were reviewed.
- Applicable automated checks pass.
- A sprint delivery report records evidence, outstanding work, and approval needed.

Merge, deployment, live migration, and Project changes remain separate approvals.

## Verification matrix

| Area | Required evidence |
| --- | --- |
| Swift build | swift build |
| Tests | swift test |
| Commit policy | Local hook and GitHub commit-policy check |
| Workflow | Issue/branch/PR linkage, labels, and Project synchronization reviewed |
| API | Health route and changed route/service behavior verified |
| Database | Isolated migration tests; live schema or personal database changes require explicit review |
| Console | React/TypeScript checks and responsive/accessibility review when UI changes |
| Security | Owner-only auth, account isolation, private network, secrets, and backup boundaries reviewed |
| Delivery | PR Actions and delivery report verified |

If a check cannot run, record the exact blocker; do not claim full verification.
