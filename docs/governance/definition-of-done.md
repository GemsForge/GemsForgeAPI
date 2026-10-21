# Definition of Done and verification matrix

This supplements README.md, .github/ISSUE_WORKFLOW.md, docs/Commit-Policy.md, and docs/Workflow-Operations.md.

A story is ready for review when acceptance criteria, native relationships, compliant issue-linked commits, API/data/security boundaries, applicable checks, and a delivery report are complete.

| Area | Required evidence |
| --- | --- |
| Swift build | swift build |
| Tests | swift test |
| Commit/workflow | Commit policy, issue/branch/PR linkage, labels, Project synchronization |
| API/database | Changed route behavior and isolated migration tests |
| Console | React/TypeScript and accessibility review when UI changes |
| Security | Owner auth, account isolation, private network, secrets, backups |
| Delivery | PR Actions and delivery report |

Record exact blockers; do not claim full verification. Merge, deployment, live migration, and Project changes remain separate approvals.
