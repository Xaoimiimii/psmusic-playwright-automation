import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./src/global-setup'),
  fullyParallel: true,
  forbidOnly: isCI,
  // At most one retry in CI; a test that passes on retry is reported as flaky (test-strategy.md §11.3).
  retries: isCI ? 1 : 0,
  // Sequential in CI: tests share the remote database and song counters (test-strategy.md §7.4).
  workers: isCI ? 1 : undefined,
  reporter: [
    isCI ? ['github'] : ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    // Read by scripts/write-ci-summary.mjs for the summary on the GitHub Actions run page.
    ['json', { outputFile: 'test-results.json' }],
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
