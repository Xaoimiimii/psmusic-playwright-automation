# scripts/

Node.js helpers around the test suite. None of them is a test: they summarize CI runs, generate data files the
tests read, and sync with Jira/Xray. Each file also explains itself in its header comment.

```
scripts/
├── ci/               GitHub Actions run summaries
├── test-management/  plan → Jira/Xray sync, and the data files generated from the plan
└── xray/             Xray Cloud command line and client
```

**Jira/Xray writes** = changes something outside this repository.

## `ci/`: CI helpers

Called by the workflows; you rarely run them by hand.

| File | What it does | When it runs | Jira/Xray writes |
|---|---|---|---|
| `ci/write-ci-summary.mjs` | Reads `reports/test-results.json` and writes the summary on the GitHub run page: totals, failed tests with their error, flaky tests, known defects. Masks tokens. Never fails the job | After every test run in CI (`.github/actions/run-suite`). Locally: `node scripts/ci/write-ci-summary.mjs "Smoke tests"` prints it | No |
| `ci/write-trigger-summary.mjs` | Writes which application deployment started the run (repo, commit, link, environment) at the top of the run summary. Drops values that look wrong | `post-deployment.yml`, when started by the app's *Deploy to QA* | No |
| `ci/xray-execution.mjs` | `import`: creates the run's Xray Test Execution (one per suite and run attempt, label `ci-<suite>-<runId>-<attempt>`; reused if it exists; `[NOT RUN]` when no test ran), reads it back, adds its key to the Allure environment. `link`: adds Web links to the CI run attempt and the Allure / Playwright artifacts, reads them back. Never fails the job ([`docs/ci-cd.md`](../docs/ci-cd.md) §9) | run-suite with `xray-import: 'true'` (Regression, Post-deployment) | **Yes** (Xray import, Jira Web links) |

## `test-management/`: generated data files

Turn the Jira/Xray plan into TypeScript files the tests import. Re-run them after the plan changes, then commit the
output. CI runs both with `--check` and fails the build if a committed file is out of date.

| File | What it does | When to run | Jira/Xray writes |
|---|---|---|---|
| `test-management/export-test-metadata.mjs` | `plan.json` + `issue-map.json` → `src/data/test-metadata.ts`: for each scenario, its functional area, user story, acceptance criteria, risks, priority and bugs. The reporting fixture uses it for Allure Epic / Feature / Story, severity, description and links | `npm run report:metadata`, after `/plan-jira-xray` or `/sync-jira-xray` | No |
| `test-management/export-test-keys.mjs` | `issue-map.json` → `src/data/xray-test-keys.ts`: scenario ID → Xray Test key. Lets imported JUnit results attach to the existing Xray Tests | `npm run xray:keys`, after a `/sync-jira-xray` that created Tests | No |
| `test-management/jira-export.mjs` | Test-design Markdown (strategy, stories, risks, scenarios) → CSV import files in `docs/jira-import/` | `npm run jira:export`; also called by `build-plan.mjs` | No |

## `test-management/`: Jira/Xray sync

Used by the Claude commands `/plan-jira-xray`, `/sync-jira-xray` and `/verify-jira-xray` (`.claude/commands/`).
Run the commands, not these files directly. Flow: **plan → sync → verify → regenerate data files**.

| File | What it does | Used by | Jira/Xray writes |
|---|---|---|---|
| `test-management/build-plan.mjs` | Builds `test-management/state/plan.json`: every Epic, Story, Risk, Bug, Test, Test Set, Test Plan and link that should exist. Parsing reuses `jira-export.mjs` | `/plan-jira-xray` | No |
| `test-management/issue-map.mjs` | Keeps `test-management/state/issue-map.json` (local ID → Jira key, status). Saves each outcome right away, so an interrupted sync resumes without creating duplicates | `/sync-jira-xray` | No (Jira writes go through Atlassian MCP) |
| `test-management/sync-xray.mjs` | Creates Xray Tests (type, steps), Test Sets and Test Plans, adds their members, reads them back | `/sync-jira-xray` | **Yes** (Xray) |
| `test-management/verify-jira.mjs` | Compares what Jira returns with the plan and the map; records PASS / FAIL per issue and link | `/verify-jira-xray` | No |

## `xray/`: Xray adapter

| File | What it does | How it is used | Jira/Xray writes |
|---|---|---|---|
| `xray/xray.mjs` | Command line for Xray Cloud: `auth-check`, read-only queries, `prepare-junit` (dry run of an import) and `import-junit` (uploads `reports/xray-report.xml` as a Test Execution) | `node scripts/xray/xray.mjs <command>`; also by `sync-xray.mjs` | **Yes** for `import-junit` and the `create-*` / `add-*` commands |
| `xray/xray-client.mjs` | Library only: Xray login, GraphQL calls with retry, hiding secrets in output | Imported by `xray.mjs`, `sync-xray.mjs` and `ci/xray-execution.mjs` | — |
| `xray/jira-client.mjs` | Library only: Jira Cloud REST with API token (CI has no MCP): search, read an issue, read and upsert Web links | Imported by `ci/xray-execution.mjs` | — |
| `xray/junit-for-xray.mjs` | Fixes known-defect results before upload: Playwright counts a reproduced defect as passed, Xray must show it FAILED; a fixed one becomes PASSED with a review comment | Called by `xray.mjs prepare-junit` / `import-junit` | No |

## Credentials

Scripts that reach Jira/Xray read `ATLASSIAN_*`, `JIRA_*` and `XRAY_*` from `.env` (see `.env.example`). The
generators and CI helpers need no credentials. More: [`docs/runbook.md`](../docs/runbook.md) (what to run when),
[`test-management/README.md`](../test-management/README.md) (sync details).
