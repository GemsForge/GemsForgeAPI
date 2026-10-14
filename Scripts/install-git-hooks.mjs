import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Install a self-contained snapshot, so older branches and linked worktrees
// remain protected even when their checkout does not contain these scripts.
const source = dirname(fileURLToPath(import.meta.url));
const hookDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-path", "hooks"], { encoding: "utf8" }).trim();
const hook = join(hookDir, "pre-push");
const backup = join(hookDir, "pre-push.before-gemsforge");
const marker = "# GemsForge commit-policy pre-push hook.";
mkdirSync(hookDir, { recursive: true });
if (existsSync(hook)) {
  if (lstatSync(hook).isSymbolicLink() || !readFileSync(hook, "utf8").includes(marker)) {
    if (existsSync(backup)) throw new Error(`Existing hook backup already exists: ${backup}. Resolve it before installing.`);
    const stat = lstatSync(hook);
    if (!(stat.mode & 0o111)) throw new Error("An inactive pre-push file exists. Move it aside explicitly before installing; it will not be activated silently.");
    renameSync(hook, backup);
    console.log(`Preserved the existing pre-push hook at ${backup}; it will run after policy validation.`);
  }
}
const bundle = join(hookDir, "gemsforge-commit-policy");
mkdirSync(bundle, { recursive: true });
for (const name of ["commit-policy.mjs", "commit-policy.json"]) copyFileSync(join(source, name), join(bundle, name));
copyFileSync(join(source, "..", ".githooks", "pre-push"), hook);
chmodSync(hook, 0o755);
console.log(`Installed commit policy: ${hook}`);
console.log("No global Git configuration changed. Reinstall after policy updates.");
