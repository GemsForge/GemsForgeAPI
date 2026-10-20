# Shared GitHub Actions Standard

Issue: #418

This repository participates in the GemsForge shared Actions standard. The standard defines the contract; this repository remains the adapter.

## Shared contract

- Validate pull requests before merge.
- Keep policy checks for branch names, commit subjects, issue linkage, labels, and required metadata.
- Pin action major versions intentionally and review upgrades.
- Use least-privilege permissions; never expose secrets to untrusted pull-request code.
- Keep checks deterministic, visible, and documented.
- Require the repository's existing checks to pass before merge.
- Treat deployment, production data, secrets, and project-board mutations as separately approved operations.

## Repository adapter

- Preserve the current commit-policy workflow and the repository's Swift/Vapor/Fluent and React/TypeScript conventions.
- Keep issue, PR metadata, Project synchronization, and status transitions repository-specific.
- Do not merge this workflow contract with another repository's implementation when their tokens, Projects, or hosting rules differ.
- Review any future workflow change against the private-hosting and owner-authentication boundaries.

## Change process

Actions changes follow the normal issue → branch → commit → pull request → checks → review flow. Each Actions PR must state which shared contract item it implements, which local checks it touches, and how security was verified.
