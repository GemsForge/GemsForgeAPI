import assert from "node:assert/strict";
import { test } from "node:test";
import { createStory, inferLabels, numberedStoryTitle } from "./create-github-story.mjs";

test("infers the type and scope labels while preserving explicit labels", () => {
  assert.deepEqual(
    inferLabels("feat(api): add property updates", ["enhancement", "api"]),
    ["feature", "api", "enhancement"],
  );
  assert.deepEqual(inferLabels("fix(database): repair migration", []), ["fix", "database"]);
  assert.deepEqual(inferLabels("refactor(ui): simplify controls", []), ["refactor", "ui"]);
  assert.deepEqual(inferLabels("test(database): verify migration", []), ["testing", "database"]);
  assert.deepEqual(inferLabels("docs(ui): document edit states", ["feature"]),
    ["documentation", "ui", "feature"]);
  assert.deepEqual(inferLabels("docs(any-scope): document policy", []), ["documentation", "any-scope"]);
  assert.deepEqual(inferLabels("chore(ci): update workflow", []), ["chore", "ci"]);
});

test("rejects malformed titles and unknown scopes", () => {
  assert.throws(() => inferLabels("feature(api): missing supported type"), /type\(scope\)/);
  assert.throws(() => inferLabels("feat(unknown): add support"), /Unknown story scope/);
  assert.throws(() => inferLabels("ci(api): invalid"), /type\(scope\)/);
});

const fakeGh = ({ dispatchError } = {}) => {
  const calls = [];
  const run = (args, options = {}) => {
    calls.push({ args, options });
    if (args[0] === "workflow") {
      if (dispatchError) throw new Error(dispatchError);
      return "https://github.com/o/r/actions/runs/1";
    }
    return args.includes("POST") ? { number: 42, html_url: "https://github.com/o/r/issues/42" } : {};
  };
  return { calls, run };
};
const storyOptions = (title) => ({ repo: "o/r", title, labels: [], assignees: [], blockedBy: [], blocking: [] });
const fieldValue = (args, name) => args.find((arg) => arg.startsWith(`${name}=`));

test("numbers a story title after GitHub assigns the issue number", () => {
  assert.equal(numberedStoryTitle("feat(api): add pages", 42), "feat(api): #42 add pages");
  assert.equal(numberedStoryTitle("feat(api): #7 add pages", 42), "feat(api): #42 add pages");
});

test("creates a numberless story title, then renames it with the assigned number", () => {
  const gh = fakeGh();
  const result = createStory(storyOptions("feat(api): add pages"), gh.run);

  assert.equal(fieldValue(gh.calls[0].args, "title"), "title=feat(api): add pages");
  assert.equal(fieldValue(gh.calls[1].args, "title"), "title=feat(api): #42 add pages");
  assert.equal(result.title, "feat(api): #42 add pages");
  assert.equal(result.workflowDispatch, "dispatched");
});

test("replaces a guessed story number with the assigned one", () => {
  const gh = fakeGh();
  const result = createStory(storyOptions("feat(api): #7 add pages"), gh.run);

  assert.equal(fieldValue(gh.calls[0].args, "title"), "title=feat(api): add pages");
  assert.equal(result.title, "feat(api): #42 add pages");
});

test("reads the workflow dispatch as text and keeps the created issue when it fails", () => {
  const gh = fakeGh();
  createStory(storyOptions("feat(api): add pages"), gh.run);
  assert.deepEqual(gh.calls.at(-1).options, { json: false });

  const failing = fakeGh({ dispatchError: "workflow not found" });
  const result = createStory(storyOptions("feat(api): add pages"), failing.run);
  assert.equal(result.issueURL, "https://github.com/o/r/issues/42");
  assert.equal(result.workflowDispatch, "failed: workflow not found");
});
