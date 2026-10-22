# Subagent workflow

Subagents may accelerate independent research, implementation, or verification, but the named role remains accountable for synthesis, issue updates, decisions, and handoffs.

## Delegation rules

- PO-GF may delegate independent product, repository, or dependency research. It retains scope, acceptance criteria, milestone, and priority decisions.
- SM-GF may delegate independent status, check, blocker, or review reports. It retains coordination and merge-readiness decisions.
- UX-GF may delegate separate wireframe, responsive, or accessibility investigations. It retains the experience contract.
- DEV-GF may delegate independent file or verification tracks only when they do not share a changing contract, migration, or tightly coupled behavior.
- QA-GF may delegate independent test, browser, accessibility, or regression checks. It retains the final approval decision.

Subagents must report to the role that spawned them. They may not merge, release, close issues, change Projects, alter secrets, or approve their own work. Sequential gates remain sequential: PO defines, SM decomposes, UX and DEV may parallelize, QA verifies, and only explicit QA approval permits merge consideration.
