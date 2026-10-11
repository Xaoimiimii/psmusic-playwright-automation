import fs from 'node:fs';
import path from 'node:path';

/** Same folder as the allure-playwright `resultsDir` in playwright.config.ts. */
export const ALLURE_RESULTS_DIR = path.resolve(__dirname, '../../reports/allure-results');

/**
 * Global setup: empties `reports/allure-results/` before the run, so the next
 * report shows this run only (its retries included) and not leftovers from
 * earlier local runs. Set `ALLURE_KEEP_RESULTS=1` to add to the existing results,
 * e.g. to build one report from several separate runs.
 *
 * Only the folder's content is removed; history (`reports/allure-history.jsonl`) lives outside it.
 */
export default function cleanAllureResults(): void {
  if (process.env.ALLURE_KEEP_RESULTS === '1' || !fs.existsSync(ALLURE_RESULTS_DIR)) return;
  for (const entry of fs.readdirSync(ALLURE_RESULTS_DIR)) {
    fs.rmSync(path.join(ALLURE_RESULTS_DIR, entry), { recursive: true, force: true });
  }
}
