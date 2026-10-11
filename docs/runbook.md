# Runbook: following results and what to run next

Day-to-day guide for whoever runs this suite or watches its results: which pipeline runs when, where to look,
what to do when a test fails, and which commands to run after a change.
Background: [`ci-cd.md`](ci-cd.md) (pipelines in detail), [`reporting.md`](reporting.md) (Allure content),
[`../test-management/README.md`](../test-management/README.md) (Jira/Xray sync).

## 1. Which pipeline runs when

| Workflow (Actions tab) | Started by | Runs | Where to look | Blocks |
|---|---|---|---|---|
| **CI** (`ci.yml`) | PR to `main`, push to `main`, manual | `build`: install, type-check, generated-data check. `smoke-tests`: `@smoke` (skipped if the environment variables are not set) | PR checks; run summary | The PR (if branch protection requires it) |
| **Regression** (`regression.yml`) | Every night 01:00 UTC (08:00 Vietnam), manual | Every test | Actions → Regression | Nothing; read it every morning |
| **Post-deployment** (`post-deployment.yml`) | *Deploy to QA* in the application repository (`repository_dispatch`), manual | `@smoke` against QA | Actions → Post-deployment (here, not in the app repo) | Nothing; the deploy job stays green |
| **Pre-merge validation** (template, runs in the application repository) | PR to the application's `main` | Builds the PR with Docker, runs `@critical` | Check *Automation tests (@critical)* on the app PR; artifacts in the app repo | The app PR, if marked required |

Manual run: Actions → pick the workflow → **Run workflow** → branch `main`.

## 2. Reading a run

1. **Run summary page** (click the run). No download needed:
   - totals: passed, failed, flaky, skipped, duration;
   - each failed test with file, line and error (expand it);
   - flaky tests (failed, then passed on retry) with the first error;
   - known-defect tests in the run.
2. **Artifacts** (bottom of the summary page, kept 14 days):
   - `allure-<suite>`: unzip, open `reports/allure-report/index.html` in a browser. This is the main report.
   - `playwright-<suite>`: Playwright HTML report and the raw screenshots.
3. **In the Allure report**, start from:
   - **Categories**: failures grouped by likely cause (triage hint, not proof);
   - the failed test → error, failed step, **Attachments** (screenshot, error-context, Failure context,
     Browser API traffic, HTTP exchange) and **Retries**;
   - **Behaviors** view by functional area → user story → acceptance criterion;
   - links to the Xray Test, story, risk and bug (if `ATLASSIAN_SITE_URL` is configured).

A grey **Smoke tests** job means it was skipped (no environment configured), not passed: the build job then shows the
warning *"Smoke tests skipped"*.

## 3. When a test fails

### 3.1 First triage by Allure category

| Category | Usually means | Next step |
|---|---|---|
| Environment or infrastructure | PSMusic, the network or the browser was unavailable | Check the environment is up; re-run the workflow. Not a product bug |
| API / backend failure (5xx) | The API returned a server error | Open the HTTP exchange / Browser API traffic; reproduce with the same call; report to the backend if it reproduces |
| Application error in the page | Uncaught JavaScript exception in the web app | Read *Failure context* → *Uncaught page errors*; likely a frontend bug |
| Test data or set-up failure | A precondition (register, login, song data) could not be created | Check the HTTP exchange under *Before Hooks*; often environment or data, not the feature under test |
| Automation script error | Exception in test code (`TypeError` …) | Fix the test code |
| Locator matches several elements | Locator too broad after a UI change | Fix the page object |
| UI element not found or not actionable | Wrong locator, page too slow, or the app did not render it | Compare the screenshot and *error-context* with the expected page; decide which of the three |
| Timeout | Slow environment, missing wait, or a hang | Re-run locally with a trace (§3.2) |
| Assertion failed | The app behaved differently from the expected result | Compare with the story / acceptance criterion in the description; if the app is wrong, it is a defect (§3.3) |
| Known defect no longer reproduces | A recorded bug looks fixed | §3.4 |
| Unclassified | None of the above | Read the error and the failed step |

The category is a hint. Always read the error, the failed step and the evidence before deciding.

### 3.2 Reproduce locally

```bash
# same settings as CI (1 worker, 1 retry, no trace), PowerShell: $env:CI='true'; npx playwright test ...
CI=true npx playwright test tests/auth/login.spec.ts --grep "TS-AUTH-01"

# with a trace (CI never records one), then open it
npx playwright test tests/auth/login.spec.ts --grep "TS-AUTH-01" --trace on
npx playwright show-trace reports/test-results/<test folder>/trace.zip

# watch the browser
npx playwright test --headed --grep "TS-AUTH-01"

# build and open the Allure report of the local run
npm run allure:generate
npm run allure:open
```

Local runs need PSMusic running and `.env` filled from `.env.example`.

### 3.3 Decide: product defect, test defect, or environment

| Finding | Do this |
|---|---|
| **Product defect** (the app breaks a story / acceptance criterion) | Record it (bug in Jira, linked to the story and the failed Test; see `.claude/rules/traceability-rules.md`). If the defect will stay open, mark the test with `knownDefect('US-xxx-AC-yy', 'what is observed')` immediately before the failing assertion. Do **not** change the assertion to match the wrong behavior |
| **Test defect** (locator, wait, data, wrong expectation) | Fix the page object, fixture or test data; re-run the test locally until it passes |
| **Environment / third party** | Re-run when the environment is back; note it in the PR or the stand-up, no bug |
| **Flaky** (passed on retry) | Do not ignore: find the cause from the first attempt's evidence. Retries are a safety net, not a fix |

### 3.4 Known defect fixed

The category *Known defect no longer reproduces* (or an "unexpected pass" in the summary) means the assertion that
used to fail now passes.

1. Verify the fix by hand or with a local run.
2. Remove the `knownDefect(...)` call from the test.
3. Close or update the bug in Jira.

## 4. After a change: which commands

| You changed… | Run | Then |
|---|---|---|
| Test code, page objects, fixtures | `npm run typecheck`, then the related tests: `npx playwright test <file>` | Commit; CI runs smoke |
| Anything broad (fixtures, config) | `npm test` (all tests) | Commit |
| Test design documents (stories, scenarios, risks) | `/plan-jira-xray` (writes `test-management/state/plan.json`) → review → `/sync-jira-xray --dry-run` → `/sync-jira-xray` → `/verify-jira-xray` | Then the two commands below |
| `plan.json` or `issue-map.json` (after plan or sync) | `npm run report:metadata` (regenerates `src/data/test-metadata.ts`) and `npm run xray:keys` (regenerates `src/data/xray-test-keys.ts`) | Commit both files; CI fails the build job if you forget |
| Want Jira CSV import files | `npm run jira:export` | — |
| Want results in Xray | `node scripts/xray/xray.mjs prepare-junit reports/xray-report.xml` (dry run), then `node scripts/xray/xray.mjs import-junit reports/xray-report.xml [testPlanKey]` | Check the Test Execution in Xray. Not wired in CI yet |

**CI build job fails at *Check generated test data is up to date***:

```bash
npm run report:metadata   # regenerates src/data/test-metadata.ts
npm run xray:keys         # regenerates src/data/xray-test-keys.ts
git add src/data/test-metadata.ts src/data/xray-test-keys.ts && git commit -m "Regenerate test metadata"
```

## 5. Command cheat sheet

| Command | Purpose |
|---|---|
| `npm ci` | Install exactly what `package-lock.json` lists (same as CI) |
| `npx playwright install chromium` | Install the browser (once, and after a Playwright upgrade) |
| `npm run typecheck` | Type-check the project, as the CI build job does |
| `npm test` / `npm run test:regression` | All tests |
| `npm run test:smoke` | `@smoke` tests (CI suite) |
| `npm run test:auth` | Tests in `tests/auth` |
| `npx playwright test --grep @critical` | `@critical` tests (pre-merge suite) |
| `npm run allure:generate` | Build `reports/allure-report/index.html` from `reports/allure-results/` |
| `npm run allure:open` | Open the Allure report |
| `npm run report:metadata` | Regenerate Allure metadata from the Jira/Xray plan |
| `npm run xray:keys` | Regenerate the scenario → Xray Test key map |
| `npm run jira:export` | Generate Jira CSV import files from the Markdown design |
| `node scripts/ci/write-ci-summary.mjs "Smoke tests"` | Print the CI summary of the last run locally |

`reports/allure-results/` is emptied at the start of each run; set `ALLURE_KEEP_RESULTS=1` to keep earlier results.

## 6. Scripts

What each file in `scripts/` does, when it runs and whether it writes to Jira/Xray:
[`scripts/README.md`](../scripts/README.md).
