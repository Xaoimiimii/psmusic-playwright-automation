import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { buildBugIndex, matchBugs } from '../scripts/triage/bug-index.mjs';
import { classify, classifyRun, fingerprint, recommend } from '../scripts/triage/classify.mjs';
import { collectOutcomes, collectRunErrors, errorShape, redact } from '../scripts/triage/collect.mjs';

// Fixtures (docs/failure-triage.md §6):
// - fixtures/deployed-run: a real CI-mode run against the deployed environment on 2026-10-12 (auth, profile, song),
//   reduced to the failing and known-defect tests; paths and test user names replaced, screenshots removed.
// - the outcomes built below are synthetic, one per rule, for cases that real run did not contain.
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(__dirname, 'fixtures/deployed-run');
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const realReport = readJson(path.join(fixtureDir, 'test-results.json'));
const realAllure = readJson(path.join(fixtureDir, 'allure-results.json'));
const index = buildBugIndex(readJson(path.join(root, 'test-management/state/plan.json')), readJson(path.join(root, 'test-management/state/issue-map.json')));

type Attempt = { status?: string; message?: string; step?: string; signals?: string[]; frame?: string; signalsRead?: boolean };

/** A synthetic outcome in the shape collectOutcomes() returns. */
function outcome(attempts: Attempt[], extra: Record<string, unknown> = {}) {
  const built = attempts.map((a, retry) => ({
    retry,
    status: a.status ?? 'failed',
    durationMs: 1000,
    failedStep: a.step ?? 'Open the page',
    error: a.message === undefined ? null : {
      message: a.message,
      shape: errorShape(a.message),
      signature: a.message.split('\n')[0],
      location: 'tests/x.spec.ts:1',
      topFrames: [a.frame ?? 'tests/x.spec.ts:1:1'],
      topFrameOrigin: a.frame?.includes('node_modules') ? 'library' : a.frame?.startsWith('src/') ? 'framework-code' : 'test-code',
    },
    signals: a.signals ?? [],
    signalDetails: {},
    signalsRead: a.signalsRead ?? true,
  }));
  const failedAll = built.every((a) => a.status === 'failed');
  return {
    id: 'x.spec.ts › TS-AUTH-01 synthetic',
    location: 'tests/x.spec.ts:1',
    titlePath: ['TS-AUTH-01 synthetic'],
    scenarioId: 'TS-AUTH-01',
    xrayTestKey: 'MSC-3',
    knownDefect: null,
    raw: { playwrightStatus: failedAll ? 'unexpected' : 'flaky', expectedStatus: 'passed', attempts: built.map((a) => a.status) },
    xrayStatus: 'FAILED',
    attempts: built,
    ...extra,
  };
}

const run = (o: ReturnType<typeof outcome>) => {
  const match = matchBugs(o, index);
  return { match, classification: classify(o, match), recommendation: recommend(classify(o, match), match) };
};

const MISMATCH = 'Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 403';
const NOT_FOUND = "Error: expect(locator).toHaveText(expected) failed\n\nLocator: locator('small')\nExpected: \"Login successful\"\nTimeout: 5000ms\nError: element(s) not found";

test.describe('classification', () => {
  test('a reproduced known defect is the only confirmed product defect, and reuses its Bug', () => {
    const o = outcome([{ message: MISMATCH }], { knownDefect: 'BUG-A-7', raw: { playwrightStatus: 'expected', expectedStatus: 'failed', attempts: ['failed'] } });
    const { classification, recommendation, match } = run(o);
    expect(classification).toMatchObject({ category: 'PRODUCT_DEFECT', confidence: 'confirmed', reviewRequired: false });
    expect(match.match).toBe('exact');
    expect(recommendation).toMatchObject({ action: 'reuse-existing-bug', bug: 'BUG-A-7' });
  });

  test('a consistent assertion failure with no environment signal is only a suspected product defect', () => {
    const { classification, recommendation } = run(outcome([{ message: MISMATCH }, { message: MISMATCH }]));
    expect(classification).toMatchObject({ category: 'PRODUCT_DEFECT', confidence: 'suspected', reviewRequired: true });
    expect(recommendation.action).not.toBe('reuse-existing-bug');
  });

  test('a timeout alone decides nothing', () => {
    const { classification } = run(outcome([{ message: NOT_FOUND }, { message: NOT_FOUND }]));
    expect(classification.category).toBe('UNKNOWN');
    expect(classification.reviewRequired).toBe(true);
  });

  test('a timeout with a slow API response in every attempt is a probable infrastructure failure, never a product defect', () => {
    const { classification, recommendation } = run(outcome([{ message: NOT_FOUND, signals: ['slow-response'] }, { message: NOT_FOUND, signals: ['slow-response'] }]));
    expect(classification).toMatchObject({ category: 'INFRASTRUCTURE_FAILURE', confidence: 'probable', reviewRequired: true });
    expect(recommendation.action).toBe('check-environment');
  });

  test('a slow response seen in one attempt only is noted, not used', () => {
    const { classification } = run(outcome([{ message: NOT_FOUND, signals: ['slow-response'] }, { message: NOT_FOUND }]));
    expect(classification.category).toBe('UNKNOWN');
    expect(classification.reasons.join()).toContain('some attempts only');
  });

  test('a network error is infrastructure unless the application returned a wrong value', () => {
    const wait = run(outcome([{ message: NOT_FOUND, signals: ['network-error'] }, { message: NOT_FOUND, signals: ['network-error'] }]));
    expect(wait.classification.category).toBe('INFRASTRUCTURE_FAILURE');
    const mismatch = run(outcome([{ message: MISMATCH, signals: ['network-error'] }, { message: MISMATCH, signals: ['network-error'] }]));
    expect(mismatch.classification.category).not.toBe('INFRASTRUCTURE_FAILURE');
  });

  test('an HTTP 5xx alone decides nothing', () => {
    const { classification } = run(outcome([{ message: MISMATCH, signals: ['backend-5xx'] }, { message: MISMATCH, signals: ['backend-5xx'] }]));
    expect(classification.category).toBe('UNKNOWN');
  });

  test('a script exception thrown from our own code is a probable test defect', () => {
    const message = "TypeError: Cannot read properties of undefined (reading 'id')";
    expect(run(outcome([{ message, frame: 'src/pages/song.page.ts:40:7' }, { message, frame: 'src/pages/song.page.ts:40:7' }])).classification).toMatchObject({ category: 'TEST_DEFECT', confidence: 'probable' });
    // The exception class alone is not enough: thrown from a library, it stays open.
    expect(run(outcome([{ message, frame: 'node_modules/x/index.js:1:1' }, { message, frame: 'node_modules/x/index.js:1:1' }])).classification.category).toBe('UNKNOWN');
  });

  test('failed then passed is flaky; failing differently each time is inconclusive', () => {
    expect(run(outcome([{ message: MISMATCH }, { status: 'passed' }])).classification.category).toBe('FLAKY_OR_INCONCLUSIVE');
    const differently = run(outcome([{ message: MISMATCH, step: 'Log in' }, { message: NOT_FOUND, step: 'Open Home' }]));
    expect(differently.classification.category).toBe('FLAKY_OR_INCONCLUSIVE');
  });

  test('a known defect that no longer reproduces asks for a fix check, and changes no Bug', () => {
    const o = outcome([{ status: 'passed' }], { knownDefect: 'BUG-A-7', raw: { playwrightStatus: 'unexpected', expectedStatus: 'failed', attempts: ['passed'] } });
    const { classification, recommendation } = run(o);
    expect(classification.notice).toBe('known-defect-not-reproduced');
    expect(recommendation.action).toBe('verify-fix');
  });
});

test.describe('missing evidence', () => {
  test('a failed attempt without an error stays unknown and says what is missing', () => {
    const { classification } = run(outcome([{}, {}]));
    expect(classification.category).toBe('UNKNOWN');
    expect(classification.evidenceMissing.join()).toContain('without an error message');
  });

  test('signals that could not be read are reported as missing, not as "no signal"', () => {
    const { classification } = run(outcome([{ message: MISMATCH, signalsRead: false }, { message: MISMATCH, signalsRead: false }]));
    expect(classification.evidenceMissing.join()).toContain('failure signals not available');
  });

  test('a single failed attempt is not enough to suspect a product defect', () => {
    expect(run(outcome([{ message: MISMATCH }])).classification.category).toBe('UNKNOWN');
  });

  test('a knownDefect() naming no recorded Bug is not confirmed', () => {
    const o = outcome([{ message: MISMATCH }], { knownDefect: 'BUG-DOES-NOT-EXIST', raw: { playwrightStatus: 'expected', expectedStatus: 'failed', attempts: ['failed'] } });
    const { classification, match } = run(o);
    expect(classification.category).toBe('UNKNOWN');
    expect(match.missing.join()).toContain('names no Bug');
  });

  test('a test without a scenario ID gets no Bug candidates, and says why', () => {
    const { match } = run(outcome([{ message: MISMATCH }, { message: MISMATCH }], { scenarioId: null }));
    expect(match).toMatchObject({ match: 'none', bugs: [] });
    expect(match.missing.join()).toContain('names no scenario');
  });

  test('no report at all: the run stopped before the tests; not attributed to the product', () => {
    const errors = collectRunErrors(null);
    expect(errors[0].origin).toBe('no-report');
    expect(classifyRun(errors, null)?.category).toBe('UNKNOWN');
  });

  test('global set-up could not reach PSMusic and no test ran: probable infrastructure failure', () => {
    const report = { errors: [{ message: 'Error: PSMusic API is not reachable at https://api.example: ECONNREFUSED' }], stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };
    expect(classifyRun(collectRunErrors(report), report)).toMatchObject({ category: 'INFRASTRUCTURE_FAILURE', confidence: 'probable' });
  });
});

test.describe('duplicate detection', () => {
  test('Bugs are matched by recorded relationships, strongest first', () => {
    const { match } = run(outcome([{ message: MISMATCH }, { message: MISMATCH }], { scenarioId: 'TS-AUTH-10' }));
    expect(match.bugs.map((b: { id: string; relation: string }) => `${b.id}:${b.relation}`)).toEqual(['BUG-US-004-AC-01:detected-by-test', 'BUG-A-11:same-story']);
  });

  test('a scenario with no related Bug gets no candidate, whatever the error text says', () => {
    // The message quotes a recorded Bug's own words; titles and text are never used to match.
    const message = 'Error: Lands on /auth when logging out from /favorites\n\nExpected: "/"\nReceived: "/auth"';
    // TS-PLAY-01 (player) has no recorded Bug on its stories in plan.json.
    const { match } = run(outcome([{ message }, { message }], { scenarioId: 'TS-PLAY-01' }));
    expect(match.match).toBe('none');
  });

  test('repeated failures of one cause share a fingerprint, independent of user names and numbers', () => {
    const a = outcome([{ message: 'Error: user pwqa_abc not found after 5012 ms' }]);
    const b = outcome([{ message: 'Error: user pwqa_xyz not found after 4870 ms' }]);
    a.attempts[0].error!.signature = 'Error: user <value> not found after # ms';
    b.attempts[0].error!.signature = 'Error: user <value> not found after # ms';
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});

test.describe('evidence collection (real deployed run)', () => {
  const outcomes = collectOutcomes(realReport, realAllure, { rootDir: '/repo' });
  const byScenario = (id: string) => outcomes.filter((o: { scenarioId: string }) => o.scenarioId === id);

  test('collects failed and known-defect tests only, keeping the raw outcome next to the Xray status', () => {
    expect(outcomes.map((o: { scenarioId: string }) => o.scenarioId).sort()).toEqual(['TS-AUTH-08', 'TS-AUTH-10', 'TS-AUTH-11', 'TS-PROF-02', 'TS-SONG-06']);
    const [prof] = byScenario('TS-PROF-02');
    expect(prof.raw).toEqual({ playwrightStatus: 'expected', expectedStatus: 'failed', attempts: ['failed'] });
    expect(prof.xrayStatus).toBe('FAILED');
    expect(prof.knownDefect).toBe('BUG-US-023-AC-03');
  });

  test('a polled assertion that timed out with a received value is a mismatch, not a missing element', () => {
    const [logout] = byScenario('TS-AUTH-11');
    expect(logout.attempts.map((a: { error: { shape: string } }) => a.error.shape)).toEqual(['assertion-mismatch', 'assertion-mismatch']);
    expect(logout.attempts[0].failedStep).toBe('API: logout succeeds and the refresh cookie is deleted');
    expect(logout.location).toBe('tests/auth/logout.spec.ts:36');
  });

  test('error text is masked before it reaches a report', () => {
    expect(redact('Bearer abc.def password=hunter22 eyJa.eyJb.sig key s3cr3t-value', ['s3cr3t-value'])).toBe('Bearer <redacted> password=<redacted> <redacted> key <redacted>');
  });
});

test('end to end on the real run: report-only output, no Bug confirmed beyond known defects', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-'));
  execFileSync(process.execPath, [
    path.join(root, 'scripts/triage/triage.mjs'),
    '--report', path.join(fixtureDir, 'test-results.json'),
    '--allure', path.join(fixtureDir, 'allure-results.json'),
    '--out', out,
  ], { env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_RUN_ID: '' }, stdio: 'pipe' });
  const triage = readJson(path.join(out, 'triage.json'));
  expect(triage.mode).toBe('report-only');
  expect(triage.failures).toHaveLength(5);
  const confirmed = triage.failures.filter((f: { classification: { confidence: string } }) => f.classification.confidence === 'confirmed');
  expect(confirmed.map((f: { knownDefect: string }) => f.knownDefect).sort()).toEqual(['BUG-US-011-AC-06', 'BUG-US-023-AC-03']);
  expect(triage.failures.every((f: { recommendation: { action: string } }) => f.recommendation.action !== 'create-bug')).toBe(true);
  expect(fs.readFileSync(path.join(out, 'triage.md'), 'utf8')).toContain('Failure triage (report-only)');
});
