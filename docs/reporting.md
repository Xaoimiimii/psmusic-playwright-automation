# Reporting (Allure)

How the Allure report is built, what each result contains, and how to extend it. CI artifacts and the run
summary are described in [`ci-cd.md`](ci-cd.md); this page is about the content of the report.

## 1. What the report answers

| Question | Where in the report |
|---|---|
| What business behavior does the test validate? | Title, **Behaviors** tree (Epic → Feature → Story), description (objective, acceptance criteria) |
| What are the preconditions? | Description (*Preconditions*), and `Precondition: …` steps under **Before Hooks** |
| What test data is used? | Parameters (`test user`), usernames in step names, request bodies in **HTTP exchange** attachments |
| What actions were performed? | Steps: the test's own `test.step` blocks and page-object actions (`Log in as "pwqa_…"`), API calls (`POST /api/auth/login`) |
| What was expected, what happened? | Description (*Expected rule*, criteria) and the error (expected vs received) |
| At which step did it fail? | The failed step; the error location points at the test line that called it |
| Likely cause? | **Categories** tab (triage hint, see §7), `failure_signal` labels, **Failure context** attachment |
| What evidence exists? | Screenshot, `error-context` (accessibility snapshot), Failure context, Browser API traffic, HTTP exchanges, trace (local only) |
| Which risk, story and Xray Test? | Links (when `ATLASSIAN_SITE_URL` is set) and description (*Risks covered*) |

## 2. Architecture

```
tests/*.spec.ts ── fixtures (src/fixtures/test.ts) ── page objects (@step) ── API clients
                     │
                     ├─ reporting (auto)      → src/reporting/allure-metadata.ts
                     │     before: Epic/Feature/Story, severity, description, links   ← src/data/test-metadata.ts
                     │     after:  layer, known_defect, failure_signal labels            (generated from the Jira/Xray plan)
                     ├─ context (UI tests)    → src/reporting/browser-evidence.ts   attached only on failure
                     ├─ request / authApi / songApi / userApi
                     │                        → src/reporting/api-reporting.ts      one step + HTTP exchange per call
                     └─ registeredUser / member → "Precondition: …" steps

src/reporting/redaction.ts         masking used by every attachment
src/reporting/test-observations.ts per-test store: failure signals, layers exercised
src/reporting/step.ts              @step decorator, attachScreenshot()
src/reporting/environment-info.ts  environment widget (read at run time)
src/reporting/clean-allure-results.ts  global setup: empty reports/allure-results/ before the run

playwright.config.ts  allure-playwright → reports/allure-results/   (detail: false, environmentInfo)
allurerc.mjs          allure generate  → reports/allure-report/index.html   (categories, local history)
```

Reporting stays out of the spec files: tests get their metadata, API evidence and failure evidence from fixtures.
Every worker runs one test at a time and workers are separate processes, so evidence never mixes between
parallel tests.

## 3. Metadata

### Where it comes from

`src/data/test-metadata.ts` is **generated** from `test-management/state/plan.json` and `issue-map.json` (the same
plan that creates the Jira/Xray issues). Do not edit it by hand:

```bash
npm run report:metadata                                        # regenerate after /plan-jira-xray or /sync-jira-xray
node scripts/test-management/export-test-metadata.mjs --check  # exit 1 if the committed file is stale
```

The `reporting` fixture finds the scenario ID (`TS-AREA-nn`) in the test title, or in an enclosing `describe`
title, and applies:

| Allure field | Value | Source in the plan |
|---|---|---|
| Epic | Functional area, e.g. `FA-02 Authentication and session` | Story's parent Epic (TECH has none and is its own Epic) |
| Feature | User story, e.g. `US-002 Log in` | Test → Story link (`testCoversRequirement`) |
| Story | Acceptance criterion, e.g. `US-002-AC-03 Valid credentials: …` | Test's *Story / AC* field, text from the story |
| Severity | High → `critical`, Medium → `normal`, Low → `minor` | Scenario priority (risk-based, `test-scenarios.md`); `blocker`/`trivial` unused |
| Description | Objective, preconditions, expected rule, criteria, risks, source | Test description |
| Links | Xray Test (`tms`), stories (`requirement`), risks (`risk`), bugs (`issue`) | Jira keys in `issue-map.json`, only with `ATLASSIAN_SITE_URL` |
| `scenario` label | `TS-AUTH-01` | Title |
| Display name | `<describe title> › <test title>` when the scenario ID is in the describe block | Title path |
| Tags | `smoke`, `critical`, `regression`, `api`, … | Playwright `tag` |
| `known-defect` tag, `known_defect` label, issue link | Reference passed to `knownDefect()` | `recordedBugs` (bug `BUG-<reference>`) |
| Layer | `UI`, `API` or `UI + API`: what the test actually exercised | Runtime (browser context created / API client called outside preconditions) |
| `failure_signal` | `backend-5xx`, `network-error`, `page-error`, on failed tests only | Runtime (§6) |

**Owner** is not set: the project records no test ownership, and an invented owner would be misleading.

### Adding metadata to a new test

1. Put the scenario ID at the start of the test title (or the `describe` title for a scenario split into cases):
   `test('TS-AUTH-09 refresh rotates the token', …)`.
2. If the scenario is new, add it to `docs/test-strategy/test-scenarios.md`, re-plan (`/plan-jira-xray`) and run
   `npm run report:metadata`.
3. Nothing else: no `allure.*` calls in the test. A test without a known scenario ID still reports, with tags only.

For a one-off value that the plan cannot provide, call the runtime API in a fixture rather than in the test body:
`import * as allure from 'allure-js-commons'; await allure.label('name', 'value');`.

## 4. Steps

`allure-playwright` runs with `detail: false`: the report shows only `test.step` blocks, page-object `@step`
actions, API call steps and attachments. Playwright's own action titles are left out on purpose:

- they would publish typed values, including passwords (`Fill "Pw-…"`), in every report;
- fixture set-up and every single `expect` made results hard to read.

The failing `expect` is still visible: its message is the test error, and the step that contains it is marked failed.
For the low-level call log, use the Playwright HTML report or a local trace.

### Page-object actions

```ts
import { step } from '../reporting/step';

@step((credentials: Credentials) => `Log in as ${shown(credentials.username)}`)
async login(credentials: Credentials): Promise<void> { … }
```

Rules:

- Name the step for what the user does, in the present tense: `Open the Favorites page`, `Click Play on the song page`.
- **Never** put a password, token or cookie value in a title. `AuthPage` shows the password length only.
- Decorate **actions** only. Queries such as `audioVolume()` or `isPlaying()` are read inside `expect.poll` and would
  add one step per poll.
- Steps are boxed: a failure inside points at the test line that called the action.

### Test-level steps

Keep using `await test.step('UI: success message, Home, signed-in header', …)` in specs to group assertions by
outcome. One level of grouping is enough; do not wrap each statement.

### Preconditions

Fixtures report set-up as steps under **Before Hooks**: `Precondition: register test user "pwqa_…" through the API`,
`Precondition: sign the browser in as "pwqa_…" through the API`. A set-up failure shows there, with the HTTP exchange.

## 5. Attachments

| Attachment | When | Content |
|---|---|---|
| **HTTP exchange** | Every call made through an API client fixture, the `request` fixture, or a precondition | Method, URL, request headers and body, status, duration, response headers and body |
| **screenshot** | UI test failed (Playwright `screenshot: 'only-on-failure'`) | Visible page at failure |
| **error-context** | Test failed (Playwright) | Accessibility snapshot of the page: what elements and text existed |
| **Failure context** | UI test did not end as expected | Open pages (URL, title), browser version and viewport, failure signals, uncaught page errors, console errors and warnings |
| **Browser API traffic** | UI test did not end as expected | Every PSMusic API call the page made, in order, with status and duration |
| **trace** | Local runs, on failure (`trace: 'retain-on-failure'`) | Playwright trace. Off in CI: it records unmasked headers and bodies |

Bodies longer than 16,000 characters are cut in the attachment (the test still reads the full response). The
recommendation tracker's load error is left out of the console list: the tests abort it on purpose.

### Attaching more evidence

- A checkpoint screenshot where the page state itself is evidence: `await attachScreenshot(page, 'Favorites after toggle')`
  (`src/reporting/step.ts`). Do not add one to every test: failures already get one.
- API calls: create clients through the fixtures (`authApi`, `songApi`, `userApi`, `request`). A new request context
  must be wrapped: `new SongApi(withApiReporting(context))`, or `withApiReporting(context, { precondition: true })` for set-up.
- Anything else: `await test.info().attach(name, { body, contentType })`, after passing text through `redactText()` /
  `redactJson()` from `src/reporting/redaction.ts`.

PSMusic exposes no request or correlation ID header (checked in the API source), so none is recorded.

### Masking

Applied to every attachment by `src/reporting/redaction.ts`:

| Data | Shown as |
|---|---|
| `X-App-Service-Key`, `X-Api-Key` | `<redacted>` |
| `Authorization` | `Bearer <redacted>` (the scheme stays: missing vs present token is visible) |
| `Set-Cookie` | `RefreshToken=<redacted>; expires=…; path=/; secure; samesite=none; httponly` (attributes stay) |
| `Cookie` | cookie names only |
| JSON fields named like `password`, `token`, `secret`, `apiKey`, `serviceKey`, `authorization`, `cookie`, `credential` | `<redacted>` |
| Any JWT (`eyJ….….…`) or the configured service key anywhere in text | `<redacted>` |

Usernames and `@example.com` emails of the generated test accounts are kept: they are synthetic and needed to
reproduce a failure. Never point the suite at an environment with real users (`ci-cd.md` §4.3).

## 6. Failure handling

- The original error and stack are never caught or replaced. Evidence is collected in fixture teardown, inside
  `try/catch`; if collection itself fails, a `Failure context (incomplete)` note is attached and the test result is unchanged.
- Browser clean-up is untouched: the evidence runs before Playwright closes the context.
- **Retries** (1 in CI): every attempt is kept. Allure groups attempts under one test (**Retries** tab, *Retried tests*
  counter), so a test that passed on retry still shows the failed attempt and its evidence. The CI run summary lists
  it as flaky. Allure 3 itself marks a test *flaky* only from history across runs, not from retries within one run (§8).
- **Known defects** (`knownDefect()` → `test.fail()`): when the defect still reproduces, Playwright counts the
  expected failure as a pass and Allure shows *passed*, with the `known-defect` tag, the bug link and the failure
  message kept. The category *Known defect still reproduces* lists them. If the defect is fixed, the test fails
  (unexpected pass) and lands in *Known defect no longer reproduces*.
- **Failure signals**: while a test runs, the API wrapper and the browser collector record 5xx responses
  (`backend-5xx`), requests that got no response (`network-error`, except `ERR_ABORTED` from SPA navigation) and
  uncaught JavaScript errors in the page (`page-error`). They become labels only if the test fails.
- **Global set-up failure** (PSMusic unreachable): no test runs; Allure shows it under **Global Errors**, and the CI run
  summary shows the message.

## 7. Categories

Defined in `allurerc.mjs`, first match wins:

| Category | Matches on |
|---|---|
| Known defect still reproduces (expected failure) | passed + `known_defect` label |
| Known defect no longer reproduces | failed + `known_defect` label |
| Flaky: failed, then passed on retry | Allure `flaky` flag (history-based, §8) |
| Environment or infrastructure | `network-error` signal, or connection/certificate/browser-launch errors |
| API / backend failure | `backend-5xx` signal, or `Received: 5xx` in an assertion |
| Application error in the page | `page-error` signal |
| Test data or set-up failure | `Test setup:` errors (thrown by `registerOrThrow`, `loginOrThrow`, `…OrThrow` helpers) |
| Automation script error | `TypeError`, `ReferenceError`, … in test code |
| Locator matches several elements | Playwright strict mode violation |
| UI element not found or not actionable | `element(s) not found`, `waiting for locator`, not visible/enabled/stable |
| Timeout | test or action timeout |
| Assertion failed: observed behavior differs | `Expected … Received` assertion |
| Unclassified failure: needs triage | anything else failed or broken |

**Limitations.** Categories are triage hints, not root causes:

- Signals come first because they record what happened, but a signal does not prove causation: a 5xx on an
  unrelated call can coexist with a locator bug.
- Error-text patterns cannot tell a wrong locator from an element the application failed to render, or a slow
  environment from a hang. Those categories are named for the symptom (`locator, synchronization or product`).
- An assertion mismatch is usually product behavior, but can be a wrong expectation in the test.
- Read the error, the failed step and the Failure context before filing a bug.

## 8. Environment and history

The **Environment** widget (`environment.properties`) is filled at run time by `src/reporting/environment-info.ts`:
PSMusic UI and API origins (no paths, no keys), execution (local or the GitHub Actions workflow and run link), the
test command, Git branch and commit (with an *uncommitted changes* note locally), bundled Chromium version,
Playwright and allure-playwright versions, Node.js and OS. No secret is ever written there.

Local reports keep history in `reports/allure-history.jsonl` (last 20 runs, git-ignored): trend charts, *new* /
*fixed* / *regressed* transitions and history-based flaky detection. CI runs start from an empty checkout, so CI
reports have no history (§10).

## 9. Commands and folders

| | |
|---|---|
| Run tests | `npm test`, `npm run test:smoke`, `npx playwright test <file>` |
| Results | `reports/allure-results/`, emptied at the start of each run by global set-up. Keep earlier results with `ALLURE_KEEP_RESULTS=1` (e.g. to combine two separate runs) |
| Generate report | `npm run allure:generate` → `reports/allure-report/index.html` (one file, opens offline) |
| Open report | `npm run allure:open`, or open the file directly |
| Regenerate metadata | `npm run report:metadata` |
| History | `reports/allure-history.jsonl`; delete it to reset trends |
| CI | Each workflow runs `npm run allure:generate` even when tests fail and uploads `allure-<suite>` (report + raw results) for 14 days. Test failures still fail the job. See `ci-cd.md` §6 |

Passing `--reporter=…` on the command line **replaces** every configured reporter, including Allure. Use
`--reporter=list,allure-playwright` if you need both, or leave the option out.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `reports/allure-results/` is empty | Ran with `--reporter=…` (see above), or global set-up failed before any test (check the console) |
| Report shows old tests | `ALLURE_KEEP_RESULTS=1` was set, or results were copied in by hand |
| No Epic / Feature / severity on a test | Title has no `TS-AREA-nn`, or the scenario is not in the plan: run `npm run report:metadata` after re-planning |
| No Jira links | `ATLASSIAN_SITE_URL` is empty (`.env` locally, repository variable in CI), or the entity has no Jira key yet |
| An API call has no HTTP exchange | The request context was created outside the fixtures and not wrapped with `withApiReporting` |
| Password visible in a step name | A step title was built from credentials; fix the `@step` title (§4) |
| `allure` command not found | Run `npm ci`; the CLI is a dev dependency (`npx allure …`) |

## 10. Known limitations and next improvements

- The **Playwright HTML report** (artifact `playwright-*`) still shows Playwright's own action titles, including the
  password typed into the login form. Only throwaway test accounts are affected; consider not uploading that report
  in CI, or uploading it only on failure.
- CI reports have no history. To get trends in CI, persist `reports/allure-history.jsonl` between runs (e.g. cache
  or a `gh-pages` branch) and restore it before `allure generate`.
- In-run retries are not flagged *flaky* by Allure 3 (history-based only). The CI run summary does list them.
- The HTTP exchange shows the headers passed by the caller, not cookies the request context adds from its jar.
- Add `node scripts/test-management/export-test-metadata.mjs --check` to the CI build job so a stale metadata file is caught.
