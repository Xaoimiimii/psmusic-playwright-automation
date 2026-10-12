// Classifies one triage outcome (collect.mjs) and recommends what a reviewer should do. Report-only: nothing here
// creates, edits or links a Jira issue (docs/failure-triage.md).
//
// Rules, in order. Each needs at least two independent facts; a timeout, an HTTP status, an exception class or a
// test name alone never decides a category. When the rules do not apply, the category is UNKNOWN.
// Confidence: confirmed (recorded fact, no review needed) > probable > suspected (review required).
import { createHash } from 'node:crypto';

export const CATEGORIES = ['PRODUCT_DEFECT', 'TEST_DEFECT', 'INFRASTRUCTURE_FAILURE', 'FLAKY_OR_INCONCLUSIVE', 'UNKNOWN'];

const result = (category, confidence, reasons, extra = {}) => ({
  category,
  confidence,
  reviewRequired: confidence !== 'confirmed',
  reasons,
  ...extra,
});

/** A signal present in every failed attempt (seen once only is noted, not used to decide). */
function consistentSignals(failed) {
  if (failed.length === 0) return [];
  return failed[0].signals.filter((signal) => failed.every((a) => a.signals.includes(signal)));
}

export function classify(outcome, bugMatch) {
  const failed = outcome.attempts.filter((a) => a.status !== 'passed' && a.status !== 'skipped');
  const missing = [];
  if (failed.some((a) => !a.error)) missing.push('an attempt failed without an error message');
  if (failed.some((a) => !a.signalsRead)) missing.push('failure signals not available for every attempt (no Allure result or Failure context)');
  const withMissing = (r) => ({ ...r, evidenceMissing: [...missing, ...(bugMatch?.missing ?? [])] });

  // 1. knownDefect(<Bug>) reached and the story assertion failed as recorded: the Bug is a recorded product defect.
  if (outcome.knownDefect && outcome.raw.expectedStatus === 'failed') {
    const bug = bugMatch?.bugs.find((b) => b.relation === 'known-defect');
    if (outcome.raw.playwrightStatus === 'expected' && bug) {
      return withMissing(result('PRODUCT_DEFECT', 'confirmed', [
        `knownDefect(${bug.id}) was reached and the story assertion failed as that Bug describes`,
        `${bug.id} is a recorded Bug${bug.jiraKey ? ` (${bug.jiraKey})` : ''}`,
      ]));
    }
    if (outcome.raw.playwrightStatus === 'expected') {
      return withMissing(result('UNKNOWN', 'suspected', [`knownDefect(${outcome.knownDefect}) was reached, but no such Bug is recorded in plan.json`]));
    }
    return withMissing(result('UNKNOWN', 'suspected', [`known defect ${outcome.knownDefect} did not reproduce: the story assertion passed`], { notice: 'known-defect-not-reproduced' }));
  }

  // 2. Failed, then passed on retry.
  if (outcome.raw.playwrightStatus === 'flaky') {
    return withMissing(result('FLAKY_OR_INCONCLUSIVE', 'probable', [
      `failed on attempt ${failed.map((a) => a.retry + 1).join(', ')} and passed on retry`,
      failed[0]?.error ? `first failure: ${failed[0].error.shape}` : 'first failure has no error message',
    ]));
  }

  if (failed.length === 0) return withMissing(result('UNKNOWN', 'suspected', ['no failed attempt recorded']));
  if (failed.some((a) => !a.error)) return withMissing(result('UNKNOWN', 'suspected', ['not enough evidence: a failed attempt has no error']));

  // 3. Failed every time, but not the same way.
  const signatures = new Set(failed.map((a) => a.error.signature));
  const steps = new Set(failed.map((a) => a.failedStep));
  if (signatures.size > 1 || steps.size > 1) {
    return withMissing(result('FLAKY_OR_INCONCLUSIVE', 'probable', [
      `the ${failed.length} attempts failed differently (${signatures.size} error forms, ${steps.size} failing steps)`,
      'inconsistent failures do not identify one cause',
    ]));
  }

  const { shape, topFrameOrigin } = failed[0].error;
  const signals = consistentSignals(failed);
  const seenOnce = [...new Set(failed.flatMap((a) => a.signals))].filter((s) => !signals.includes(s));
  const notes = seenOnce.length ? [`signal(s) seen in some attempts only: ${seenOnce.join(', ')}`] : [];
  const repeated = failed.length >= 2;

  // 4. The environment could not be reached during the test, and the error is not a value the app returned.
  if (signals.includes('network-error') && shape !== 'assertion-mismatch') {
    return withMissing(result('INFRASTRUCTURE_FAILURE', 'probable', [
      'a network error (no HTTP response) was recorded in every failed attempt',
      `the failure is a ${shape}, not a wrong value returned by the application`,
      ...notes,
    ]));
  }

  // 5. The API answered too slowly, and the test ran out of time waiting for the result.
  if (signals.includes('slow-response') && shape === 'wait-expired') {
    return withMissing(result('INFRASTRUCTURE_FAILURE', 'probable', [
      'an API response slower than the slow-response threshold was recorded in every failed attempt',
      'the failure is a wait that expired, not a wrong value',
      'a performance defect is also possible: check whether the same call is slow on a healthy environment',
      ...notes,
    ]));
  }

  // 6. Our own code threw: a script exception raised from a test or framework file.
  if (shape === 'script-exception' && (topFrameOrigin === 'test-code' || topFrameOrigin === 'framework-code')) {
    return withMissing(result('TEST_DEFECT', 'probable', [
      'a JavaScript exception (not an assertion) was thrown',
      `its top stack frame is in this repository (${failed[0].error.topFrames[0]})`,
      ...notes,
    ]));
  }
  if (shape === 'locator-ambiguous') {
    return withMissing(result('TEST_DEFECT', 'suspected', [
      'a locator matched several elements (strict mode violation)',
      'usually the locator needs narrowing; a page that now renders duplicates would be a product change',
      ...notes,
    ]));
  }

  // 7. The application returned or rendered a different value, the same way every time, with nothing else wrong.
  if (shape === 'assertion-mismatch' && signals.length === 0) {
    if (!repeated) {
      return withMissing(result('UNKNOWN', 'suspected', ['assertion failed once; with no retry its consistency is unknown', ...notes]));
    }
    return withMissing(result('PRODUCT_DEFECT', 'suspected', [
      `the same assertion failed in all ${failed.length} attempts, in the same step`,
      'no environment signal (network error, 5xx, slow response, page error) was recorded',
      'still unconfirmed: the expected value, the test data or the environment configuration can also be wrong',
      ...notes,
    ]));
  }

  // Everything else stays open, with what was seen.
  const hints = {
    'wait-expired': 'an element or condition did not appear in time: locator, synchronization, environment or product',
    'setup-failed': 'a precondition could not be created through the API',
    'backend-5xx': 'a 5xx was returned: a server defect or an environment problem',
    'page-error': 'the page threw an uncaught exception: points at application code',
  };
  return withMissing(result('UNKNOWN', 'suspected', [
    hints[shape] ?? `error form: ${shape}`,
    ...signals.filter((s) => hints[s]).map((s) => hints[s]),
    ...notes,
  ]));
}

/**
 * Run-level classification when the run stopped before or outside the tests (collect.mjs collectRunErrors).
 * INFRASTRUCTURE_FAILURE needs both facts: no test ran, and the framework's own environment or configuration
 * check is what stopped it. Anything else stays UNKNOWN.
 */
export function classifyRun(runErrors, report) {
  if (runErrors.length === 0) return null;
  const ran = report ? report.stats.expected + report.stats.unexpected + report.stats.flaky : 0;
  const origins = new Set(runErrors.map((e) => e.origin));
  if (ran === 0 && (origins.has('environment-unreachable') || origins.has('configuration'))) {
    return {
      category: 'INFRASTRUCTURE_FAILURE',
      confidence: 'probable',
      reasons: ['no test ran', `the run stopped in global set-up with its own ${[...origins].join(' / ')} check`],
    };
  }
  return { category: 'UNKNOWN', confidence: 'suspected', reasons: [ran === 0 ? 'no test ran, and the framework does not recognize the cause' : 'errors outside the tests; see run errors'] };
}

/**
 * Stable identity of a failure, for grouping repeated failures of one cause (here and, later, across runs).
 * Scenario + failing step + error form; no test user names, URLs, numbers or timestamps.
 */
export function fingerprint(outcome) {
  const attempt = outcome.attempts.find((a) => a.error) ?? outcome.attempts[0];
  const basis = [outcome.xrayTestKey ?? outcome.scenarioId ?? outcome.id, attempt?.failedStep ?? '', attempt?.error?.signature ?? ''].join('|');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

/** What a reviewer should do. Never "create a Bug": in report-only mode nothing is written to Jira. */
export function recommend(classification, bugMatch) {
  const exact = bugMatch.bugs.find((b) => b.relation === 'known-defect');
  const strong = bugMatch.bugs.filter((b) => ['previous-triage', 'detected-by-test', 'same-criterion'].includes(b.relation));
  const name = (b) => `${b.id}${b.jiraKey ? ` (${b.jiraKey})` : ''}`;

  if (classification.notice === 'known-defect-not-reproduced') {
    return { action: 'verify-fix', text: `Known defect ${exact ? name(exact) : ''} no longer reproduces. Verify the fix, then remove knownDefect(). Do not change the Bug automatically.` };
  }
  switch (classification.category) {
    case 'PRODUCT_DEFECT':
      if (classification.confidence === 'confirmed' && exact) {
        return { action: 'reuse-existing-bug', bug: exact.id, text: `Existing Bug ${name(exact)} reproduced. No new Bug.${exact.provenance.length ? ` Its origin (${exact.provenance.join(', ')}) stays as recorded.` : ''}` };
      }
      if (strong.length) {
        const weak = bugMatch.bugs.filter((b) => b.relation === 'same-story');
        return {
          action: 'review-existing-bug',
          bugs: [...strong, ...weak].map((b) => b.id),
          text: `Unconfirmed. Check whether ${strong.map(name).join(', ')} explains it before proposing a new Bug.${weak.length ? ` Same story: ${weak.map(name).join(', ')}.` : ''}`,
        };
      }
      if (bugMatch.bugs.length) {
        return { action: 'review-existing-bug', bugs: bugMatch.bugs.map((b) => b.id), text: `Unconfirmed. Bugs on the same story: ${bugMatch.bugs.map(name).join(', ')}; check them before proposing a new Bug.` };
      }
      return { action: 'review-propose-bug', text: 'Unconfirmed. Review the evidence; if it is a product defect and no recorded Bug covers it, draft a new Bug by hand.' };
    case 'INFRASTRUCTURE_FAILURE':
      return { action: 'check-environment', text: 'Not a product defect as observed. Check the environment and re-run; no Bug.' };
    case 'TEST_DEFECT':
      return { action: 'fix-test', text: 'Fix the test or framework code; no product Bug.' };
    case 'FLAKY_OR_INCONCLUSIVE':
      return { action: 'investigate-flakiness', text: 'Inconsistent result: investigate stability (test-reliability) before any Bug.' };
    default:
      return {
        action: 'review-evidence',
        bugs: strong.map((b) => b.id),
        text: `Not enough evidence to classify. Review the Allure result and screenshot.${strong.length ? ` Related recorded Bugs: ${strong.map(name).join(', ')}.` : ''}`,
      };
  }
}
