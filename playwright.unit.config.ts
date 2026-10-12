import { defineConfig } from '@playwright/test';

// Unit tests for the repository's own tooling (failure triage): plain functions over fixtures, no browser and no
// PSMusic, so no global set-up and no reporting fixture. Kept apart from playwright.config.ts, whose global set-up
// requires a reachable PSMusic. Run with `npm run test:unit`.
export default defineConfig({
  testDir: './tests-unit',
  outputDir: 'reports/unit-test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
});
