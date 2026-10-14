// Run with: node --test .github/tests/sync-issue-workflow.test.cjs
// Executes the workflow's actual inline JavaScript against an in-memory API.
// No GitHub credentials or network access are used.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const workflow = fs.readFileSync(
  process.env.WORKFLOW_PATH || path.join(__dirname, "../workflows/sync-pr-metadata.yml"),
  "utf8",
);
const source = workflow.split("          script: |\n")[1]
  .split("\n").map((line) => line.startsWith("            ") ? line.slice(12) : line).join("\n");
const execute = new AsyncFunction("github", "context", "core", "process", "fetch", source);
function fixture() {
  const issues = new Map([168, 169, 170, 171, 172].map((number) => [
    number, { id: number * 10, node_id: "I" + number, number,
      labels: [{ name: "testing" }], assignees: [{ login: "GemsForge" }],
      milestone: { number: 3, title: "UI" } },
  ]));
  const writes = [], notices = [], parents = new Map(), dependencies = new Map();
  let projects = [], statusWrites = 0, failures = 0;
  const request = async (route, args) => {
    if (route.startsWith("GET ") && route.endsWith("/parent")) {
      const parent = parents.get(args.issue_number);
      if (!parent) throw Object.assign(new Error("No parent"), { status: 404 });
      return { data: issues.get(parent) };
    }
    if (route.endsWith("/sub_issues")) {
      writes.push({ route, args });
      parents.set(args.sub_issue_id / 10, args.issue_number);
      return { data: {} };
    }
    if (route.endsWith("/dependencies/blocked_by") && route.startsWith("POST ")) {
      writes.push({ route, args });
      dependencies.set(args.issue_number, [
        ...(dependencies.get(args.issue_number) || []), issues.get(args.issue_id / 10),
      ]);
      return { data: {} };
    }
    throw new Error("Unexpected request: " + route);
  };
  const pr = { number: 169, node_id: "PR169", head: { ref: "chore/170-example" },
    body: "Closes #170", assignees: [{ login: "OldDeveloper" }] };
  const github = {
    request,
    paginate: async (_route, args) => dependencies.get(args.issue_number) || [],
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      issues: {
        get: async ({ issue_number }) => {
          if (!issues.has(issue_number)) throw Object.assign(new Error("Missing target"), { status: 404 });
          return { data: issues.get(issue_number) };
        },
        ...Object.fromEntries(["setLabels", "removeAssignees", "addAssignees", "update"]
          .map((method) => [method, async (args) => { writes.push({ method, args }); }])),
      },
    },
  };
  const fetch = async (_url, init) => {
    assert.equal(init.headers.authorization, "Bearer fake-project-token");
    const { query, variables } = JSON.parse(init.body);
    let data;
    if (query.includes("viewer")) {
      data = { viewer: { login: "GemsForge" }, user: { projectsV2: { nodes: [
        { id: "P7", number: 7, title: "GemsForgeAPI" },
      ] } } };
    } else if (query.includes("items(first")) {
      data = { node: { items: { nodes: projects } } };
    } else if (query.includes("addProjectV2ItemById")) {
      const content = variables.contentId.startsWith("PR")
        ? { __typename: "PullRequest", number: 169 }
        : { __typename: "Issue", number: Number(variables.contentId.slice(1)) };
      const item = { id: "ITEM" + variables.contentId, content: {
        ...content, repository: { nameWithOwner: "GemsForge/GemsForgeAPI" },
      }, fieldValues: { nodes: [] } };
      projects.push(item);
      data = { addProjectV2ItemById: { item } };
    } else if (query.includes("updateProjectV2ItemFieldValue")) {
      statusWrites++;
      data = { updateProjectV2ItemFieldValue: { projectV2Item: { id: variables.itemId } } };
    } else throw new Error("Unexpected GraphQL request");
    return { ok: true, json: async () => ({ data }) };
  };
  const run = (env = {}, payload = {}) => execute(
    github, { repo: { owner: "GemsForge", repo: "GemsForgeAPI" }, payload },
    { notice: (message) => notices.push(message), setFailed: (message) => {
      failures++; throw new Error(message);
    } },
    { env: { PROJECTS_TOKEN: "fake-project-token", ...env } }, fetch,
  );
  return { run, writes, notices, parents, dependencies, issues, projects,
    statusWrites: () => statusWrites, failures: () => failures };
}
test("creates native parent and both dependency directions once, without a PR", async () => {
  const f = fixture();
  const inputs = { ISSUE_NUMBER: "170", PARENT_ISSUE: "168",
    BLOCKED_BY: "171,171", BLOCKING: "172" };
  await f.run(inputs);
  assert.equal(f.parents.get(170), 168);
  assert.equal(f.dependencies.get(170)[0].number, 171);
  assert.equal(f.dependencies.get(172)[0].number, 170);
  assert.equal(f.projects.length, 1);
  assert.equal(f.writes.length, 3);
  await f.run(inputs);
  assert.equal(f.writes.length, 3, "repeat must not duplicate relationships");
  assert.equal(f.projects.length, 1, "repeat must not duplicate project items");
});
test("preserves an existing parent and dependencies when inputs are blank", async () => {
  const f = fixture(); f.parents.set(170, 168);
  f.dependencies.set(170, [f.issues.get(171)]);
  await f.run({ ISSUE_NUMBER: "170" });
  assert.equal(f.writes.length, 0);
  assert.equal(f.parents.get(170), 168);
  assert.equal(f.dependencies.get(170).length, 1);
});
test("refuses to reparent and makes no relationship writes", async () => {
  const f = fixture(); f.parents.set(170, 172);
  await assert.rejects(f.run({ ISSUE_NUMBER: "170", PARENT_ISSUE: "168", BLOCKED_BY: "171" }),
    /already has parent/);
  assert.equal(f.writes.length, 0);
});
test("rejects malformed, self, contradictory and missing targets before mutations", async () => {
  for (const inputs of [
    { PARENT_ISSUE: "170" }, { BLOCKED_BY: "171,evil()" },
    { BLOCKED_BY: "171", BLOCKING: "171" }, { PARENT_ISSUE: "999" },
    { PARENT_ISSUE: "168,172" },
  ]) {
    const f = fixture();
    await assert.rejects(f.run({ ISSUE_NUMBER: "170", ...inputs }));
    assert.equal(f.writes.length, 0);
  }
});
test("issue opened events maintain project membership with no PR", async () => {
  const f = fixture();
  await f.run({}, { issue: { number: 170 } });
  assert.equal(f.projects.length, 1);
  assert.equal(f.writes.length, 0);
});
test("PR metadata and status still synchronize from the working issue", async () => {
  const f = fixture();
  f.projects.push({ id: "I170", content: { __typename: "Issue", number: 170,
    repository: { nameWithOwner: "GemsForge/GemsForgeAPI" } }, fieldValues: { nodes: [
      { __typename: "ProjectV2ItemFieldSingleSelectValue", field: { id: "F", name: "Status" },
        optionId: "in-progress" },
    ] } });
  await f.run({ PR_NUMBER: "169" });
  assert.deepEqual(f.writes.map((x) => x.method),
    ["setLabels", "removeAssignees", "addAssignees", "update"]);
  assert.equal(f.statusWrites(), 1);
  assert.equal(f.projects.length, 2);
  assert.equal(f.failures(), 0);
});
test("explicit issue must match the PR working issue", async () => {
  const f = fixture();
  await assert.rejects(f.run({ PR_NUMBER: "169", ISSUE_NUMBER: "168" }), /must match/);
  assert.equal(f.writes.length, 0);
});
