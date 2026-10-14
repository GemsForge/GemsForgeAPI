# Issue and pull request workflow

The working issue is the source of truth for assignee, labels, milestone,
project membership, and native issue relationships. The shared automation is
`.github/workflows/sync-pr-metadata.yml`; its YAML comments document the policy.

## One workflow, two entry points

- When an issue opens or reopens, ensure it belongs to GemsForgeAPI project #7.
- When a PR opens, reopens, is edited, or becomes ready for review, resolve its
  working issue and copy the issue's assignees, labels, milestone, and project
  Status to the PR. Ensure both items belong to project #7.
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

Projects Status is copied when the working issue has a Status option. If the
issue has no Status, no status is invented. Existing project workflows can
supply their defaults. This is distinct from automating lifecycle transitions.

## Verification and activation

Run the tests from the repository root:

```sh
node --test .github/tests/sync-issue-workflow.test.cjs
```

They execute the actual inline workflow script against simulated REST and
GraphQL APIs, with no credentials or network requests. They cover issue-only
runs, native parent and dependency links, repeated runs, blank inputs, invalid
targets, parent conflicts, and existing PR metadata/Status behavior.

For live verification, dispatch on the development branch and inspect the job
notices for relationship counts and project synchronization. A successful
dispatch on this branch does not activate the new issue-event behavior on the
default branch: merge the reviewed workflow first.

## GitHub references

- [Sub-issue API](https://docs.github.com/en/rest/issues/sub-issues)
- [Issue dependency API](https://docs.github.com/en/rest/issues/issue-dependencies)
- [Projects automation with Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
