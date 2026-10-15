import assert from "node:assert/strict";
import { test } from "node:test";
import { inferLabels } from "./create-github-story.mjs";

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
});

test("rejects malformed titles and unknown scopes", () => {
  assert.throws(() => inferLabels("feature(api): missing supported type"), /type\(scope\)/);
  assert.throws(() => inferLabels("feat(unknown): add support"), /Unknown story scope/);
});
