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
    number, { id: number * 10, node_id: "I" + number, number, state: "open",
      labels: [{ name: "testing" }], assignees: [{ login: "GemsForge" }],
      milestone: { number: 3, title: "UI" } },
  ]));
  const writes = [], notices = [], parents = new Map(), dependencies = new Map();
  let projects = [], statusWrites = 0, failures = 0;
  const openPulls = [], branches = [], statuses = [];
  const options = ["Backlog", "In progress", "In review", "Done"].map((name) => ({id: name, name}));
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
    body: "Closes #170", state: "open", base: { ref: "master" }, merged: false, assignees: [{ login: "OldDeveloper" }] };
  const github = {
    request,
    paginate: async (route, args) => {
      if (route === github.rest.pulls.list) return openPulls;
      if (route === github.rest.repos.listBranches) return branches;
      return dependencies.get(args.issue_number) || [];
    },
    rest: {
      pulls: { list: () => {}, get: async () => ({ data: pr }) },
      repos: { listBranches: () => {} },
      issues: {
        get: async ({ issue_number }) => {
          if (!issues.has(issue_number)) throw Object.assign(new Error("Missing target"), { status: 404 });
          return { data: issues.get(issue_number) };
        },
        ...Object.fromEntries(["setLabels", "removeAssignees", "addAssignees", "update"]
          .map((method) => [method, async (args) => { writes.push({ method, args }); if (args.state) issues.get(args.issue_number).state = args.state; }])),
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
    } else if (query.includes("fields(first")) {
      data = { node: { fields: { nodes: [{id: "F", name: "Status", options}] } } };
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
      statuses.push({ itemId: variables.itemId, status: variables.optionId });
      const item = projects.find((candidate) => candidate.id === variables.itemId);
      if (item) item.fieldValues = {nodes: [{
        field: {id: "F", name: "Status"}, optionId: variables.optionId,
      }]};
      data = { updateProjectV2ItemFieldValue: { projectV2Item: { id: variables.itemId } } };
    } else throw new Error("Unexpected GraphQL request");
    return { ok: true, json: async () => ({ data }) };
  };
  const run = (env = {}, payload = {}) => execute(
    github, { repo: { owner: "GemsForge", repo: "GemsForgeAPI" }, payload: { repository: { default_branch: "master" }, ...payload },
      eventName: payload.ref_type ? "create" : payload.pull_request ? "pull_request" :
        payload.issue ? "issues" : "workflow_dispatch" },
    { notice: (message) => notices.push(message), setFailed: (message) => {
      failures++; throw new Error(message);
    } },
    { env: { PROJECTS_TOKEN: "fake-project-token", ...env } }, fetch,
  );
  return { run, writes, notices, parents, dependencies, issues, projects, pr,
    openPulls, branches, statuses, options,
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
test("PR metadata sync puts both issue and PR in review", async () => {
  const f = fixture();
  f.projects.push({ id: "I170", content: { __typename: "Issue", number: 170,
    repository: { nameWithOwner: "GemsForge/GemsForgeAPI" } }, fieldValues: { nodes: [
      { __typename: "ProjectV2ItemFieldSingleSelectValue", field: { id: "F", name: "Status" },
        optionId: "in-progress" },
    ] } });
  await f.run({ PR_NUMBER: "169" });
  assert.deepEqual(f.writes.map((x) => x.method),
    ["setLabels", "removeAssignees", "addAssignees", "update"]);
  assert.equal(f.statusWrites(), 2);
  assert.deepEqual(f.statuses.map((value) => value.status), ["In review", "In review"]);
  assert.equal(f.projects.length, 2);
  assert.equal(f.failures(), 0);
});
test("explicit issue must match the PR working issue", async () => {
  const f = fixture();
  await assert.rejects(f.run({ PR_NUMBER: "169", ISSUE_NUMBER: "168" }), /must match/);
  assert.equal(f.writes.length, 0);
});

test("creating a numbered development branch moves the issue to In progress", async () => {
  const f = fixture();
  await f.run({}, { ref_type: "branch", ref: "fix/170-example" });
  assert.equal(f.statuses[0].status, "In progress");
});
test("a delayed branch event preserves In review when an open PR exists", async () => {
  const f = fixture(); f.openPulls.push(f.pr);
  await f.run({}, { ref_type: "branch", ref: "fix/170-example" });
  assert.equal(f.statuses[0].status, "In review");
});
test("draft PRs put issue and PR in review without closing the issue", async () => {
  const f = fixture(); f.pr.draft = true;
  await f.run({ PR_NUMBER: "169" });
  assert.deepEqual(f.statuses.map((value) => value.status), ["In review", "In review"]);
  assert.equal(f.issues.get(170).state, "open");
});
test("a merged closing PR closes the issue and sets both items to Done", async () => {
  const f = fixture(); f.pr.merged = true; f.pr.state = "closed";
  f.pr.body = "CLOSES: #170";
  await f.run({ PR_NUMBER: "169" });
  assert.equal(f.issues.get(170).state, "closed");
  assert.deepEqual(f.statuses.map((value) => value.status), ["Done", "Done"]);
});
test("a closing reference on an unmerged PR does not close the issue", async () => {
  const f = fixture(); f.pr.state = "closed";
  await f.run({ PR_NUMBER: "169" });
  assert.equal(f.issues.get(170).state, "open");
  assert.equal(f.statuses[0].status, "In progress");
});
test("a merge to a nondefault branch or a plain mention cannot close the issue", async () => {
  for (const changes of [{ base: {ref: "release"} }, { body: "Related to #170" }]) {
    const f = fixture(); Object.assign(f.pr, { merged: true, state: "closed" }, changes);
    await f.run({ PR_NUMBER: "169" });
    assert.equal(f.issues.get(170).state, "open");
    assert.equal(f.statuses[0].status, "In progress");
    assert.equal(f.statuses[1].status, "Done");
  }
});
test("closing one PR keeps review status when another related PR is open", async () => {
  const f = fixture(); f.pr.state = "closed";
  f.openPulls.push({ ...f.pr, number: 999, state: "open" });
  await f.run({ PR_NUMBER: "169" });
  assert.equal(f.statuses[0].status, "In review");
});
test("closed issues stay Done even when an old branch event arrives", async () => {
  const f = fixture(); f.issues.get(170).state = "closed";
  await f.run({}, { ref_type: "branch", ref: "fix/170-example" });
  assert.equal(f.statuses[0].status, "Done");
});
test("tags and unrelated branches are ignored without mutations", async () => {
  for (const payload of [
    { ref_type: "tag", ref: "fix/170-example" },
    { ref_type: "branch", ref: "master" },
  ]) {
    const f = fixture(); await f.run({}, payload);
    assert.equal(f.writes.length, 0); assert.equal(f.projects.length, 0);
  }
});
test("manual repair sees an existing development branch", async () => {
  const f = fixture(); f.branches.push({ name: "chore/170-example" });
  await f.run({ ISSUE_NUMBER: "170" });
  assert.equal(f.statuses[0].status, "In progress");
});
test("missing Status option fails clearly rather than creating a new taxonomy", async () => {
  const f = fixture(); f.options.splice(0);
  await assert.rejects(f.run({ ISSUE_NUMBER: "170" }), /Status option 'Backlog' is missing/);
  assert.equal(f.statusWrites(), 0);
});
