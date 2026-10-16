import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const policy = JSON.parse(readFileSync(join(here, "commit-policy.json"), "utf8"));
const oidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const zero = (oid) => /^0+$/.test(oid);
const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Validates only the first line; optional body text is not executable input. */
export function validateSubject(subject, rules = policy) {
  const match = /^([a-z]+)\(([a-z][a-z0-9-]*)\): #([1-9]\d*) (.+)$/.exec(subject);
  if (!match) return [`Expected ${rules.format}; use lowercase type/scope and a positive issue number.`];
  const errors = [];
  if (!rules.types.includes(match[1])) errors.push(`Unapproved type '${match[1]}'. Allowed: ${rules.types.join(", ")}.`);
  const description = match[4];
  if (description.trim() !== description || !/^[a-z][a-z0-9-]*(?:\s+\S.*)?$/.test(description) || /[\x00-\x1f\x7f]/.test(description)) {
    errors.push("Description must be nonblank, start with a lowercase word, and have no surrounding whitespace/control characters. Use an imperative verb.");
  }
  return errors;
}

function isStandardMergeCommit(oid, subject) {
  const parents = git(["show", "-s", "--format=%P", requireCommit(oid)]).split(/\s+/).filter(Boolean);
  return parents.length > 1 && /^(?:Merge (?:branch|remote-tracking branch) '.+'(?: into .+)?|Merge pull request #[1-9]\d* from .+)$/.test(subject);
}

function requireCommit(oid) {
  if (!oidPattern.test(oid)) throw new Error("Invalid or missing commit SHA.");
  try { git(["cat-file", "-e", `${oid}^{commit}`]); }
  catch { throw new Error(`Commit ${oid} is unavailable. Fetch the remote history (CI requires fetch-depth: 0), then retry.`); }
  return oid;
}

function listCommits(head, exclusions = [], excludeRemote) {
  requireCommit(head);
  requireCommit(policy.legacyBase);
  const args = ["rev-list", head, "--not", policy.legacyBase];
  for (const oid of exclusions) args.push(requireCommit(oid));
  if (excludeRemote) {
    // Remote names are checked against Git's configured names before use.
    if (git(["remote"]).split("\n").includes(excludeRemote)) args.push(`--remotes=${excludeRemote}`);
  }
  const text = git(args);
  return text ? text.split("\n") : [];
}

export function validateCommits(commits) {
  let failures = 0;
  for (const oid of new Set(commits)) {
    const subject = execFileSync("git", ["show", "-s", "--format=%B", requireCommit(oid)], { encoding: "utf8" }).split(/\r?\n/, 1)[0];
    if (isStandardMergeCommit(oid, subject)) continue;
    const errors = validateSubject(subject);
    if (errors.length) {
      failures++;
      console.error(`Commit ${oid.slice(0, 12)}: ${JSON.stringify(subject)}`);
      for (const error of errors) console.error(`  - ${error}`);
    }
  }
  if (failures) {
    console.error(`Commit policy failed for ${failures} commit(s). Example: ${policy.example}`);
    console.error("Amend/reword your local commit messages after review, then retry. No history was changed.");
    return false;
  }
  console.log(`Commit policy passed (${new Set(commits).size} new commit(s)).`);
  return true;
}

export function prePush(input, remote) {
  const commits = [];
  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error("Invalid pre-push ref input.");
    const [, localOID, remoteRef, remoteOID] = fields;
    if (!oidPattern.test(localOID) || !oidPattern.test(remoteOID)) throw new Error("Invalid pre-push SHA.");
    if (zero(localOID)) continue; // Ref deletion sends no commits.
    if (!remoteRef.startsWith("refs/heads/") && !remoteRef.startsWith("refs/tags/")) {
      throw new Error(`Unsupported pushed ref: ${remoteRef}`);
    }
    // Peel annotated tags to commits. Non-commit tags send no commit messages.
    let head;
    try { head = git(["rev-parse", "--verify", `${localOID}^{commit}`]); }
    catch {
      if (remoteRef.startsWith("refs/tags/")) continue;
      throw new Error(`Cannot resolve branch commit ${localOID}.`);
    }
    let previous = [];
    if (!zero(remoteOID)) {
      previous = [git(["rev-parse", "--verify", `${remoteOID}^{commit}`])];
    }
    commits.push(...listCommits(head, previous, zero(remoteOID) ? remote : undefined));
  }
  return validateCommits(commits);
}

export function validateGitHubEvent(event, name) {
  let commits;
  if (name === "pull_request") {
    commits = listCommits(event.pull_request.head.sha, [event.pull_request.base.sha]);
    const errors = validateSubject(event.pull_request.title);
    if (errors.length) {
      console.error(`PR title (proposed squash subject): ${errors.join(" ")} Example: ${policy.example}`);
      return false;
    }
  } else if (name === "push") {
    if (event.deleted || zero(event.after)) return true;
    if (zero(event.before)) {
      const baseRef = `refs/remotes/origin/${event.repository.default_branch}`;
      git(["check-ref-format", baseRef]);
      const base = git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
      commits = listCommits(event.after, [base]);
    } else {
      try {
        commits = listCommits(event.after, [event.before]);
      } catch (error) {
        // A force-push can make its `before` commit unreachable before the
        // Actions runner fetches it. Validate against the current default
        // branch instead of failing solely because that old object expired.
        if (!event.forced || !String(error).includes(event.before)) throw error;
        const baseRef = `refs/remotes/origin/${event.repository.default_branch}`;
        git(["check-ref-format", baseRef]);
        const base = git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
        commits = listCommits(event.after, [base]);
      }
    }
  } else throw new Error(`Unsupported workflow event: ${name}`);
  return validateCommits(commits);
}

function main() {
  const [mode, remote, location] = process.argv.slice(2);
  if (mode === "pre-push") {
    const input = readFileSync(0, "utf8");
    if (!prePush(input, remote)) return 1;
    const legacy = join(here, "..", "pre-push.before-gemsforge");
    if (existsSync(legacy)) {
      const result = spawnSync(legacy, [remote, location], { input, encoding: "utf8" });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.error) throw result.error;
      return result.status ?? 1;
    }
    return 0;
  }
  if (mode === "github") {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    return validateGitHubEvent(event, process.env.GITHUB_EVENT_NAME) ? 0 : 1;
  }
  if (mode === "subject") {
    const subject = readFileSync(0, "utf8").replace(/\r?\n$/, "");
    const errors = validateSubject(subject);
    if (errors.length) console.error(errors.join("\n"), `Example: ${policy.example}`);
    return errors.length ? 1 : 0;
  }
  throw new Error("Usage: node Scripts/commit-policy.mjs pre-push|github|subject");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(`Commit policy: ${error.message}`); process.exitCode = 1; }
}
