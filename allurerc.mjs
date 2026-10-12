import { defineConfig } from 'allure';

// Failure categories, first match wins. They are triage hints, not root causes (docs/reporting.md §7):
// - Labels set by the framework come first, because they record what was observed during the run:
//   `known_defect` (knownDefect() was reached) and `failure_signal` (a 5xx, a network error, an uncaught
//   page error or an API response slower than PSMUSIC_SLOW_RESPONSE_MS was seen by the API wrapper or the
//   browser evidence collector, src/reporting/test-observations.ts).
// - These are quick symptom groups. The evidence-based triage decision is scripts/triage (docs/failure-triage.md).
// - Error-text patterns follow, for failures with no such signal. They cannot tell a wrong locator from a
//   missing element, or a slow environment from a real hang: those categories are named for the symptom.
const categories = [
  {
    id: 'known-defect-reproduced',
    name: 'Known defect still reproduces (expected failure)',
    matchers: { statuses: ['passed'], labels: { known_defect: '.+' } },
  },
  {
    id: 'known-defect-fixed',
    name: 'Known defect no longer reproduces: verify the fix, then remove knownDefect()',
    matchers: { statuses: ['failed', 'broken'], labels: { known_defect: '.+' } },
  },
  {
    id: 'flaky',
    name: 'Flaky: failed, then passed on retry',
    matchers: { statuses: ['passed'], flaky: true },
  },
  {
    id: 'environment',
    name: 'Environment or infrastructure: PSMusic or the browser unreachable',
    matchers: [
      { statuses: ['failed', 'broken'], labels: { failure_signal: '^network-error$' } },
      {
        statuses: ['failed', 'broken'],
        message: /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up|net::ERR_(?!ABORTED)|Target page, context or browser has been closed|browserType\.launch|Missing environment variable|certificate/,
      },
    ],
  },
  {
    id: 'backend',
    name: 'API / backend failure: a 5xx response was observed',
    matchers: [
      { statuses: ['failed', 'broken'], labels: { failure_signal: '^backend-5xx$' } },
      { statuses: ['failed', 'broken'], message: /Received:\s*5\d\d\b/ },
    ],
  },
  {
    id: 'page-error',
    name: 'Application error in the page: uncaught JavaScript exception',
    matchers: { statuses: ['failed', 'broken'], labels: { failure_signal: '^page-error$' } },
  },
  {
    id: 'slow-backend',
    name: 'Slow API response observed (environment or performance; check before blaming the test)',
    matchers: { statuses: ['failed', 'broken'], labels: { failure_signal: '^slow-response$' } },
  },
  {
    id: 'test-data',
    name: 'Test data or set-up failure (precondition could not be created)',
    matchers: { statuses: ['failed', 'broken'], message: /Test setup:/ },
  },
  {
    id: 'automation-script',
    name: 'Automation script error (exception in test code)',
    matchers: { statuses: ['failed', 'broken'], message: /\b(TypeError|ReferenceError|SyntaxError|RangeError)\b|Cannot read propert/ },
  },
  {
    id: 'locator-ambiguous',
    name: 'Locator matches several elements (automation)',
    matchers: { statuses: ['failed', 'broken'], message: /strict mode violation/ },
  },
  {
    id: 'element-not-found',
    name: 'UI element not found or not actionable (locator, synchronization or product)',
    matchers: {
      statuses: ['failed', 'broken'],
      message: /element\(s\) not found|waiting for locator|not attached to the DOM|intercepts pointer events|outside of the viewport|element is not (visible|enabled|stable|editable)/,
    },
  },
  {
    id: 'timeout',
    name: 'Timeout (synchronization, slow environment or hang)',
    matchers: { statuses: ['failed', 'broken'], message: /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded/ },
  },
  {
    id: 'assertion',
    name: 'Assertion failed: observed behavior differs from the expected result',
    matchers: { statuses: ['failed'], message: /Expected[\s\S]*Received/ },
  },
  {
    id: 'unclassified',
    name: 'Unclassified failure: needs triage',
    matchers: { statuses: ['failed', 'broken'] },
  },
];

// Allure 3 report settings, used by `npm run allure:generate` locally and in CI.
// singleFile: the report is one HTML file that opens straight from a downloaded artifact.
// historyPath: local runs append to reports/allure-history.jsonl (git-ignored) for trends and new/fixed
// transitions. CI starts each run from an empty checkout, so CI reports have no history.
export default defineConfig({
  name: 'PSMusic Automation',
  output: './reports/allure-report',
  historyPath: './reports/allure-history.jsonl',
  historyLimit: 20,
  categories,
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: 'en',
      },
    },
  },
});
