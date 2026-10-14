# Issue and pull request workflow

The working issue is the source of truth for assignee, labels, milestone,
project membership, and native issue relationships. Project Status follows the
issue's development lifecycle. The shared automation is
`.github/workflows/sync-pr-metadata.yml`; its YAML comments document the policy.

## One workflow, two entry points

- When an issue opens, reopens, or closes, ensure it belongs to GemsForgeAPI
  project #7 and reconcile its Status.
- When a PR opens, reopens, is edited, or becomes ready for review, resolve its
  working issue and copy the issue's assignees, labels, and milestone to the PR. Derive Status for both items from the lifecycle
  below. Ensure both items belong to project #7.
- Manual dispatch also accepts an issue without any PR. Issue-creation scripts
  should dispatch this same workflow immediately after creating the issue with
  its chosen assignee, labels, milestone, and relationships.

Branches include the working issue number, such as `chore/170-example`.
PR bodies include a closing reference such as `Closes #170`.
An explicit issue supplied with a PR must agree with its working issue.
PR creation and merging remain separate, authorized steps.

## Native relationship inputs

| Input | Meaning |
| --- | --- |
| `issue_number` | Working issue; optional when a linked PR is supplied |
| `pr_number` | PR whose metadata should match its issue; optional for issue-only runs |
| `parent_issue` | Parent issue; the working issue becomes its sub-issue |
| `blocked_by` | Comma-separated issues that must be completed before the working issue |
| `blocking` | Comma-separated issues waiting on the working issue |

All numbers refer to issues in GemsForge/GemsForgeAPI. Relationships are stored
in GitHub's native relationship fields, not added to descriptions. Parent means
a decomposition of broader work; blocked-by means an actual prerequisite.
Do not label a merely related issue as a dependency. This implementation supports
parent/sub-issue and dependency links; it does not invent a generic related-issue
field or infer relationships from matching labels or milestones.

Blank relationship inputs preserve existing links. Repeated runs skip links
already present. Conflicting parents fail instead of automatically reparenting.
Self-links, PR targets, malformed numbers, and directly contradictory dependency
inputs fail before writes. GitHub also validates hierarchy/dependency cycles.
Operations are not transactional: if GitHub rejects a later operation, earlier
successful operations remain; correct the inputs and rerun safely.

The workflow can be called by the existing development automation without using
the GitHub UI. For example, to register issue #170 under parent #168:

```sh
gh workflow run sync-pr-metadata.yml \
  --repo GemsForge/GemsForgeAPI \
  --ref chore/170-project-metadata-sync \
  -f issue_number=170 \
  -f parent_issue=168
```

To supply dependencies too, append `-f blocked_by=171,172` or
`-f blocking=173` only when those prerequisites are established. Those numbers
are examples, not relationships to create automatically.
Use the default branch as the ref after this change is merged.

## Credentials and local configuration

- `PROJECTS_TOKEN`: GitHub repository Settings → Secrets and variables →
  Actions → repository secret. This supplies Projects API authorization.
  For the current classic PAT, GitHub documents the `project` and `repo` scopes.
- `GITHUB_TOKEN`: supplied by Actions with `issues: write`,
  `pull-requests: write`, and `contents: read`. Repository metadata and native
  relationships use this token; project mutations explicitly use PROJECTS_TOKEN.
- `DATABASE_PATH` and `LIVE_DATABASE_BACKUP_DIRECTORY`: local Xcode scheme
  environment variables. They do not belong in the Actions project secret.
- Never commit token values or store them in a shared Xcode scheme.

## Automatic lifecycle

| Repository event / current state | Issue Status | PR Status |
| --- | --- | --- |
| Numbered development branch created, no open related PR | In progress | — |
| Related PR opened/reopened, including a draft | In review | In review |
| Closing PR merged into the default branch | Done; issue closed | Done |
| PR closed without merging, another related PR remains open | In review | Done for the closed PR |
| PR closed without merging, no other related PR remains open | In progress | Done for the closed PR |
| Issue closed directly | Done | Updated on that PR's next synchronization |
| New/reopened issue with no branch or PR | Backlog | — |

The code resolves existing Status option IDs by their names: `Backlog`,
`In progress`, `In review`, and `Done`. It fails clearly if an expected option
is missing, rather than creating a competing status. These are project item
fields; Git branches themselves do not have a project Status property.

A branch must identify its issue, for example `fix/170-example` or
`chore/170-project-metadata-sync`. Recognized prefixes are feat, fix, docs,
refactor, test, chore, ci, build, perf, and style. Branch events that do not
identify an issue and tag events are ignored. Branch naming is used to identify
the issue; this workflow does not create a native Development-sidebar branch link.

Use `Closes #170` in the PR description. `Fixes #170` and `Resolves #170`
also work; capitalization and an optional colon are accepted.
A plain `#170` mention or `#close` is not a closing instruction.
The issue closes **on merge into the repository's default branch**, not when
the keyword is first written. Merges into other branches do not close it.
GitHub handles native closing references; the workflow also reconciles the
working issue's closure on a merged closing PR or a manual PR repair run.
Multiple closing references can close multiple issues natively; each issue's
closed event updates its own project Status.

Current repository state takes precedence over arrival order: a late branch
event cannot move an issue out of review while a related PR is open, and a
closed issue stays Done. Manual dispatch can repair Status by looking up open
PRs and development branches. Existing project workflows must not independently
assign conflicting values for these same events.

## Verification and activation

Run the tests from the repository root:

```sh
node --test .github/tests/sync-issue-workflow.test.cjs
```

They execute the actual inline workflow script against simulated REST and
GraphQL APIs, with no credentials or network requests. They cover issue-only
runs, native parent and dependency links, repeated runs, blank inputs, invalid
targets, parent conflicts, branch/PR/merge lifecycle transitions, closed PRs,
late events, and existing PR metadata behavior.

For live verification, dispatch on the development branch and inspect the job
notices for relationship counts and project synchronization. A successful
dispatch on this branch does not activate the new issue-event behavior on the
default branch: merge the reviewed workflow first. Branch creation executes the
workflow available on the created branch, so future development branches should
start from the updated default branch. Actions-triggered changes made using
GITHUB_TOKEN do not generate most subsequent workflow runs; scripts that create
branches or PRs with that token should explicitly dispatch this workflow as well.

## GitHub references

- [Closing keywords and linked issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [Workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Sub-issue API](https://docs.github.com/en/rest/issues/sub-issues)
- [Issue dependency API](https://docs.github.com/en/rest/issues/issue-dependencies)
- [Projects automation with Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
