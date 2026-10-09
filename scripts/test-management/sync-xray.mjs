// Xray part of /sync-jira-xray: creates Tests (type + steps), Test Sets and Test Plans with Xray GraphQL, adds
// members, and verifies by reading back. Jira-only entities and issue links go through Atlassian MCP instead.
// Every outcome is saved to test-management/state/issue-map.json immediately (see issue-map.mjs).
//
// Usage: node scripts/test-management/sync-xray.mjs <command> [--dry-run] [--limit n] [--only ID,ID]
//   tests        Reconcile and create approved Tests
//   containers   Reconcile and create approved Test Sets and Test Plans (empty; members are added by `members`)
//   members      Add planned Tests to their Test Sets / Test Plans and read the containers back
//   verify       Read back Tests (type, steps, summary, coverage) and containers (membership); record PASS/FAIL
import fs from 'node:fs';
import path from 'node:path';
import { graphql, redact } from '../xray/xray-client.mjs';
import { DONE, loadMap, saveMap } from './issue-map.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'test-management/state/plan.json'), 'utf8'));
const projectMap = JSON.parse(fs.readFileSync(path.join(root, 'test-management/config/project-map.json'), 'utf8'));
const projectKey = projectMap.jira.projectKey;

const args = process.argv.slice(2);
const command = args[0];
const dryRun = args.includes('--dry-run');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
// Xray Standard allows 300 requests / 5 minutes (xray-cloud-rest-api.md §9).
const PACE_MS = 1100;

/** Plan text is Markdown; Jira fields sent through Xray's `jira` object use Jira wiki markup (same as jira-export.mjs). */
const toWiki = (text) =>
  text
    .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
    .replace(/`([^`\n]+)`/g, '{{$1}}')
    .replace(/^### /gm, 'h3. ')
    .replace(/^> ?/gm, 'bq. ');

const label = (localId) => `lid_${localId}`;
const jiraFields = (e, typeName) => ({
  fields: {
    project: { key: projectKey },
    issuetype: { name: typeName },
    summary: e.summary,
    description: toWiki(e.description ?? ''),
    labels: e.labels,
    ...(e.priority ? { priority: { name: e.priority } } : {}),
  },
});

const typeNames = { test: 'Test', testSet: 'Test Set', testPlan: 'Test Plan' };

// Xray's search resolvers (getTests, getTestSets, getTestPlans) fail on this site with "Get approximate count for JQL
// failed!" (2026-10-09), so the identity check uses a Jira search exported through Atlassian MCP
// (searchJiraIssuesUsingJql, fields summary/issuetype/labels) to test-management/tmp/existing-index.json:
// [{ key, id, issuetype, summary, labels }]. It must be fresher than 30 minutes.
const indexFile = path.join(root, 'test-management/tmp/existing-index.json');
function loadIndex() {
  if (!fs.existsSync(indexFile)) throw new Error(`missing ${path.relative(root, indexFile)}: export the MCP JQL search first`);
  if (Date.now() - fs.statSync(indexFile).mtimeMs > 30 * 60 * 1000) throw new Error('existing-index.json is older than 30 minutes: export it again');
  return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
}

/** Issues of this type carrying the local-ID label and summary prefix: the identity check before any create. */
function findExisting(index, type, localId) {
  return index
    .filter((r) => r.issuetype === typeNames[type] && r.labels.includes(label(localId)) && r.summary.startsWith(`${localId} `))
    .map((r) => ({ id: String(r.id), key: r.key, summary: r.summary }));
}

const mutations = {
  test: (e) => [
    `mutation ($testType: UpdateTestTypeInput, $steps: [CreateStepInput], $jira: JSON!) {
      createTest(testType: $testType, steps: $steps, jira: $jira) { test { issueId jira(fields: ["key"]) testType { name } steps { id } } warnings } }`,
    {
      testType: { name: e.xray.testType },
      steps: e.xray.steps.map((s) => ({ action: toWiki(s.action), ...(s.data ? { data: toWiki(s.data) } : {}), result: toWiki(s.result) })),
      jira: jiraFields(e, 'Test'),
    },
    (d) => ({ id: d.createTest.test.issueId, key: d.createTest.test.jira.key, warnings: d.createTest.warnings }),
  ],
  testSet: (e) => [
    `mutation ($jira: JSON!) { createTestSet(testIssueIds: [], jira: $jira) { testSet { issueId jira(fields: ["key"]) } warnings } }`,
    { jira: jiraFields(e, 'Test Set') },
    (d) => ({ id: d.createTestSet.testSet.issueId, key: d.createTestSet.testSet.jira.key, warnings: d.createTestSet.warnings }),
  ],
  testPlan: (e) => [
    `mutation ($jira: JSON!) { createTestPlan(testIssueIds: [], jira: $jira) { testPlan { issueId jira(fields: ["key"]) } warnings } }`,
    { jira: jiraFields(e, 'Test Plan') },
    (d) => ({ id: d.createTestPlan.testPlan.issueId, key: d.createTestPlan.testPlan.jira.key, warnings: d.createTestPlan.warnings }),
  ],
};

const log = [];
let consecutiveFailures = 0;

async function createEntities(types) {
  let writes = 0;
  const index = loadIndex();
  for (const e of plan.entities.filter((x) => types.includes(x.type) && x.approved && (!only || only.has(x.localId)))) {
    const map = loadMap();
    const m = map.entities[e.localId];
    if (DONE.has(m.creationStatus)) continue;
    if (writes >= limit) break;

    // 1. Reconcile: mapped key, else search by local-ID label. "creating" = unknown outcome of an earlier run.
    const found = findExisting(index, e.type, e.localId);
    if (m.creationStatus === 'creating' && found.length === 0) {
      log.push({ localId: e.localId, outcome: 'unknown-outcome', note: 'was "creating"; not in the index. Re-export the index (search lag) before retrying' });
      continue;
    }
    if (found.length > 1) {
      Object.assign(m, { creationStatus: 'failed', duplicates: found.map((f) => f.key), lastError: `duplicate candidates: ${found.map((f) => f.key).join(', ')}`, lastRunId: map.lastRunId });
      saveMap(map);
      log.push({ localId: e.localId, outcome: 'duplicate', keys: found.map((f) => f.key) });
      continue;
    }
    if (found.length === 1) {
      Object.assign(m, { creationStatus: 'matched', jiraKey: found[0].key, jiraId: found[0].id, createdAt: m.createdAt ?? now(), lastError: null, lastRunId: map.lastRunId });
      saveMap(map);
      log.push({ localId: e.localId, outcome: 'matched', key: found[0].key });
      continue;
    }
    if (dryRun) {
      log.push({ localId: e.localId, outcome: 'would-create' });
      continue;
    }

    // 2. Create: persist "creating" first, so an interrupted run searches before retrying.
    Object.assign(m, { creationStatus: 'creating', lastRunId: map.lastRunId });
    saveMap(map);
    const [mutation, variables, pick] = mutations[e.type](e);
    try {
      const result = pick(await graphql(mutation, variables));
      writes++;
      const after = loadMap();
      Object.assign(after.entities[e.localId], {
        creationStatus: 'created',
        jiraKey: result.key,
        jiraId: result.id,
        createdAt: now(),
        lastError: result.warnings?.length ? `warnings: ${result.warnings.join('; ')}` : null,
        ...(e.type === 'test' ? { xray: { ...m.xray, testType: e.xray.testType, definitionStatus: 'set', stepsCount: e.xray.steps.length } } : {}),
      });
      saveMap(after);
      log.push({ localId: e.localId, outcome: 'created', key: result.key, warnings: result.warnings });
      consecutiveFailures = 0;
    } catch (error) {
      // Unknown outcome: keep "creating" so the next run reconciles against a fresh index (never retry blindly).
      // A GraphQL error with HTTP 200 means the mutation was rejected, so that case is a plain failure.
      const rejected = /^graphql errors:|^graphql: HTTP 4/.test(error.message);
      const after = loadMap();
      Object.assign(after.entities[e.localId], { creationStatus: rejected ? 'failed' : 'creating', lastError: redact(error.message).slice(0, 500) });
      saveMap(after);
      log.push({ localId: e.localId, outcome: rejected ? 'failed' : 'unknown-outcome', error: redact(error.message).slice(0, 300) });
      if (++consecutiveFailures > 5 || !rejected) throw new Error(rejected ? 'More than 5 consecutive failures: stopping the run' : 'Unknown create outcome: stopping so the index can be refreshed');
    }
    await sleep(PACE_MS);
  }
}

async function readMembers(type, issueId) {
  const query = type === 'testSet' ? 'getTestSet' : 'getTestPlan';
  const ids = new Set();
  for (let start = 0; ; start += 100) {
    const data = await graphql(`query ($id: String, $start: Int) { ${query}(issueId: $id) { tests(limit: 100, start: $start) { total results { issueId } } } }`, { id: issueId, start }, { retry: true });
    const page = data[query].tests;
    page.results.forEach((r) => ids.add(r.issueId));
    if (start + 100 >= page.total) return ids;
  }
}

async function members() {
  const map = loadMap();
  for (const kind of ['testSetMember', 'testPlanMember']) {
    const type = kind === 'testSetMember' ? 'testSet' : 'testPlan';
    const byContainer = {};
    for (const r of map.relationships.filter((x) => x.kind === kind)) (byContainer[r.to] ??= []).push(r);
    for (const [container, rels] of Object.entries(byContainer)) {
      const c = map.entities[container];
      if (!c?.jiraId || !DONE.has(c.creationStatus)) {
        rels.forEach((r) => Object.assign(r, { creationStatus: 'skipped', lastError: `container ${container} not created` }));
        continue;
      }
      const ready = rels.filter((r) => map.entities[r.from]?.jiraId && DONE.has(map.entities[r.from].creationStatus));
      rels.filter((r) => !ready.includes(r)).forEach((r) => Object.assign(r, { creationStatus: 'skipped', lastError: `test ${r.from} not created` }));
      const current = await readMembers(type, c.jiraId);
      const missing = ready.filter((r) => !current.has(map.entities[r.from].jiraId));
      if (missing.length && !dryRun) {
        const mutation = type === 'testSet' ? 'addTestsToTestSet' : 'addTestsToTestPlan';
        for (let i = 0; i < missing.length; i += 50) {
          const batch = missing.slice(i, i + 50);
          try {
            const data = await graphql(`mutation ($id: String!, $ids: [String]!) { ${mutation}(issueId: $id, testIssueIds: $ids) { addedTests warning } }`, { id: c.jiraId, ids: batch.map((r) => map.entities[r.from].jiraId) }, { retry: true });
            log.push({ container, added: data[mutation].addedTests.length, warning: data[mutation].warning });
          } catch (error) {
            batch.forEach((r) => (r.lastError = redact(error.message).slice(0, 300)));
            log.push({ container, outcome: 'failed', error: redact(error.message).slice(0, 300) });
          }
          await sleep(PACE_MS);
        }
      }
      // Read back: the container is the authority for membership.
      const after = await readMembers(type, c.jiraId);
      for (const r of ready) {
        const present = after.has(map.entities[r.from].jiraId);
        if (dryRun && !present) continue;
        Object.assign(r, {
          creationStatus: present ? (current.has(map.entities[r.from].jiraId) ? 'matched' : 'created') : 'failed',
          verificationStatus: present ? 'PASS' : 'FAIL',
          verifiedAt: now(),
          lastError: present ? null : r.lastError ?? 'not a member after add',
        });
      }
      const planned = new Set(ready.map((r) => map.entities[r.from].jiraId));
      const unexpected = [...after].filter((id) => !planned.has(id));
      log.push({ container, key: c.jiraKey, planned: rels.length, members: after.size, unexpected });
      saveMap(map);
      await sleep(PACE_MS);
    }
  }
  saveMap(map);
}

async function verify() {
  const map = loadMap();
  const byId = Object.fromEntries(Object.values(map.entities).filter((e) => e.jiraId).map((e) => [e.jiraId, e]));
  const planById = Object.fromEntries(plan.entities.map((e) => [e.localId, e]));
  // Tests: one getTest per mapped Test (Xray's search resolvers fail on this site; see loadIndex).
  const seen = {};
  for (const e of Object.values(map.entities).filter((x) => x.type === 'test' && x.jiraId && (!only || only.has(x.localId)))) {
    const data = await graphql(
      `query ($id: String) { getTest(issueId: $id) {
        issueId testType { name } steps { id } jira(fields: ["key", "summary"])
        coverableIssues(limit: 100) { total results { issueId } } } }`,
      { id: e.jiraId },
      { retry: true },
    );
    if (data.getTest) seen[e.jiraId] = data.getTest;
    await sleep(PACE_MS / 2);
  }
  // Orphans (Tests in Jira but not in the map) come from the MCP index.
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  for (const r of index.filter((x) => x.issuetype === 'Test' && !byId[String(x.id)])) seen[String(r.id)] = { issueId: String(r.id), jira: { key: r.key, summary: r.summary } };
  const coverage = {};
  for (const e of Object.values(map.entities).filter((x) => x.type === 'test' && x.jiraId && (!only || only.has(x.localId)))) {
    const t = seen[e.jiraId];
    const p = planById[e.localId];
    const problems = [];
    if (!t) problems.push('not returned by Xray getTests');
    else {
      if (t.jira.key !== e.jiraKey) problems.push(`key ${t.jira.key} != mapped ${e.jiraKey}`);
      if (!t.jira.summary.startsWith(`${e.localId} `)) problems.push('summary does not start with local ID');
      if (t.testType?.name !== p.xray.testType) problems.push(`test type ${t.testType?.name} != ${p.xray.testType}`);
      if (t.steps.length !== p.xray.steps.length) problems.push(`steps ${t.steps.length} != ${p.xray.steps.length}`);
      coverage[e.localId] = t.coverableIssues.results.map((c) => byId[c.issueId]?.localId ?? `id:${c.issueId}`);
      e.xray = { ...e.xray, testType: t.testType?.name ?? null, stepsCount: t.steps.length, definitionStatus: 'set' };
    }
    Object.assign(e, { verificationStatus: problems.length ? 'FAIL' : 'PASS', verifiedAt: now(), lastError: problems.length ? problems.join('; ') : e.lastError });
  }
  const orphans = Object.values(seen).filter((t) => !byId[t.issueId]).map((t) => `${t.jira.key} ${t.jira.summary}`);
  // Coverage links as Xray sees them (authoritative for testCoversRequirement / testCoversRisk).
  for (const r of map.relationships.filter((x) => ['testCoversRequirement', 'testCoversRisk'].includes(x.relationshipKey) && DONE.has(x.creationStatus) && coverage[x.from])) {
    const ok = coverage[r.from]?.includes(r.to);
    Object.assign(r, { verificationStatus: ok ? 'PASS' : 'FAIL', verifiedAt: now(), lastError: ok ? null : `Xray coverableIssues of ${r.from} does not contain ${r.to}` });
  }
  saveMap(map);
  const tests = Object.values(map.entities).filter((x) => x.type === 'test');
  log.push({
    testsVerified: tests.filter((x) => x.verificationStatus === 'PASS').length,
    testsFailed: tests.filter((x) => x.verificationStatus === 'FAIL').map((x) => `${x.localId}: ${x.lastError}`),
    orphanTests: orphans,
    coverageFail: map.relationships.filter((x) => x.verificationStatus === 'FAIL' && x.relationshipKey?.startsWith('testCovers')).map((x) => `${x.from}->${x.to}`),
  });
}

/**
 * Completes the Xray definition of Tests that exist in Jira without steps (e.g. created through MCP while Xray could
 * not access the project): sets the planned test type and adds the planned steps. Only touches a Test with 0 steps.
 */
async function definitions() {
  const map = loadMap();
  for (const e of plan.entities.filter((x) => x.type === 'test' && (!only || only.has(x.localId)))) {
    const m = map.entities[e.localId];
    if (!m.jiraId || !DONE.has(m.creationStatus)) continue;
    const data = await graphql(`query ($id: String) { getTest(issueId: $id) { testType { name } steps { id } } }`, { id: m.jiraId }, { retry: true });
    const t = data.getTest;
    if (!t) {
      log.push({ localId: e.localId, outcome: 'not-visible-in-xray' });
      continue;
    }
    if (t.steps.length > 0) continue;
    if (dryRun) {
      log.push({ localId: e.localId, outcome: 'would-set-definition', steps: e.xray.steps.length });
      continue;
    }
    if (t.testType?.name !== e.xray.testType) {
      await graphql(`mutation ($id: String!, $tt: UpdateTestTypeInput!) { updateTestType(issueId: $id, testType: $tt) { issueId } }`, { id: m.jiraId, tt: { name: e.xray.testType } });
    }
    for (const s of e.xray.steps) {
      await graphql(
        `mutation ($id: String!, $step: CreateStepInput!) { addTestStep(issueId: $id, step: $step) { id } }`,
        { id: m.jiraId, step: { action: toWiki(s.action), ...(s.data ? { data: toWiki(s.data) } : {}), result: toWiki(s.result) } },
      );
      await sleep(PACE_MS);
    }
    m.xray = { ...m.xray, testType: e.xray.testType, definitionStatus: 'set', stepsCount: e.xray.steps.length };
    saveMap(map);
    log.push({ localId: e.localId, key: m.jiraKey, outcome: 'definition-set', steps: e.xray.steps.length });
  }
}

const commands = {
  definitions,
  tests: () => createEntities(['test']),
  containers: () => createEntities(['testSet', 'testPlan']),
  members,
  verify,
};
if (!commands[command]) {
  console.error(`Unknown command: ${command ?? '(none)'}. Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
try {
  await commands[command]();
  console.log(JSON.stringify({ command, dryRun, log }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ command, dryRun, log }, null, 2));
  console.error(redact(error.message));
  process.exit(1);
}
