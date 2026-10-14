# Commit policy enforcement

Every new commit subject follows the repository policy:

```text
type(scope): #issue short imperative description
```

Approved types are **feat, fix, refactor, test, docs, chore**. Types and scopes
are lowercase. The issue number is positive; the description is nonblank and
starts with a lowercase word. Write an imperative description such as `add`,
`fix`, `document`, or `optimize`. The checker validates syntax, not English
grammar or whether the issue exists. It does not add a scope registry or
approve `perf`.

Example: `chore(ci): #173 enforce commit message policy`.

`Scripts/commit-policy.json` stores the approved types, example, and historical
baseline. `Scripts/commit-policy.mjs` is the shared validator used locally and
by `.github/workflows/commit-policy.yml`.

## Install push blocking

Requires Git and Node.js 24, the same runtime used in CI. Run once per clone:

```sh
node Scripts/install-git-hooks.mjs
```

The installer writes the executable pre-push hook and a self-contained snapshot
of the validator/config to the active Git hooks directory. No global Git
configuration changes. Default hooks are shared by linked worktrees, including
older branches without these Scripts files. Custom `core.hooksPath` settings
are respected; install separately in worktrees with different hook paths.
Reinstall after updating the policy or validator.

An existing executable pre-push hook is preserved as
`pre-push.before-gemsforge` and receives its original arguments and stdin after
policy validation passes. Other hooks remain untouched. Conflicting backups
or an inactive existing hook stop installation with a diagnostic. Reinstalling
updates our snapshot without replacing the preserved hook.

Ordinary `git push` checks all outgoing new commits. An invalid subject prints
its SHA, failed rule, and an example, then blocks the entire push. New branches,
existing branches, multiple refs, and annotated tags are covered. Deletions and
non-commit tags have no commit subjects to check. Missing history fails with
a fetch instruction rather than silently skipping validation.

New branches exclude commits already reachable from that remote's tracking
refs. CI independently checks the PR range against its base. Fetch before
pushing if remote tracking refs are stale.

## GitHub checks and merge protection

The **Commit policy** workflow runs on branch pushes and PR creation, updates,
and title edits. It fetches full history, runs the validator's integration tests,
and checks every introduced commit. PR titles are checked as the proposed
squash-merge subject. Permissions are read-only; no project token or shell
interpolation of commit messages/titles is used.

Actions run **after GitHub receives a push**. Local pre-push validation stops
the local transfer. Local hooks can be bypassed or missing on another clone.
To make CI mandatory before merging, after the first successful check:

1. Open repository **Settings → Branches → Branch protection rules**, or the
   equivalent branch ruleset, and protect `master`.
2. Require pull requests and status checks before merging.
3. Select the GitHub Actions check named **Commit policy**.
4. Restrict direct pushes and review bypass permissions for the intended policy.

Installing the workflow does not itself create a server-side protection rule.
Verify the rule before relying on CI as a mandatory merge gate.

## Merge, revert, and existing history

No blanket exemptions apply to Git-generated messages. `Merge pull request ...`,
`Revert "..."`, and `fixup! ...` fail. Prefer a squash merge retaining the valid
PR title. If necessary, explicitly name a merge/revert commit, for example
`chore(ci): #173 merge reviewed policy changes` or
`fix(ui): #132 revert attachment presentation`. The PR check cannot stop a
maintainer overriding the final squash message; preserve the checked title.
The push workflow checks the resulting commit too.

Existing history through `5234690ba4a6c97239ea85acef4dd7530d6432e8` (PR #172)
is grandfathered. Only commits reachable from that exact baseline are excluded;
later commits and unrelated histories are checked. Advancing that baseline is
a policy change, not a workaround for an invalid message. No operation amends,
rewrites, or force-pushes history.

The older synced Project File `Git_Commit_Message_Standards.md` uses
`scope(Type):`. The current repository policy in `docs/Local-Development.md`
uses `type(scope): #issue description` and is the enforced reference. Synced
Project Files remain read-only; reconcile the older file in its source system.

## Verification and troubleshooting

```sh
node --test Scripts/commit-policy.test.mjs
printf '%s\n' 'chore(ci): #173 enforce commit policy' | node Scripts/commit-policy.mjs subject
```

Tests use isolated temporary repositories and bare remotes to verify real push
blocking, valid pushes, complete ranges, multiple refs, deletions, tags, legacy
history, preserved hooks, custom paths, linked worktrees, and CI event handling.

When rejected, inspect the listed commit and correct its subject in your normal
reviewed amend/reword workflow. Coordinate any change to already-pushed history.
The checker never rewrites it for you. Missing Node or history blocks the push;
install Node/fetch history before retrying. Reinstall from the latest policy
checkout if the local snapshot and CI disagree.

References: [Git pre-push hooks](https://git-scm.com/docs/githooks#_pre_push),
[GitHub push events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push).
