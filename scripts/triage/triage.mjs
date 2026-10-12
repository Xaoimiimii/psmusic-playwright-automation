// Failure triage, report-only (docs/failure-triage.md). Reads the run's reports, classifies every failed test with
// the evidence the framework recorded, matches recorded Bugs by stable identifiers, and writes:
//   reports/triage.json  machine-readable records (raw outcome kept separate from the classification)
//   reports/triage.md    the same for people; also appended to the GitHub run summary
// Makes no Jira or Xray call and never changes a report. Never fails the job.
//
// Usage: node scripts/triage/triage.mjs [--report reports/test-results.json] [--allure reports/allure-results]
//                                       [--out reports] [--plan …/plan.json] [--issue-map …/issue-map.json]
import fs from 'node:fs';
import path from 'node:path';
import { buildBugIndex, matchBugs } from './bug-index.mjs';
import { classify, classifyRun, fingerprint, recommend } from './classify.mjs';
import { collectOutcomes, collectRunErrors } from './collect.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
const fromRoot = (file) => path.resolve(root, file);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonIfPresent = (file) => (fs.existsSync(file) ? readJson(file) : null);

const files = {
  report: fromRoot(args.report ?? 'reports/test-results.json'),
  allure: fromRoot(args.allure ?? 'reports/allure-results'),
  out: fromRoot(args.out ?? 'reports'),
  plan: fromRoot(args.plan ?? 'test-management/state/plan.json'),
  issueMap: fromRoot(args['issue-map'] ?? 'test-management/state/issue-map.json'),
  triageMap: fromRoot(args['triage-map'] ?? 'test-management/state/triage-map.json'),
  execution: fromRoot('reports/xray-execution.json'),
};

function runContext() {
  const e = process.env;
  const suiteId = e.SUITE_ID || 'local';
  const inCi = Boolean(e.GITHUB_RUN_ID);
  const runUrl = inCi ? `${e.GITHUB_SERVER_URL}/${e.GITHUB_REPOSITORY}/actions/runs/${e.GITHUB_RUN_ID}/attempts/${e.GITHUB_RUN_ATTEMPT || '1'}` : null;
  const execution = readJsonIfPresent(files.execution);
  return {
    suite: e.SUITE_TITLE || 'Local run',
    workflow: e.GITHUB_WORKFLOW ?? null,
    runUrl,
    commit: e.GITHUB_SHA ?? null,
    environment: e.PSMUSIC_ENVIRONMENT || (e.PSMUSIC_UI_URL ? new URL(e.PSMUSIC_UI_URL).host : null),
    artifacts: inCi ? [`allure-${suiteId}`, `playwright-${suiteId}`] : ['reports/allure-report/index.html', 'reports/playwright-report/'],
    testExecution: execution?.key ? { key: execution.key, url: execution.url } : null,
    jiraSite: e.ATLASSIAN_SITE_URL?.replace(/\/+$/, '') || null,
  };
}

function build() {
  const report = readJsonIfPresent(files.report);
  // A results directory (a run), or one JSON array of results (a test fixture).
  const allureResults = !fs.existsSync(files.allure)
    ? []
    : fs.statSync(files.allure).isDirectory()
      ? fs.readdirSync(files.allure).filter((f) => f.endsWith('-result.json')).map((f) => readJson(path.join(files.allure, f)))
      : readJson(files.allure);
  const secrets = [process.env.PSMUSIC_SERVICE_KEY, process.env.JIRA_API_TOKEN, process.env.XRAY_CLIENT_SECRET, process.env.XRAY_CLIENT_ID];
  const index = buildBugIndex(readJson(files.plan), readJsonIfPresent(files.issueMap), readJsonIfPresent(files.triageMap));
  const context = runContext();
  const link = (key) => (key && context.jiraSite ? `${context.jiraSite}/browse/${key}` : null);

  const outcomes = report ? collectOutcomes(report, allureResults, { rootDir: root, secrets }) : [];
  const records = outcomes.map((collected) => {
    const outcome = { ...collected, fingerprint: fingerprint(collected) };
    const bugMatch = matchBugs(outcome, index);
    const classification = classify(outcome, bugMatch);
    return {
      ...outcome,
      classification,
      bugMatch: {
        match: bugMatch.match,
        bugs: bugMatch.bugs.map(({ id, jiraKey, relation, provenance, summary }) => ({ id, jiraKey, relation, provenance, summary, url: link(jiraKey) })),
      },
      recommendation: recommend(classification, bugMatch),
      links: {
        xrayTest: link(outcome.xrayTestKey),
        testExecution: context.testExecution?.url ?? null,
        ciRun: context.runUrl,
        reports: context.artifacts,
      },
    };
  });
  const runErrors = collectRunErrors(report, { secrets });

  // Repeated failures of one cause in this run: same fingerprint, or the same exact Bug.
  const groups = {};
  for (const record of records) {
    const exact = record.bugMatch.bugs.find((b) => b.relation === 'known-defect');
    const key = exact ? `bug:${exact.id}` : `fingerprint:${record.fingerprint}`;
    (groups[key] ??= []).push(record.id);
  }

  const failures = records.filter((r) => !r.classification.notice);
  const counts = Object.fromEntries(['PRODUCT_DEFECT', 'TEST_DEFECT', 'INFRASTRUCTURE_FAILURE', 'FLAKY_OR_INCONCLUSIVE', 'UNKNOWN'].map((c) => [c, failures.filter((r) => r.classification.category === c).length]));
  return {
    schemaVersion: 1,
    mode: 'report-only',
    generatedAt: new Date().toISOString(),
    run: context,
    runErrors,
    runClassification: classifyRun(runErrors, report),
    counts,
    reviewRequired: records.filter((r) => r.classification.reviewRequired).length,
    failures,
    notices: records.filter((r) => r.classification.notice),
    groups: Object.entries(groups).filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, tests: ids })),
  };
}

// ---------- Markdown ----------

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const fence = (text) => ['```', String(text).replace(/```/g, "'''"), '```'];

function markdown(triage) {
  const { run, counts } = triage;
  const lines = [`## Failure triage (report-only): ${run.suite}`, ''];
  lines.push('Classification is decision support, not a verdict: only a reproduced known defect is *confirmed*. Nothing was written to Jira. Rules: `docs/failure-triage.md`.', '');
  if (triage.runClassification) {
    lines.push(`**Run:** ${triage.runClassification.category} (${triage.runClassification.confidence}): ${triage.runClassification.reasons.join('; ')}.`, '');
    for (const error of triage.runErrors) lines.push(...fence(error.message), '');
  }
  if (triage.failures.length === 0 && triage.notices.length === 0) {
    lines.push(triage.runClassification ? '' : 'No failed test.', '');
    return lines.join('\n');
  }
  lines.push(Object.entries(counts).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(' · ') + ` · review required: ${triage.reviewRequired}`, '');
  lines.push('| Test | Xray | Raw → Xray | Category | Recorded Bug | Recommendation |', '|---|---|---|---|---|---|');
  for (const r of [...triage.failures, ...triage.notices]) {
    const bug = r.bugMatch.bugs[0];
    const bugText = bug ? `${bug.jiraKey ?? bug.id} (${bug.relation})${r.bugMatch.bugs.length > 1 ? ` +${r.bugMatch.bugs.length - 1}` : ''}` : '—';
    lines.push(`| ${cell(r.titlePath.join(' › '))} | ${r.xrayTestKey ?? '—'} | ${r.raw.playwrightStatus} (${r.raw.attempts.join(', ')}) → ${r.xrayStatus} | ${r.classification.category} (${r.classification.confidence}) | ${cell(bugText)} | ${cell(r.recommendation.text)} |`);
  }
  lines.push('');
  for (const r of [...triage.failures, ...triage.notices]) {
    const attempt = r.attempts.find((a) => a.error) ?? r.attempts[0];
    lines.push(`<details><summary><b>${cell(r.titlePath.join(' › '))}</b>: ${r.classification.category} (${r.classification.confidence})</summary>`, '');
    lines.push(`- Location: \`${r.location}\` · scenario ${r.scenarioId ?? '—'} · Xray Test ${r.xrayTestKey ?? '—'} · fingerprint \`${r.fingerprint}\``);
    lines.push(`- Attempts: ${r.attempts.map((a) => `#${a.retry + 1} ${a.status} ${Math.round(a.durationMs / 100) / 10}s`).join(', ')}`);
    lines.push(`- Failing step: ${attempt?.failedStep ?? '—'}`);
    lines.push(`- Signals: ${[...new Set(r.attempts.flatMap((a) => a.signals))].join(', ') || 'none recorded'}`);
    for (const [signal, details] of Object.entries(attempt?.signalDetails ?? {})) lines.push(`  - ${signal}: ${details.slice(0, 3).join('; ')}`);
    lines.push(`- Why: ${r.classification.reasons.join('; ')}`);
    if (r.classification.evidenceMissing.length) lines.push(`- Evidence missing: ${r.classification.evidenceMissing.join('; ')}`);
    for (const bug of r.bugMatch.bugs) lines.push(`- Bug ${bug.jiraKey ?? bug.id} ${bug.id} (${bug.relation}${bug.provenance.length ? `; ${bug.provenance.join(', ')}` : ''}): ${cell(bug.summary)}`);
    const links = [r.links.ciRun && `[CI run](${r.links.ciRun})`, r.links.testExecution && `[Test Execution](${r.links.testExecution})`, r.links.xrayTest && `[Xray Test](${r.links.xrayTest})`].filter(Boolean);
    lines.push(`- Evidence: ${[...links, `reports: ${r.links.reports.join(', ')}`].join(' · ')}`);
    if (attempt?.error) lines.push('', ...fence(attempt.error.message.split('\n').slice(0, 12).join('\n')));
    lines.push('', '</details>', '');
  }
  if (triage.groups.length) {
    lines.push('**Same cause in this run:**', ...triage.groups.map((g) => `- ${g.key}: ${g.tests.length} tests`), '');
  }
  return lines.join('\n');
}

// ---------- main ----------

try {
  const triage = build();
  fs.mkdirSync(files.out, { recursive: true });
  fs.writeFileSync(path.join(files.out, 'triage.json'), JSON.stringify(triage, null, 2));
  const text = markdown(triage);
  fs.writeFileSync(path.join(files.out, 'triage.md'), text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  else console.log(text);
} catch (error) {
  // Triage must never hide or replace the test result: report the problem and leave the job status alone.
  console.log(`::warning title=Failure triage failed::${String(error.message).split('\n')[0]}`);
}
