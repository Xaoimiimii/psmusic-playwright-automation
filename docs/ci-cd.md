# CI/CD

How this repository runs its Playwright tests in GitHub Actions, and where to look when a run fails.
The intent behind these choices (which suites run when, retries, redaction) is in
[`test-strategy/test-strategy.md`](test-strategy/test-strategy.md) §10 and §11. This file describes what is actually configured.

## 1. Architecture

```
Pull request to main ─┐
Push to main ─────────┼─► ci.yml ─► Build ─► Smoke tests ─► Allure report + artifacts
Manual (Actions tab) ─┘            (npm ci,   (@smoke)
                                    tsc)

Manual (Actions tab) ───► regression.yml ─► Build ─► All tests ─► Allure report + artifacts
```

| Workflow | File | Jobs |
|---|---|---|
| CI | `.github/workflows/ci.yml` | `build`: install dependencies and type-check. `smoke-tests`: run `@smoke` tests, then generate and upload the reports |
| Regression | `.github/workflows/regression.yml` | `regression-tests`: install, type-check, run every test, then generate and upload the reports |

There is no Docker, no deployment and no test sharding. The tests run against an already running PSMusic
environment whose URLs come from configuration (section 4).

## 2. Workflow triggers

| Trigger | Workflow | Why |
|---|---|---|
| Pull request targeting `main` | CI (smoke) | Fast feedback before a merge |
| Push to `main` (a merged PR) | CI (smoke) | Check that `main` still works |
| Manual (`workflow_dispatch`) | CI (smoke) | Re-run smoke on any branch, for example after the environment was fixed |
| Manual (`workflow_dispatch`) | Regression (all tests) | Before a release or demo, or to investigate. Actions tab → **Regression** → **Run workflow** → choose the branch |
| Scheduled | None yet | Worth adding once Regression is green on the CI environment (A-11 fixed, section 4.3); until then a nightly run would fail every night for a known reason. To add it, put `schedule: - cron: '0 1 * * *'` under `on:` in `regression.yml` |

A new push to the same PR or branch cancels the CI run that is still in progress (`concurrency` in `ci.yml`).

## 3. Test suites

Suites are chosen by **tag**, not by file list. Tags are set on each test (`{ tag: ['@smoke', '@critical'] }`).

| Suite | Command | Runs in | Contents today |
|---|---|---|---|
| Smoke | `npm run test:smoke` (`--grep @smoke`) | `ci.yml` | 2 tests: TS-AUTH-01 valid login, TS-AUTH-05 reload keeps the session. About 10–20 s |
| Regression | `npm run test:regression` (whole `tests/` folder) | `regression.yml` | All 21 tests: `@smoke`, `@critical`, `@regression`, `@sit-controlled`. About 1 minute |

To put a test in smoke, add `@smoke` to its tags. Keep smoke small and read-only (strategy §10.1).

Tests marked with `knownDefect()` (`src/support/known-defect.ts`) are expected to fail. They count as passed while the
defect exists, and fail the run if they start passing, so the fix gets noticed.

### Execution settings in CI

GitHub sets `CI=true`. `playwright.config.ts` then uses:

| Setting | Local | CI | Reason |
|---|---|---|---|
| Browser | Chromium | Chromium | Only browser in scope (strategy §2.2) |
| Headless | yes (use `--headed` to watch) | yes | No display on the runner |
| Workers | Playwright default (parallel) | 1 (sequential) | Tests share the remote database and song counters. Parallel CI runs are a later step (section 8) |
| Retries | 0 | 1 | A test that passes on retry is reported as **flaky**, never silently green |
| Trace | kept on failure | off | A trace records request headers and bodies (service key, cookies, tokens). CI uploads evidence as artifacts, so no traces there |
| Screenshot | on failure | on failure | Main UI evidence |
| `test.only` | allowed | fails the run (`forbidOnly`) | Stops a focused test from being merged |
| Reporters | list, HTML, Allure, JSON | GitHub annotations, HTML, Allure, JSON | JSON (`test-results.json`) feeds the run summary (section 6) |

## 4. Configuration

### 4.1 Variables

The code reads three values (`src/config/env.ts`). Locally they come from `.env` (copy `.env.example`).
In GitHub they are set under **Settings → Secrets and variables → Actions**.

| Name | Meaning | Where in GitHub | Sensitive |
|---|---|---|---|
| `PSMUSIC_UI_URL` | Origin of the PSMusic web app, for example `https://localhost:5174` locally | **Variables** tab | No |
| `PSMUSIC_API_URL` | Origin of the PSMusic API (no `/api` suffix), for example `https://localhost:7215` | **Variables** tab | No |
| `PSMUSIC_SERVICE_KEY` | Value of the `X-App-Service-Key` header required by every `/api` call | **Secrets** tab | Yes |

No test-account username or password is needed: each test registers its own throwaway user through the API
(`src/data/users.ts`, `registeredUser` fixture).

Secrets handling:

- The service key is only read from `secrets.PSMUSIC_SERVICE_KEY`. GitHub masks it in logs, and no code prints it.
- `.env` is git-ignored. Never commit it or paste its values into issues or PRs.
- Secrets are not passed to workflows triggered from forks. A fork PR gets the build job only.

### 4.2 When the variables are missing

- **CI:** the `smoke-tests` job is **skipped** (shown grey, not green), and the `build` job adds the warning
  *"Smoke tests skipped"* to the run summary. This keeps the build job useful for forks and for a
  repository copy without an environment. The CI environment is in section 4.3.
- **Regression:** the run **fails** with `Missing environment variable PSMUSIC_UI_URL`. A manual run means someone
  wants results, so a missing configuration is an error.
- **Variables set but the app is down:** `src/global-setup.ts` checks the UI and the API before any test runs and
  fails the run with one clear message (`PSMusic UI is not reachable at ...`). It does not skip.

### 4.3 Test environment used by CI

A GitHub runner cannot reach `localhost` on a developer machine, so CI runs against the deployed environment:

| | Local | CI (configured 2026-10-08) |
|---|---|---|
| UI | `https://localhost:5174` (Vite dev build) | `https://psmusic.netlify.app` (production build) |
| API | `https://localhost:7215` | `https://psmusic-5zfx.onrender.com` |
| Service key | `.env` | `PSMUSIC_SERVICE_KEY` secret (the same value works in both) |

Things to know about the deployed environment:

- **Every run registers new test users** in its database. Never point CI at an environment where that is not acceptable.
- The free hosting tier can be slow to answer the first requests. A test that fails once and passes on retry is
  reported as flaky (TS-AUTH-01 was seen flaky this way).
- **Logout does not remove the refresh cookie there** (application defect A-11 in
  `exploration/browser/authentication.md` §10). TS-AUTH-08, TS-AUTH-10 (`/favorites`) and TS-AUTH-11 fail on the
  deployed environment and pass locally. They are not in smoke, so CI stays green; a **Regression** run is red until
  the SUT team fixes it.
- To run the suite locally against the deployed environment, put its URLs in `.env`, or override them for one run:
  `PSMUSIC_UI_URL=https://psmusic.netlify.app PSMUSIC_API_URL=https://psmusic-5zfx.onrender.com npm run test:smoke`.
  Variables set in the shell take precedence over `.env`.

Alternative, not implemented: start PSMusic inside the CI job, as the Foodly project does. The application repository
is private and the API needs database and Elasticsearch settings, so that is significant extra setup.

## 5. Local vs CI execution

Prerequisites: Node.js 22, PSMusic running locally, and `.env` filled in from `.env.example`.

```bash
npm ci                                   # install exactly what package-lock.json lists (same as CI)
npx playwright install chromium          # once, or after a Playwright upgrade
npm run typecheck                        # same check as the CI build job

npm run test:smoke                       # smoke suite, as in ci.yml
npm run test:regression                  # all tests, as in regression.yml
npx playwright test tests/auth/login.spec.ts   # one file
npx playwright test --headed --grep @smoke     # watch the browser

npm run allure:generate                  # builds allure-report/index.html from allure-results/
npm run allure:open                      # serves the report in a browser
```

To run exactly as CI does (1 worker, 1 retry, no trace), set `CI=true` first:

```bash
CI=true npm run test:smoke               # Git Bash / macOS / Linux
$env:CI='true'; npm run test:smoke       # PowerShell
```

`allure-results/` is not cleared between local runs, so the next report also shows older results. Delete the folder
before a run when you want a clean report. In CI every run starts from an empty checkout.

## 6. Failure investigation

1. **Open the run** (Actions tab, or **Details** next to the check on the PR). The run summary page shows, without
   downloading anything:
   - a results table (total, passed, failed, flaky, skipped, duration),
   - each failed test with its file, line and error message (click to expand),
   - each flaky test with the error of its first attempt,
   - known-defect tests in the run.

   This summary is written by `scripts/write-ci-summary.mjs` from Playwright's `test-results.json`. Tokens (JWTs) in
   error messages are masked. Failed tests are also listed as annotations, and the failed step's log shows the full error.
2. **For screenshots and step details, download the artifacts** at the bottom of the run summary page. They are uploaded even when tests fail and are
   kept for 14 days.

| Artifact | Contents | How to open |
|---|---|---|
| `allure-smoke` / `allure-regression` | `allure-report/index.html` (whole report in one file) and the raw `allure-results/` | Unzip and open `allure-report/index.html` in a browser. Shows steps, errors, screenshots and retries |
| `playwright-smoke` / `playwright-regression` | `playwright-report/` (HTML report) and `test-results/` | `npx playwright show-report <unzipped>/playwright-report`, or look at the files in `test-results/` directly |

What is in the evidence:

| Evidence | Where |
|---|---|
| Error message and stack | Job log, Allure, Playwright report |
| Screenshot at the moment of failure (UI tests) | `test-results/<test>/test-failed-1.png`, attached in Allure |
| Page structure at failure (accessibility snapshot) | `test-results/<test>/error-context.md`, attached in Allure |
| API failures | The assertion error shows the expected and actual status and body fields. Setup failures (`Test setup: register ... failed with 400 ...`) include the status and the response text |
| Retries and flaky tests | Allure (retries per test), the job log (`flaky` count), `-retry1` folders in `test-results/` |
| Full console log | Job log. Use **Download log archive** from the run's ⋯ menu |

3. **Reproduce locally** with the same command, adding the trace that CI does not record:
   `npx playwright test <file> --grep "<test title>" --trace on`, then `npx playwright show-trace test-results/<test>/trace.zip`.

### What is never in the evidence

Traces are off in CI, so request headers (`X-App-Service-Key`, `Authorization`), cookies and request bodies are not
uploaded. Screenshots and accessibility snapshots show only the page, and the only passwords a test ever types belong
to throwaway test users. If you add `testInfo.attach(...)` or log a response,
do not include headers, tokens, cookies or passwords.

## 7. Test data and cleanup

- Each test registers its own user with a unique name (`pwqa_<time><random>`), so CI needs no prepared accounts and no local files.
- There is no cleanup step: the PSMusic API has no endpoint to delete users, and the tests have no database access.
  Test users stay in the environment's database. That is acceptable for a test environment, and the reason CI must never
  point at an environment holding real users (section 4.3).
- Because nothing is cleaned up, a cleanup failure cannot hide a test failure. If a cleanup step is added later, put it in a
  fixture teardown, so Playwright reports both the test failure and the teardown failure.

## 8. Next improvements (in this order)

1. **Get A-11 fixed** (logout on the deployed environment, section 4.3), so Regression is green there.
2. **Add ESLint** to the build job (strategy §11.1 lists it; it is not installed yet).
3. **Run `@critical` on push to `main`.** The whole suite takes about a minute locally (about two against the deployed environment), so this is cheap.
4. **Nightly scheduled regression** in `regression.yml` (section 2), once it is green.
5. **Parallel workers in CI**, after checking that no tests touch the same song counters at the same time (strategy §7.4).
6. **Separate API and UI jobs or tags**, and an Allure history or published report, when the suite grows.
