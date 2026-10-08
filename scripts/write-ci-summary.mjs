// Turns Playwright's JSON report (test-results.json) into a Markdown summary.
// In GitHub Actions it is appended to the run page ($GITHUB_STEP_SUMMARY);
// locally it is printed. Usage: node scripts/write-ci-summary.mjs "Smoke tests"
// It never fails: the test step already decides whether the job is red.
import fs from 'node:fs';

const suiteName = process.argv[2] ?? 'Tests';
const reportFile = 'test-results.json';
const MAX_ERROR_LENGTH = 1500;

/** Removes terminal colors and masks JWTs (access and refresh tokens) that an assertion may print. */
function clean(text) {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<redacted-jwt>');
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function firstError(test) {
  const failed = test.results.find((result) => result.error);
  if (!failed) return '';
  const message = clean(failed.error.message ?? '').trim();
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}\n…` : message;
}

/** Every test in the report with its file, line and full title (describe blocks included). */
function collectTests(suites, parentTitles = [], isFileLevel = true) {
  const tests = [];
  for (const suite of suites ?? []) {
    // Top-level suites are spec files; the file is already shown as the location.
    const titles = isFileLevel ? parentTitles : [...parentTitles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        tests.push({ title: [...titles, spec.title].join(' › '), location: `${spec.file}:${spec.line}`, test });
      }
    }
    tests.push(...collectTests(suite.suites, titles, false));
  }
  return tests;
}

/** Annotations set before the run (test.annotations) and at runtime, e.g. knownDefect() (results[].annotations). */
function annotationsOf(test) {
  return [...(test.annotations ?? []), ...test.results.flatMap((result) => result.annotations ?? [])];
}

function buildSummary() {
  if (!fs.existsSync(reportFile)) {
    return `## ⚠️ ${suiteName}: no results\n\n\`${reportFile}\` was not created, so the tests did not run. See the job log.\n`;
  }

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const { expected, unexpected, flaky, skipped, duration } = report.stats;
  const runErrors = report.errors ?? [];
  const failedRun = unexpected > 0 || runErrors.length > 0;
  const tests = collectTests(report.suites);

  const lines = [
    `## ${failedRun ? '❌' : '✅'} ${suiteName}: ${failedRun ? 'failed' : 'passed'}`,
    '',
    '| Total | Passed | Failed | Flaky | Skipped | Duration |',
    '|---|---|---|---|---|---|',
    `| ${expected + unexpected + flaky + skipped} | ${expected} | ${unexpected} | ${flaky} | ${skipped} | ${formatDuration(duration)} |`,
    '',
  ];

  // Errors outside a test, e.g. global setup could not reach PSMusic.
  if (runErrors.length > 0) {
    lines.push('### Run errors', '');
    for (const error of runErrors) {
      lines.push('```', clean(error.message ?? '').trim(), '```', '');
    }
  }

  const failed = tests.filter(({ test }) => test.status === 'unexpected');
  if (failed.length > 0) {
    lines.push('### Failed tests', '');
    for (const { title, location, test } of failed) {
      lines.push(`<details><summary>❌ <b>${title}</b> (<code>${location}</code>)</summary>`, '', '```', firstError(test), '```', '</details>', '');
    }
  }

  const flakyTests = tests.filter(({ test }) => test.status === 'flaky');
  if (flakyTests.length > 0) {
    lines.push('### Flaky tests (failed first, passed on retry)', '');
    for (const { title, location, test } of flakyTests) {
      lines.push(`<details><summary>⚠️ <b>${title}</b> (<code>${location}</code>)</summary>`, '', 'First attempt failed with:', '', '```', firstError(test), '```', '</details>', '');
    }
  }

  const knownDefects = tests
    .map((entry) => ({ ...entry, defect: annotationsOf(entry.test).find((annotation) => annotation.type === 'known-defect') }))
    .filter(({ defect }) => defect);
  if (knownDefects.length > 0) {
    lines.push('### Known defects (expected to fail)', '');
    for (const { title, defect } of knownDefects) {
      lines.push(`- ${title}: ${defect.description}`);
    }
    lines.push('');
  }

  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  const artifacts = GITHUB_RUN_ID ? `[artifacts](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}#artifacts)` : 'artifacts';
  lines.push(`Screenshots, steps and the full Allure report are in the ${artifacts} (\`allure-*\`, \`playwright-*\`).`, '');
  return lines.join('\n');
}

let summary;
try {
  summary = buildSummary();
} catch (error) {
  summary = `## ⚠️ ${suiteName}: summary could not be built\n\n${error.message}\n`;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  console.log(summary);
}
