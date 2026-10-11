# CI/CD

How this repository runs its Playwright tests in GitHub Actions, and where to look when a run fails.
The intent behind these choices (which suites run when, retries, redaction) is in
[`test-strategy/test-strategy.md`](test-strategy/test-strategy.md) §10 and §11. This file describes what is actually configured.

## 1. Architecture

Four triggers, each answering a different question:

| Trigger | Question it answers | Workflow | Tests | Against |
|---|---|---|---|---|
| Automation PR / push to `main` | Does the automation code still work? | `ci.yml` | `@smoke` | Deployed environment (section 4.3) |
| Nightly / manual | Is anything broken anywhere? | `regression.yml` | All | Deployed environment |
| Application PR | Is this application change safe to merge? | `pre-merge-validation.yml` **in the application repository** | `@critical` | The PR's code, built with docker compose on the runner |
| QA deployment | Does the deployed build work? | `post-deployment.yml`, started by `deploy-qa.yml` in the application repository | `@smoke` | QA environment (= the deployed environment) |

```
THIS REPOSITORY
  PR / push to main / manual ──► ci.yml ──────────────► build + type-check ─► @smoke    ─┐
  nightly 01:00 UTC / manual ──► regression.yml ──────► type-check ─────────► all tests ─┼─► run summary,
  repository_dispatch / manual ► post-deployment.yml ───────────────────────► @smoke    ─┤   Allure report,
                 ▲                                                                       │   artifacts
APPLICATION REPOSITORY (templates in ci-templates/psmusic-app/)                          │
  push to main / manual ─► deploy-qa.yml: deploy (simulated), record deployment, dispatch│
  PR to main / manual ───► pre-merge-validation.yml: docker compose up (PR code),        │
                           check out this repository ────────────────────► @critical ───┘
```

Every workflow runs the tests through the same composite action, `.github/actions/run-suite`
(install, optional type-check, Chromium, Playwright, run summary, Allure, artifacts). The application repository's
pre-merge workflow uses it too, from its checkout of this repository, so a pre-merge run looks like any other run.

| Workflow | File | Jobs |
|---|---|---|
| CI | `.github/workflows/ci.yml` | `build`: install dependencies and type-check. `smoke-tests`: run `@smoke` tests, then generate and upload the reports |
| Regression | `.github/workflows/regression.yml` | `regression-tests`: install, type-check, run every test, then generate and upload the reports |
| Post-deployment | `.github/workflows/post-deployment.yml` | `post-deployment-tests`: record which deployment started the run, run `@smoke`, upload the reports |
| Pre-merge validation | `ci-templates/psmusic-app/pre-merge-validation.yml` (runs in the application repository) | `pre-merge`: build and start the PR's code, run `@critical` from a checkout of this repository |
| Deploy to QA | `ci-templates/psmusic-app/deploy-qa.yml` (runs in the application repository) | `deploy`: simulated deployment, GitHub deployment record, `repository_dispatch` to this repository |

No test sharding. Except for pre-merge, the tests run against an already running PSMusic environment whose URLs
come from configuration (section 4).

## 2. Workflow triggers

| Trigger | Workflow | Why |
|---|---|---|
| Pull request targeting `main` | CI (smoke) | Fast feedback on automation changes before a merge |
| Push to `main` (a merged PR) | CI (smoke) | Check that `main` still works |
| Manual (`workflow_dispatch`) | CI (smoke) | Re-run smoke on any branch, for example after the environment was fixed |
| Schedule, every day 01:00 UTC (08:00 in Vietnam) | Regression (all tests) | Catch breakage nobody triggered: environment, data, third parties. **Red every night until A-11 is fixed** (section 4.3). A red night is only news if the failures differ from TS-AUTH-08/10/11 |
| Manual (`workflow_dispatch`) | Regression (all tests) | Before a release or demo, or to investigate. Actions tab → **Regression** → **Run workflow** → choose the branch |
| `repository_dispatch` event `psmusic-qa-deployed`, from the application's **Deploy to QA** | Post-deployment (smoke) | Check a deployment right after it happened (section 8.3) |
| Manual (`workflow_dispatch`) | Post-deployment (smoke) | Re-check the QA environment by hand |
| Pull request to the application's `main` | Pre-merge validation (critical), in the application repository | Block an application change that breaks a critical flow (section 8.2) |

Scheduled and `repository_dispatch` runs always use this repository's `main` (a GitHub rule).

A new push to the same PR or branch cancels the CI run that is still in progress (`concurrency` in `ci.yml`).
A newer deployment cancels the post-deployment check of the previous one. A new push to the same application PR
cancels its pre-merge validation the same way.

## 3. Test suites

Suites are chosen by **tag**, not by file list. Tags are set on each test (`{ tag: ['@smoke', '@critical'] }`).

| Suite | Command | Runs in | Contents today |
|---|---|---|---|
| Smoke | `npm run test:smoke` (`--grep @smoke`) | `ci.yml`, `post-deployment.yml` | 4 tests (2026-10-09). About 10–20 s |
| Critical | `npx playwright test --grep @critical` | `pre-merge-validation.yml` (application repository) | 29 tests (2026-10-09), every smoke test included |
| Regression | `npm run test:regression` (whole `tests/` folder) | `regression.yml` | All 37 tests (2026-10-09): `@smoke`, `@critical`, `@regression`, `@sit-controlled`. About 1 minute |

To put a test in smoke, add `@smoke` to its tags. Keep smoke small and read-only (strategy §10.1).

Tests marked with `knownDefect()` (`src/support/known-defect.ts`) are expected to fail. They count as passed while the
defect exists, and fail the run if they start passing, so the fix gets noticed.

### Execution settings in CI

GitHub sets `CI=true`. `playwright.config.ts` then uses:

| Setting | Local | CI | Reason |
|---|---|---|---|
| Browser | Chromium | Chromium | Only browser in scope (strategy §2.2) |
| Headless | yes (use `--headed` to watch) | yes | No display on the runner |
| Workers | Playwright default (parallel) | 1 (sequential) | Tests share the remote database and song counters. Parallel CI runs are a later step (section 9) |
| Retries | 0 | 1 | A test that passes on retry is reported as **flaky**, never silently green |
| Trace | kept on failure | off | A trace records request headers and bodies (service key, cookies, tokens). CI uploads evidence as artifacts, so no traces there |
| Screenshot | on failure | on failure | Main UI evidence |
| `test.only` | allowed | fails the run (`forbidOnly`) | Stops a focused test from being merged |
| Reporters | list, HTML, Allure, JSON | GitHub annotations, HTML, Allure, JSON | JSON (`reports/test-results.json`) feeds the run summary (section 6) |

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

npm run allure:generate                  # builds reports/allure-report/index.html from reports/allure-results/
npm run allure:open                      # serves the report in a browser
```

To run exactly as CI does (1 worker, 1 retry, no trace), set `CI=true` first:

```bash
CI=true npm run test:smoke               # Git Bash / macOS / Linux
$env:CI='true'; npm run test:smoke       # PowerShell
```

`reports/allure-results/` is not cleared between local runs, so the next report also shows older results. Delete the folder
before a run when you want a clean report. In CI every run starts from an empty checkout.

## 6. Failure investigation

1. **Open the run** (Actions tab, or **Details** next to the check on the PR). The run summary page shows, without
   downloading anything:
   - a results table (total, passed, failed, flaky, skipped, duration),
   - each failed test with its file, line and error message (click to expand),
   - each flaky test with the error of its first attempt,
   - known-defect tests in the run.

   This summary is written by `scripts/write-ci-summary.mjs` from Playwright's `reports/test-results.json`. Tokens (JWTs) in
   error messages are masked. Failed tests are also listed as annotations, and the failed step's log shows the full error.
2. **For screenshots and step details, download the artifacts** at the bottom of the run summary page. They are uploaded even when tests fail and are
   kept for 14 days.

| Artifact | Contents | How to open |
|---|---|---|
| `allure-smoke` / `allure-regression` / `allure-post-deployment` / `allure-pre-merge` (in the application repository) | `reports/allure-report/index.html` (whole report in one file) and the raw `reports/allure-results/` | Unzip and open `reports/allure-report/index.html` in a browser. Shows steps, errors, screenshots and retries |
| `playwright-smoke` / `playwright-regression` / `playwright-post-deployment` / `playwright-pre-merge` | `reports/playwright-report/` (HTML report) and `reports/test-results/` | `npx playwright show-report <unzipped>/reports/playwright-report`, or look at the files in `reports/test-results/` directly |

What is in the evidence:

| Evidence | Where |
|---|---|
| Error message and stack | Job log, Allure, Playwright report |
| Screenshot at the moment of failure (UI tests) | `reports/test-results/<test>/test-failed-1.png`, attached in Allure |
| Page structure at failure (accessibility snapshot) | `reports/test-results/<test>/error-context.md`, attached in Allure |
| API failures | The assertion error shows the expected and actual status and body fields. Setup failures (`Test setup: register ... failed with 400 ...`) include the status and the response text |
| Retries and flaky tests | Allure (retries per test), the job log (`flaky` count), `-retry1` folders in `reports/test-results/` |
| Full console log | Job log. Use **Download log archive** from the run's ⋯ menu |

3. **Reproduce locally** with the same command, adding the trace that CI does not record:
   `npx playwright test <file> --grep "<test title>" --trace on`, then `npx playwright show-trace reports/test-results/<test>/trace.zip`.

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

## 8. Application repository triggers

The application repository is `Xaoimiimii/psmusic-social-network`, a copy of the original PSMusic repository.
It is **not connected to any hosting**: Netlify and Render do not deploy from it (confirmed by the repository owner,
2026-10-09). The deployed environment (section 4.3) is whatever the original repository last deployed.

The two application workflows are kept here as templates in `ci-templates/psmusic-app/`. They do nothing in this
repository. The application repository is the system under test and is not edited from here (CLAUDE.md rule 16), so
someone with access copies them to its `.github/workflows/`.

### 8.1 Setup

One token serves both workflows. GitHub → Settings → Developer settings → **Fine-grained personal access tokens**:

- Resource owner `Xaoimiimii`, **Only select repositories** → `psmusic-playwright-automation`.
- Permissions: **Contents: Read and write**. Read is for checking out the tests, write is required by the
  `dispatches` endpoint. Nothing else.
- Set an expiration date and note it. An expired token fails both workflows with `401 Bad credentials`.

The application repository's own `GITHUB_TOKEN` cannot be used: it only reaches its own repository.

**In the application repository** (Settings → Secrets and variables → Actions):

| Name | Tab | Used by | Value |
|---|---|---|---|
| `AUTOMATION_REPO` | Variables | both | `Xaoimiimii/psmusic-playwright-automation` (not sensitive, so not a secret) |
| `AUTOMATION_REPO_TOKEN` | Secrets | both | The token above |
| `PSMUSIC_SERVICE_KEY` | Secrets | pre-merge | Same value as in this repository. It must equal `ApiSecurity__SecretValue` in the app's `docker-compose.yml` (checked equal on 2026-10-09) |
| `DB_CONNECTION` | Secrets | pre-merge | PostgreSQL connection string for the API started in CI (see 8.2 about which database) |
| `ELASTICSEARCH_APIKEY` | Secrets | pre-merge | Elasticsearch API key |
| `ELASTICSEARCH_URI` | Variables | pre-merge | Elasticsearch endpoint |
| `QA_URL` | Variables | deploy | Optional. Shown as the deployment link, for example `https://psmusic.netlify.app` |

**In this repository:** nothing new. All runs here use the existing `PSMUSIC_*` variables and secret (section 4.1).

Then copy both templates to the application repository's `.github/workflows/` and push them to `main`. To make
pre-merge validation a real gate, mark the check **Automation tests (@critical)** as required in a branch protection
rule for `main` there.

### 8.2 Application PR → pre-merge validation

`pre-merge-validation.yml`, in the application repository, on every PR to `main`:

1. Checks out the PR (GitHub's merge of the PR into `main`) and this repository's `main` into `automation/`.
2. `docker compose up --build` with the application's own `PSMusic/docker-compose.yml`: API on `http://localhost:7215`
   (`ASPNETCORE_ENVIRONMENT=Development`), web app on `http://localhost:5173`, built with
   `VITE_API_BASE_URL=http://localhost:7215/api`. The Development CORS policy allows `http://localhost:5173`.
   The compose file needs `DB_CONNECTION`, `ELASTICSEARCH_URI`, `ELASTICSEARCH_DEFAULTINDEX`, `ELASTICSEARCH_APIKEY`
   and an existing `.env` file. The workflow passes the values as environment variables and creates an empty `.env`.
3. Waits until both answer (5 minutes at most), then runs `@critical` through `automation/.github/actions/run-suite`.
4. On failure, prints the last 300 lines of the containers' logs in the job log, where secrets are masked. They are
   never uploaded as an artifact.

The job result is the PR check. Reports are artifacts of the application repository's run (`allure-pre-merge`,
`playwright-pre-merge`).

Things to know:

- **Database.** The API in CI talks to whatever `DB_CONNECTION` points to, and every run registers test users there
  (section 7). Use a test database, not one with real users. Today the only known database is the shared Neon
  database, also used by local runs (`exploration/browser/browser-unknowns.md` U-1.2).
- **Elasticsearch.** At startup the API re-indexes `songs` and `artists` from that database into the given cluster
  (`ElasticSeeder`). A CI database different from the deployed one would therefore overwrite the deployed search
  index. Use a separate cluster or index together with a separate database.
- **A-11** (logout keeps the refresh cookie) is specific to the deployed environment: TS-AUTH-11 (`@critical`)
  passes against the compose build.
- **Verified locally on 2026-10-09** with the steps of section 8.5 on a clean export of the application's `main`
  (`d1a3c44`): both images build, both containers answer within the wait step, and `@critical` with `CI=true` gives
  **29 passed, 0 unexpected** in about 1 minute (4 of them are `knownDefect()` tests: TS-AUTH-08, TS-AUTH-10
  `/favorites`, TS-PROF-02, TS-SONG-06). The workflow itself has not run on GitHub yet.

### 8.3 QA deployment → post-deployment validation

`deploy-qa.yml`, in the application repository, on every push to `main` (a merged PR) and by hand:

1. **Deploy (simulated).** Nothing is deployed, because the repository is not connected to any hosting. QA is the
   fixed deployed environment (section 4.3). When a real deployment exists, replace this step with it and keep the rest.
2. Records a GitHub deployment of the commit to environment `qa`, with status `success`. It shows under
   **Deployments** in the application repository, like a real deployment. Uses the workflow's own `GITHUB_TOKEN`
   with `deployments: write`.
3. Sends `repository_dispatch` event `psmusic-qa-deployed` to this repository with `environment`, `app_repo`,
   `app_sha` and `app_run_url`.

`post-deployment.yml` here then runs `@smoke` against `PSMUSIC_UI_URL` / `PSMUSIC_API_URL`. Its run summary starts
with *"Started by a PSMusic deployment"*: environment, commit and a link back (`scripts/write-trigger-summary.mjs`,
which drops payload values that do not look like a repository, SHA, URL or environment name). The target URLs are
never taken from the payload, so a dispatch cannot send the service key to another host.

The deploy job only starts the check and stays green when the tests fail. The result is in this repository:
Actions → **Post-deployment**. It runs `@smoke`, not `@critical`, because TS-AUTH-11 (`@critical`) fails on the
deployed environment until A-11 is fixed.

Because the deployment is simulated, a green post-deployment run says the QA environment works. It does **not** say
that the commit in the summary works: that commit was never deployed.

### 8.4 Checking that it works

1. **Post-deployment by hand:** here, Actions → **Post-deployment** → **Run workflow**. Proves the variables and the
   secret are set.
2. **Deploy to QA:** in the application repository, Actions → **Deploy to QA** → **Run workflow**. The job is green,
   **Deployments** shows `qa`, and within seconds a **Post-deployment** run starts here with the summary table.
3. **Pre-merge:** open a PR to the application's `main` with any small change. **Automation tests (@critical)** appears
   as a check. The first run takes longer because the images are built without cache.

| Symptom | Cause |
|---|---|
| *... not configured* | A variable or secret from 8.1 is missing in the application repository |
| `401 Bad credentials` | Token wrong or expired |
| `403` / `404 Not Found` on the dispatch, or *Repository not found* on the automation checkout | Token has no access to this repository, lacks **Contents: Read and write**, or `AUTOMATION_REPO` is misspelled |
| Deploy job green, no Post-deployment run here | `post-deployment.yml` is not on this repository's `main` yet, or the event name differs |
| Pre-merge: timeout in *Wait until the web app and the API answer* | A container did not start. See *Show application logs*; usually a wrong `DB_CONNECTION` or Elasticsearch value |
| Pre-merge: *PSMusic API refused the service key (401)* | `PSMUSIC_SERVICE_KEY` differs from `ApiSecurity__SecretValue` in the app's `docker-compose.yml` |

### 8.5 Running the pre-merge flow locally

Same steps as the workflow, from a clean export of the application so its working copy stays untouched. Git Bash,
Docker Desktop running, ports 5173 and 7215 free:

```bash
mkdir -p /tmp/psmusic-pr && git -C <application clone> archive HEAD | tar -x -C /tmp/psmusic-pr
cd /tmp/psmusic-pr/PSMusic && touch .env
export DB_CONNECTION='...' ELASTICSEARCH_URI='...' ELASTICSEARCH_DEFAULTINDEX=songs ELASTICSEARCH_APIKEY='...'
docker compose up --detach --build

cd <this repository>
CI=true PSMUSIC_UI_URL=http://localhost:5173 PSMUSIC_API_URL=http://localhost:7215 npx playwright test --grep @critical

cd /tmp/psmusic-pr/PSMusic && docker compose down
```

`PSMUSIC_SERVICE_KEY` comes from this repository's `.env`.

## 9. Next improvements (in this order)

1. **Get A-11 fixed** (logout on the deployed environment, section 4.3), so Regression is green there.
2. **Add ESLint** to the build job (strategy §11.1 lists it; it is not installed yet).
3. **Run `@critical` on push to `main`.** The whole suite takes about a minute locally (about two against the deployed environment), so this is cheap.
4. **Parallel workers in CI**, after checking that no tests touch the same song counters at the same time (strategy §7.4).
5. **Separate API and UI jobs or tags**, and an Allure history or published report, when the suite grows.
