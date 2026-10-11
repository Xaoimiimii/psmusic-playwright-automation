import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { allureEnvironmentInfo } from './src/reporting/environment-info';

const isCI = !!process.env.CI;
// The config is also loaded by every worker; reporters run only in the main process.
const isMainProcess = process.env.TEST_WORKER_INDEX === undefined;

export default defineConfig({
  testDir: './tests',
  // Empty reports/allure-results/ first (ALLURE_KEEP_RESULTS=1 keeps it), then check PSMusic is reachable.
  globalSetup: [require.resolve('./src/reporting/clean-allure-results'), require.resolve('./src/global-setup')],
  fullyParallel: true,
  forbidOnly: isCI,
  // At most one retry in CI; a test that passes on retry is reported as flaky (test-strategy.md §11.3).
  retries: isCI ? 1 : 0,
  // Sequential in CI: tests share the remote database and song counters (test-strategy.md §7.4).
  workers: isCI ? 1 : undefined,
  // Every run output lives under reports/ (git-ignored). outputDir is wiped at the start of each run,
  // so the reporters write next to it, not inside it.
  outputDir: 'reports/test-results',
  reporter: [
    isCI ? ['github'] : ['list'],
    ['html', { open: 'never', outputFolder: 'reports/playwright-report' }],
    // detail: false keeps only test.step and page-object @step steps: Playwright's own action titles
    // (`Fill "<typed password>"`, fixture set-up, every expect) stay out of the report (docs/reporting.md §4).
    ['allure-playwright', {
      resultsDir: 'reports/allure-results',
      detail: false,
      environmentInfo: isMainProcess ? allureEnvironmentInfo() : {},
    }],
    // Read by scripts/ci/write-ci-summary.mjs for the summary on the GitHub Actions run page.
    ['json', { outputFile: 'reports/test-results.json' }],
    // For Xray import (scripts/xray/xray.mjs import-junit). Annotations become <property> elements, so the
    // `test_key` set by the xrayTestKey fixture attaches each result to its existing Xray Test. Attachments are
    // not embedded: screenshots of signed-in pages can show personal data (docs/integrations/xray-cloud-rest-api.md §6.3).
    ['junit', { outputFile: 'reports/xray-report.xml', embedAnnotationsAsProperties: true, textContentAnnotations: ['test_description'] }],
  ],
  use: {
    baseURL: env.uiBaseUrl,
    // The local UI and API run on mkcert / ASP.NET dev certificates.
    ignoreHTTPSErrors: true,
    // No traces in CI: a trace records request headers and bodies (service key, cookies,
    // tokens, passwords) and CI uploads its evidence as artifacts (test-strategy.md §11.5).
    trace: isCI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Non-Chromium browsers are out of scope for the system level (docs/test-strategy/levels/system.md §3).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
