import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { policy, validateSubject } from "./commit-policy.mjs";

const source = dirname(fileURLToPath(import.meta.url));
// Test repositories never inherit the developer's signing/hooks configuration.
const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
function fixture(t, { legacy = false, custom = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gemsforge-commit-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, "local"), remote = join(dir, "remote.git");
  mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "master");
  git("config", "user.name", "Policy Test"); git("config", "user.email", "policy@example.invalid");
  git("commit", "--allow-empty", "-m", "legacy history is retained");
  const baseline = git("rev-parse", "HEAD");
  git("init", "--bare", remote); git("remote", "add", "origin", remote);
  git("push", "-u", "origin", "master");
  mkdirSync(join(repo, "Scripts")); mkdirSync(join(repo, ".githooks"));
  for (const name of ["commit-policy.mjs", "install-git-hooks.mjs"]) copyFileSync(join(source, name), join(repo, "Scripts", name));
  writeFileSync(join(repo, "Scripts", "commit-policy.json"), JSON.stringify({ ...policy, legacyBase: baseline }));
  copyFileSync(join(source, "..", ".githooks", "pre-push"), join(repo, ".githooks", "pre-push"));
  if (custom) { mkdirSync(join(repo, "custom hooks")); git("config", "core.hooksPath", "custom hooks"); }
  const hooks = git("rev-parse", "--path-format=absolute", "--git-path", "hooks");
  if (legacy) {
    writeFileSync(join(hooks, "pre-push"), "#!/bin/sh\ncat > legacy-input\nexit 0\n");
    chmodSync(join(hooks, "pre-push"), 0o755);
  }
  const node = (name, args = [], options = {}) => spawnSync(process.execPath, [join(repo, "Scripts", name), ...args], { cwd: repo, env, encoding: "utf8", ...options });
  const install = node("install-git-hooks.mjs"); assert.equal(install.status, 0, install.stderr);
  const commit = (message) => { git("commit", "--allow-empty", "-m", message); return git("rev-parse", "HEAD"); };
  const push = (...refs) => spawnSync("git", ["push", "origin", ...refs], { cwd: repo, env, encoding: "utf8" });
  const event = (name, payload) => {
    const path = join(dir, "event.json"); writeFileSync(path, JSON.stringify(payload));
    return node("commit-policy.mjs", ["github"], { env: { ...env, GITHUB_EVENT_NAME: name, GITHUB_EVENT_PATH: path } });
  };
  return { repo, remote, git, commit, push, node, hooks, baseline, event };
}

test("every approved type follows the same required format", () => {
  for (const type of policy.types) assert.deepEqual(validateSubject(`${type}(ui): #173 add policy validation`), []);
});
test("reject unsupported types, missing fields, old notation, and malformed descriptions", () => {
  for (const subject of [
    "perf(ui): #173 optimize images", "Feat(ui): #173 add images", "feat(UI): #173 add images",
    "feat: #173 add images", "feat(ui): add images", "feat(ui): #0 add images",
    "feat(ui): #173 ", "feat(ui): #173   ", "feat(ui): #173 Add images",
    "feat(ui): #173 !!!", "feat(ui): #173 add images ", "ui(Feature): add images",
    "Merge branch 'example'", 'Revert "feat(ui): #173 add images"',
    "fixup! feat(ui): #173 add images",
  ]) assert.ok(validateSubject(subject).length, subject);
});
test("descriptions are treated as data, including shell metacharacters", () => {
  assert.deepEqual(validateSubject("test(ci): #173 check `literal` and $(literal) values"), []);
});
test("an actual push with a valid new commit succeeds and retains legacy history", (t) => {
  const f = fixture(t); f.git("switch", "-c", "feat/173-valid");
  const head = f.commit("feat(ui): #173 add an example");
  const result = f.push("HEAD"); assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git("--git-dir", f.remote, "rev-parse", "refs/heads/feat/173-valid"), head);
});
test("an actual push with an invalid middle commit is blocked, even if the last is valid", (t) => {
  const f = fixture(t); f.git("switch", "-c", "feat/173-invalid");
  const bad = f.commit("perf(ui): #173 optimize images");
  f.commit("test(ui): #173 cover image loading");
  const result = f.push("HEAD"); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unapproved type 'perf'/); assert.ok(result.stderr.includes(bad.slice(0, 12)));
  assert.equal(f.git("--git-dir", f.remote, "for-each-ref", "--format=%(refname)", "refs/heads/feat/173-invalid"), "");
});
test("existing branch updates are checked and deletions are permitted", (t) => {
  const f = fixture(t); f.git("switch", "-c", "chore/173-update");
  f.commit("chore(ci): #173 add a check"); assert.equal(f.push("HEAD").status, 0);
  f.commit("missing required fields"); assert.notEqual(f.push("HEAD").status, 0);
  assert.equal(f.push(":refs/heads/chore/173-update").status, 0);
});
test("multiple refs are validated together; an invalid ref blocks the entire push", (t) => {
  const f = fixture(t); f.git("switch", "-c", "valid"); f.commit("test(ci): #173 cover refs");
  f.git("switch", "-c", "invalid", f.baseline); f.commit("invalid message");
  assert.notEqual(f.push("valid", "invalid").status, 0);
  assert.equal(f.git("--git-dir", f.remote, "for-each-ref", "--format=%(refname)", "refs/heads/valid"), "");
});
test("annotated tags cannot introduce an invalid commit", (t) => {
  const f = fixture(t); f.commit("invalid message"); f.git("tag", "-a", "v-test", "-m", "tag description");
  assert.notEqual(f.push("refs/tags/v-test").status, 0);
});
test("existing hooks are preserved, replayed the original stdin, and survive reinstall", (t) => {
  const f = fixture(t, { legacy: true }); f.git("switch", "-c", "valid");
  f.commit("chore(ci): #173 preserve hooks"); assert.equal(f.push("HEAD").status, 0);
  assert.match(readFileSync(join(f.repo, "legacy-input"), "utf8"), /refs\/heads\/valid/);
  assert.ok(existsSync(join(f.hooks, "pre-push.before-gemsforge")));
  assert.equal(f.node("install-git-hooks.mjs").status, 0);
  assert.equal(readFileSync(join(f.hooks, "pre-push.before-gemsforge"), "utf8"), "#!/bin/sh\ncat > legacy-input\nexit 0\n");
});
test("custom hook paths with spaces are respected without changing configuration", (t) => {
  const f = fixture(t, { custom: true }); f.commit("invalid message");
  assert.equal(f.git("config", "core.hooksPath"), "custom hooks");
  assert.notEqual(f.push("master").status, 0);
});
test("installation protects linked worktrees even on a branch without policy files", (t) => {
  const f = fixture(t); const worktree = join(dirname(f.repo), "linked");
  f.git("worktree", "add", "-b", "linked", worktree);
  execFileSync("git", ["commit", "--allow-empty", "-m", "invalid"], { cwd: worktree, env, stdio: "pipe" });
  const result = spawnSync("git", ["push", "origin", "HEAD"], { cwd: worktree, env, encoding: "utf8" });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Expected type/);
});
test("CI checks the full PR range and proposed squash subject", (t) => {
  const f = fixture(t); const head = f.commit("feat(ui): #173 add a feature");
  const pr = { base: { sha: f.baseline }, head: { sha: head }, title: "feat(ui): #173 add a feature" };
  assert.equal(f.event("pull_request", { pull_request: pr }).status, 0);
  assert.notEqual(f.event("pull_request", { pull_request: { ...pr, title: "Missing issue" } }).status, 0);
  const bad = f.commit("invalid earlier commit"); const last = f.commit("test(ui): #173 cover a feature");
  const result = f.event("pull_request", { pull_request: { ...pr, head: { sha: last } } });
  assert.notEqual(result.status, 0); assert.ok(result.stderr.includes(bad.slice(0, 12)));
});
test("CI handles push ranges, newly created branches, deletion, and unavailable history", (t) => {
  const f = fixture(t); const head = f.commit("docs(ci): #173 document policy");
  const payload = { before: f.baseline, after: head, repository: { default_branch: "master" } };
  assert.equal(f.event("push", payload).status, 0);
  assert.equal(f.event("push", { ...payload, before: "0".repeat(40) }).status, 0);
  assert.equal(f.event("push", { ...payload, deleted: true, after: "0".repeat(40) }).status, 0);
  const missing = f.event("push", { ...payload, before: "f".repeat(40) });
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /Fetch the remote history/);
  const forced = f.event("push", { ...payload, before: "f".repeat(40), forced: true });
  assert.equal(forced.status, 0, forced.stderr);
});
test("standard Git merge commits are allowed, but arbitrary merge messages are not", (t) => {
  const f = fixture(t); f.git("switch", "-c", "feature"); f.commit("feat(ci): #173 add example");
  f.git("switch", "master"); f.git("merge", "--no-ff", "feature");
  assert.equal(f.push("master").status, 0);
  f.git("switch", "-c", "invalid-merge", f.baseline); f.commit("feat(ci): #173 add another example");
  f.git("switch", "master"); f.git("merge", "--no-ff", "invalid-merge", "-m", "Merge feature");
  assert.notEqual(f.push("master").status, 0);
});
test("GitHub pull-request merge commits are allowed", (t) => {
  const f = fixture(t); f.git("switch", "-c", "feature"); f.commit("feat(ci): #173 add example");
  f.git("switch", "master"); f.git("merge", "--no-ff", "feature", "-m", "Merge pull request #216 from GemsForge/feature");
  assert.equal(f.push("master").status, 0);
});
test("subject CLI never executes shell-looking descriptions", (t) => {
  const f = fixture(t);
  const result = f.node("commit-policy.mjs", ["subject"], { input: "test(ci): #173 add $(touch should-not-exist) coverage\n" });
  assert.equal(result.status, 0); assert.equal(existsSync(join(f.repo, "should-not-exist")), false);
  assert.notEqual(f.node("commit-policy.mjs", ["subject"], { input: "invalid\n" }).status, 0);
});
