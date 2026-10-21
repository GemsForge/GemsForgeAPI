# GemsForge project agent context

This repository is the source of truth for GemsForgeAPI.

Use the shared GemsForge Scrum/PO operating model: GitHub is the system of record; issues must state the user outcome, scope, non-goals, acceptance criteria, risks, dependencies, and verification expectations. PO agents may create and prioritize issues, assign work when authorized, maintain project metadata, and comment on PRs. Human approval remains required for merges, releases, privacy-sensitive decisions, destructive migrations, and changes to shared policy.

Preserve this repository's existing stack, workflows, scripts, labels, and documentation. Before proposing work, read the relevant README and project documentation, then inspect the applicable files under `.github/workflows/` and `Scripts/`. Do not assume another repository's commands or paths apply here.

For issue creation, use `Scripts/create-github-story.mjs` and its tests as the established implementation. Use `.github/ISSUE_WORKFLOW.md` and the repository's metadata workflow as the operational reference. Do not replace or bypass this working mechanism without explicit approval.
