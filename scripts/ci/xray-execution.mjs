// Records one CI test run in Xray and links it to its evidence (docs/ci-cd.md section 9). Run by the run-suite action.
//
//   import  After the tests: creates the run's Test Execution (or reuses it, found by its run label) with a
//           description naming workflow, run, attempt, commit, environment and outcome. With no test results
//           (a step before the tests failed) it still creates one, marked [NOT RUN], so the CI run stays reachable.
//           Writes reports/xray-execution.json and adds the key to the Allure environment, so the report names it.
//   link    After the artifacts are uploaded: adds Web links on that Test Execution to the CI run attempt and the
//           Allure / Playwright artifacts, then reads them back.
//
// Identity: label ci-<suite>-<runId>-<attempt>. A new attempt of the same run is a new Test Execution, so links of
// earlier runs and attempts are never overwritten; repeating a step finds the same issue (no duplicates).
// Never fails the job (the test step decides that): problems are ::error annotations and run-summary lines.
// Never writes error messages, request bodies or screenshots to Jira: only counts, names and links.
import fs from 'node:fs';
import path from 'node:path';
import { countTestcases, countUnkeyedTestcases, knownDefectsToXrayStatus } from '../xray/junit-for-xray.mjs';
import { graphql, importJunit, importJunitMultipart, redact } from '../xray/xray-client.mjs';
import { browseUrl, getIssue, getRemoteLinks, jiraConfigured, searchIssues, upsertRemoteLink } from '../xray/jira-client.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fromRoot = (file) => path.join(root, file);
const JUNIT = fromRoot('reports/xray-report.xml');
const RESULTS = fromRoot('reports/test-results.json');
const STATE = fromRoot('reports/xray-execution.json');
const ALLURE_ENV = fromRoot('reports/allure-results/environment.properties');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// ---------- run context ----------

/** Keeps a value only if it matches, so payload or branch text cannot inject markup (as write-trigger-summary.mjs). */
const safe = (value, pattern) => (pattern.test((value ?? '').trim()) ? value.trim() : '');

function runContext() {
  const e = process.env;
  const repoUrl = `${e.GITHUB_SERVER_URL}/${e.GITHUB_REPOSITORY}`;
  const runId = e.GITHUB_RUN_ID;
  const attempt = e.GITHUB_RUN_ATTEMPT || '1';
  const suiteId = safe(e.SUITE_ID, /^[a-z0-9-]{1,40}$/) || 'tests';
  const origin = (url) => { try { return new URL(url).origin; } catch { return ''; } };
  const retentionDays = Number(e.RETENTION_DAYS) || 14;
  return {
    repository: e.GITHUB_REPOSITORY,
    workflow: (e.GITHUB_WORKFLOW ?? 'workflow').replace(/[|[\]{}]/g, ''),
    event: e.GITHUB_EVENT_NAME ?? 'unknown',
    suiteTitle: (e.SUITE_TITLE ?? 'Tests').replace(/[|[\]{}]/g, ''),
    suiteId,
    runId,
    runNumber: e.GITHUB_RUN_NUMBER ?? '?',
    attempt,
    runUrl: `${repoUrl}/actions/runs/${runId}`,
    attemptUrl: `${repoUrl}/actions/runs/${runId}/attempts/${attempt}`,
    sha: e.GITHUB_SHA ?? '',
    commitUrl: `${repoUrl}/commit/${e.GITHUB_SHA}`,
    branch: safe(e.GITHUB_HEAD_REF || e.GITHUB_REF_NAME, /^[\w./-]{1,100}$/) || 'unknown',
    // A named environment (post-deployment payload or repository variable); otherwise the UI origin identifies it.
    environment: safe(e.PSMUSIC_ENVIRONMENT, /^[\w-]{1,40}$/),
    uiOrigin: origin(e.PSMUSIC_UI_URL),
    apiOrigin: origin(e.PSMUSIC_API_URL),
    appRepo: safe(e.APP_REPO, /^[\w.-]+\/[\w.-]+$/),
    appSha: safe(e.APP_SHA, /^[0-9a-f]{7,40}$/i),
    testPlan: safe(e.XRAY_TEST_PLAN, /^[A-Z0-9-]{1,40}$/),
    retentionDays,
    expiresOn: new Date(Date.now() + retentionDays * 86_400_000).toISOString().slice(0, 10),
    label: `ci-${suiteId}-${runId}-${attempt}`,
  };
}

const envLabel = (ctx) => ctx.environment || ctx.uiOrigin.replace(/^https?:\/\//, '') || 'unknown environment';

// ---------- output ----------

const summaryLines = [];
const say = (...lines) => summaryLines.push(...lines);
const annotate = (level, title, message) => console.log(`::${level} title=${title}::${redact(message)}`);

function flushSummary() {
  const text = `${summaryLines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  else console.log(text);
}

/** Adds lines to Allure's environment widget (Java properties: spaces in keys escaped). */
function addToAllureEnvironment(entries) {
  if (!fs.existsSync(path.dirname(ALLURE_ENV))) return;
  const lines = Object.entries(entries).map(([key, value]) => `${key.replace(/ /g, '\\ ')}=${value}`);
  fs.appendFileSync(ALLURE_ENV, `${fs.existsSync(ALLURE_ENV) ? '\n' : ''}${lines.join('\n')}\n`);
}

// ---------- import ----------

/** Playwright's own counts, or why there are none. Never the error text: it can echo URLs, bodies or tokens. */
function outcome() {
  if (!fs.existsSync(RESULTS)) {
    return { ran: false, text: 'Tests did not run: no test results were produced. A step before the test run failed (install, browser or configuration); see the CI run log.' };
  }
  const { stats, errors = [] } = readJson(RESULTS);
  const total = stats.expected + stats.unexpected + stats.flaky + stats.skipped;
  if (total === 0) {
    return { ran: false, text: `Tests did not run: the run stopped before the first test${errors.length ? ' (global setup or configuration error)' : ''}; see the CI run log.` };
  }
  return {
    ran: true,
    text: `${total} tests: ${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, ${stats.skipped} skipped (Playwright counts; a reproduced known defect counts as passed here and FAILED in Xray).`,
  };
}

/** Test Plan key for a plan local ID (e.g. PLAN-REGRESSION) from issue-map.json: reuses the existing plan. */
function testPlanKey(localId) {
  if (!localId) return undefined;
  // issue-map.json `entities` is keyed by local ID (issue-map.mjs).
  const entity = readJson(fromRoot('test-management/state/issue-map.json')).entities[localId];
  if (entity?.type !== 'testPlan' || !entity.jiraKey) throw new Error(`Test Plan ${localId} has no Jira key in test-management/state/issue-map.json`);
  return entity.jiraKey;
}

/** Jira wiki markup (the format Xray's `jira` fields use, see sync-xray.mjs). Values are pre-sanitized. */
function description(ctx, result) {
  const rows = [
    ['Suite', `${ctx.suiteTitle} (${ctx.suiteId})`],
    ['Workflow', `${ctx.workflow} (trigger: ${ctx.event})`],
    ['CI run', `[run ${ctx.runNumber}, attempt ${ctx.attempt}|${ctx.attemptUrl}] (run ID ${ctx.runId})`],
    ['Automation commit', `[${ctx.sha.slice(0, 7)}|${ctx.commitUrl}] on branch ${ctx.branch}`],
    ['Environment', `${ctx.environment || 'not named'}: UI ${ctx.uiOrigin || 'not set'}, API ${ctx.apiOrigin || 'not set'}`],
  ];
  if (ctx.appSha) rows.push(['Deployed application', `${ctx.appRepo || 'unknown repository'} @ ${ctx.appSha.slice(0, 7)} (from the deployment trigger)`]);
  rows.push(['Result', result.text]);
  return [
    'h3. CI run',
    '||Field||Value||',
    ...rows.map(([field, value]) => `|${field}|${value}|`),
    '',
    'h3. Reports',
    'See *Web links* on this issue: the CI run, the Allure report and the Playwright report of this exact run attempt.',
    `* The reports are GitHub Actions artifacts kept *${ctx.retentionDays} days (until about ${ctx.expiresOn})*; after that their links return "not found". The CI run page stays as long as the repository's log retention (GitHub default 90 days).`,
    `* Opening them requires a GitHub account with read access to ${ctx.repository}.`,
    '* Created by scripts/ci/xray-execution.mjs. Do not edit the label: it identifies the run.',
  ].join('\n');
}

async function findExecution(projectKey, label) {
  const found = await searchIssues(`project = "${projectKey}" AND issuetype = "Test Execution" AND labels = "${label}"`, ['summary']);
  if (found.length > 1) throw new Error(`${found.length} Test Executions carry label ${label} (${found.map((x) => x.key).join(', ')}): resolve by hand`);
  return found[0];
}

/** Every Test in the import is in the execution (xray-cloud-rest-api.md §6.4: never trust the HTTP 200 alone). */
async function verifyRuns(issueId, xml) {
  const keys = new Set([...xml.matchAll(/name="test_key" value="([^"]+)"/g)].map((m) => m[1]));
  const data = await graphql(
    `query ($id: String) { getTestExecution(issueId: $id) { testRuns(limit: 100) { total results { test { jira(fields: ["key"]) } } } } }`,
    { id: issueId },
    { retry: true },
  );
  const runs = new Set(data.getTestExecution.testRuns.results.map((r) => r.test.jira.key));
  const missing = [...keys].filter((key) => !runs.has(key));
  return { expected: keys.size, actual: data.getTestExecution.testRuns.total, missing };
}

async function importRun() {
  const ctx = runContext();
  const state = { label: ctx.label, runUrl: ctx.attemptUrl, sha: ctx.sha, environment: envLabel(ctx) };
  const save = (fields) => fs.writeFileSync(STATE, JSON.stringify({ ...state, ...fields }, null, 2));
  fs.rmSync(STATE, { force: true });
  say(`### Xray Test Execution (${ctx.suiteTitle})`, '');

  if (!process.env.GITHUB_RUN_ID) throw new Error('Not a GitHub Actions run (GITHUB_RUN_ID is not set)');
  if (!process.env.XRAY_CLIENT_ID || !process.env.XRAY_CLIENT_SECRET || !jiraConfigured()) {
    save({ status: 'skipped' });
    annotate('warning', 'Xray import skipped', 'XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, JIRA_USER_EMAIL, JIRA_API_TOKEN or ATLASSIAN_SITE_URL is not configured (docs/ci-cd.md section 9).');
    say('⚠️ Skipped: Xray / Jira credentials are not configured for this workflow, so no Test Execution was created.');
    addToAllureEnvironment({ 'Xray Test Execution': 'not created (credentials not configured)' });
    return;
  }

  const projectMap = readJson(fromRoot('test-management/config/project-map.json'));
  const projectKey = process.env.JIRA_PROJECT_KEY || projectMap.jira.projectKey;
  if (projectKey !== projectMap.jira.projectKey) throw new Error(`JIRA_PROJECT_KEY ${projectKey} differs from project-map.json (${projectMap.jira.projectKey})`);

  const rawXml = fs.existsSync(JUNIT) ? fs.readFileSync(JUNIT, 'utf8') : '';
  const testcases = countTestcases(rawXml);
  const result = outcome();
  const ran = testcases > 0;
  if (ran && countUnkeyedTestcases(rawXml) > 0) {
    throw new Error(`${countUnkeyedTestcases(rawXml)} testcase(s) have no test_key: importing would create new Generic Tests (run npm run xray:keys)`);
  }

  const planKey = ran ? testPlanKey(ctx.testPlan) : undefined;
  const summary = `${ran ? '' : '[NOT RUN] '}${ctx.suiteTitle} · ${ctx.workflow} run ${ctx.runNumber} attempt ${ctx.attempt} · ${ctx.sha.slice(0, 7)} · ${envLabel(ctx)}`.slice(0, 250);
  const fields = {
    project: { key: projectKey },
    issuetype: { id: projectMap.issueTypes.testExecution.id },
    summary,
    description: description(ctx, result),
    labels: [ctx.label],
  };
  const environments = ctx.environment ? [ctx.environment] : [];

  let execution = await findExecution(projectKey, ctx.label);
  const reused = Boolean(execution);
  const { xml, changes } = knownDefectsToXrayStatus(rawXml);
  if (changes.length) console.log(`known-defect status changes: ${JSON.stringify(changes)}`);

  if (ran && reused) {
    await importJunit(xml, { projectKey, testExecKey: execution.key, testPlanKey: planKey });
  } else if (ran) {
    execution = await importJunitMultipart(xml, { fields, xrayFields: { ...(planKey ? { testPlanKey: planKey } : {}), ...(environments.length ? { environments } : {}) } });
  } else if (!reused) {
    const data = await graphql(
      `mutation ($env: [String], $jira: JSON!) { createTestExecution(testIssueIds: [], testEnvironments: $env, jira: $jira) {
        testExecution { issueId jira(fields: ["key"]) } warnings } }`,
      { env: environments, jira: { fields } },
    );
    const created = data.createTestExecution.testExecution;
    execution = { id: created.issueId, key: created.jira.key };
  }

  // Read back: right type, carries the run label, and (with results) holds a run for every imported Test.
  const issue = await getIssue(execution.key, ['summary', 'labels', 'issuetype']);
  const problems = [];
  if (issue.fields.issuetype.name !== 'Test Execution') problems.push(`issue type is ${issue.fields.issuetype.name}`);
  if (!issue.fields.labels.includes(ctx.label)) problems.push(`label ${ctx.label} is missing`);
  let runs;
  if (ran) {
    runs = await verifyRuns(issue.id, xml);
    if (runs.missing.length) problems.push(`no test run for ${runs.missing.join(', ')}`);
  }

  const url = browseUrl(execution.key);
  save({ status: ran ? 'imported' : 'not-run', key: execution.key, id: issue.id, url, reused, testcases, testPlanKey: planKey ?? null, verified: problems.length === 0 });
  addToAllureEnvironment({ 'Xray Test Execution': `${execution.key} (${url})` });

  say(`${ran ? '✅' : '⚠️'} [${execution.key}](${url}): ${ran ? `${testcases} results imported` : '**tests did not run**, execution created to keep this CI run on record'}${reused ? ' (existing execution for this run attempt reused)' : ''}.`);
  if (planKey) say(`Test Plan: ${planKey}.`);
  if (runs) say(`Test runs: ${runs.actual} (expected ${runs.expected}).`);
  if (problems.length) {
    annotate('error', 'Xray read-back failed', `${execution.key}: ${problems.join('; ')}`);
    say(`❌ Read-back: ${problems.join('; ')}.`);
  }
}

// ---------- link ----------

async function linkRun() {
  const ctx = runContext();
  say(`#### Web links on the Test Execution (${ctx.suiteTitle})`, '');
  const state = fs.existsSync(STATE) ? readJson(STATE) : { status: 'failed' };
  if (!state.key) {
    if (state.status !== 'skipped') annotate('error', 'Xray links not added', 'No Test Execution was created for this run (see the import step).');
    say(state.status === 'skipped' ? 'Skipped: no Test Execution (credentials not configured).' : '❌ Not added: no Test Execution was created for this run (see the import step log).');
    return;
  }

  const expiry = `artifact kept ${ctx.retentionDays} days, until about ${ctx.expiresOn}; needs GitHub read access to ${ctx.repository}`;
  const runFacts = `commit ${ctx.sha.slice(0, 7)} · branch ${ctx.branch} · ${envLabel(ctx)}`;
  const link = (kind, relationship, url, title, summary) => ({
    globalId: `${ctx.label}:${kind}`,
    application: { type: 'com.github.actions', name: 'GitHub Actions' },
    relationship,
    object: { url, title: title.slice(0, 250), summary: summary.slice(0, 250) },
  });
  const notAvailable = state.status === 'not-run' ? 'not produced: tests did not run' : 'not available: the upload failed, see the CI run';
  const { ALLURE_ARTIFACT_URL: allure, PLAYWRIGHT_ARTIFACT_URL: playwright } = process.env;
  // The artifact can hold raw results only, when `allure generate` failed.
  const reportBuilt = fs.existsSync(fromRoot('reports/allure-report/index.html'));
  const runTitle = `run ${ctx.runNumber} attempt ${ctx.attempt}`;
  const links = [
    link('ci-run', 'CI run', ctx.attemptUrl, `GitHub Actions: ${ctx.workflow} ${runTitle}${state.status === 'not-run' ? ' (TESTS DID NOT RUN)' : ''}`, `${runFacts}. Run page kept per the repository's log retention.`),
    allure && reportBuilt
      ? link('allure', 'Allure report', allure, `Allure report: ${ctx.suiteTitle}, ${runTitle}`, `Download, unzip, open allure-report/index.html. ${expiry}.`)
      : allure
        ? link('allure', 'Allure report', allure, `Allure results only (report generation failed): ${runTitle}`, `Run "npx allure generate" on allure-results. ${expiry}.`)
        : link('allure', 'Allure report', ctx.attemptUrl, `Allure report ${notAvailable}`, runFacts),
  ];
  if (playwright) {
    links.push(link('playwright', 'Playwright report', playwright, `Playwright report, failure screenshots and JUnit: run ${ctx.runNumber} attempt ${ctx.attempt}`, `${expiry}.`));
  }

  const failures = [];
  for (const item of links) {
    try {
      await upsertRemoteLink(state.key, item);
    } catch (error) {
      failures.push(`${item.relationship}: ${error.message}`);
    }
  }
  // Read back by globalId (or URL + title, should the API omit globalId).
  const existing = await getRemoteLinks(state.key);
  say('| Link | Target | Verified |', '|---|---|---|');
  for (const item of links) {
    const found = existing.find((x) => x.globalId === item.globalId) ?? existing.find((x) => x.object?.url === item.object.url && x.object?.title === item.object.title);
    const ok = found?.object?.url === item.object.url;
    if (!ok) failures.push(`${item.relationship}: not found on read-back`);
    say(`| ${item.object.title} | [open](${item.object.url}) | ${ok ? '✅' : '❌'} |`);
  }
  say('', `On [${state.key}](${state.url}): *Web links* section of the issue.`);
  if (failures.length) annotate('error', 'Xray links incomplete', `${state.key}: ${[...new Set(failures)].join('; ')}`);
}

// ---------- main ----------

const commands = { import: importRun, link: linkRun };
const command = commands[process.argv[2]];
if (!command) {
  console.error(`Usage: node scripts/ci/xray-execution.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
try {
  await command();
} catch (error) {
  annotate('error', `Xray ${process.argv[2]} failed`, error.message);
  say(`❌ ${process.argv[2]} failed: ${redact(error.message)}`);
  if (process.argv[2] === 'import' && !fs.existsSync(STATE)) {
    fs.writeFileSync(STATE, JSON.stringify({ status: 'failed' }));
    addToAllureEnvironment({ 'Xray Test Execution': 'not created (import failed, see the CI run)' });
  }
}
flushSummary();
