# Issue and delivery workflow

The working issue is the source of truth for scope, ownership, labels, milestone, Project metadata, and native relationships. A pull request adopts the issue metadata through repository automation.

## Story format

## Story

As a [user], I want [capability] so that [benefit].

## Outcome

Describe the expected user or product result.

## Acceptance criteria

- [ ] Observable requirement
- [ ] Accessibility, responsive, or behavior requirement when relevant
- [ ] Feature outcome that can be verified

## Verification

- Automated: exact commands and required PR checks.
- Manual: browser, accessibility, responsive, or other review.

## Delivery checks

- [ ] Branch follows `<type>/<issue-number>-<short-description>`.
- [ ] Commit and PR title follow `type(scope): #issue-number short imperative description`.
- [ ] Approved commit types: `feat`, `fix`, `refactor`, `test`, `chore`.
- [ ] Approved `chore` scopes: `docs`, `ci`, `deps`, `build`.
- [ ] PR body includes `Closes #issue-number`.
- [ ] PR adopts the issue’s assignee, labels, milestone, and relationships.
- [ ] Existing label policy passes; no labels are created by automation.
- [ ] CI, commit policy, branch policy, label policy, and metadata checks pass.

## Repository metadata

- Assignee: Gem Code unless another authorized owner is documented.
- Labels: existing repository labels only; infer the applicable label from the story/commit type where the repository policy defines that mapping.
- Project fields: use existing Priority, Size, and Estimate options; do not create competing fields or values.

Suggested metrics: Priority P0/P1/P2/P3; Size XS/S/M/L/XL; Estimate as numeric effort points using the existing project scale.

## Project synchronization

GemsForgeAPI’s existing Project #7 synchronization, PROJECTS_TOKEN secret, lifecycle status reconciliation, and native relationship automation remain authoritative.

## Relationships

Parent, blocked-by, blocking, and related relationships must be explicit native GitHub relationships. Do not infer them from prose, labels, or milestones.

## Delivery lifecycle

Issue → numbered branch → implementation → checks → reviewed PR → merge → Project/status reconciliation.

PR creation and merging are separate authorized actions. Completion requires passing checks, review, and linked issue/Project reconciliation.
