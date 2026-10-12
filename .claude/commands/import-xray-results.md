---
description: Import Playwright JUnit results into Xray and verify the resulting Test Execution (SCAFFOLD — not executable yet)
argument-hint: <path/to/junit.xml> [--test-exec <KEY>] [--test-plan <KEY>] [--dry-run]
allowed-tools: Read, Glob, Grep, Write(test-management/reports/*)
---

# Import automated results into Xray

Arguments: `$ARGUMENTS`.

Reference: `docs/integrations/xray-cloud-rest-api.md` §6 (endpoints, JUnit mapping, Playwright reporter) and §7
(verification), `docs/integrations/authentication-and-security.md` §3 and §6.

## Status: SCAFFOLD — NOT EXECUTABLE

Missing pieces (do not work around them):

Update 2026-10-12: the pieces this scaffold waited for now exist: `xray.mjs import-junit` / `get-test-execution`,
the `junit` reporter with `test_key` annotations, and local Xray credentials. CI imports through
`scripts/ci/xray-execution.mjs` (docs/ci-cd.md §9). This command itself has not been rewritten to use them yet:
until it is, use the CLI (`docs/runbook.md`) or CI, and treat the steps below as the checklist they follow.

When invoked while any piece is missing: check which ones are missing, write the report saying so, and stop. Do not
upload with `curl` by hand as a substitute.

## Prerequisites (when operational)

- A JUnit XML produced by Playwright's `junit` reporter with `embedAnnotationsAsProperties: true`.
- `test-management/state/issue-map.json` with the Tests' keys; `project-map.json` with `jira.projectKey`.

## Validation before upload (all must pass; otherwise stop)

1. File exists, parses as XML, has at least one `<testcase>`.
2. `projectKey` = `project-map.json` `jira.projectKey`.
3. Every `<testcase>` has a `test_key` property; every key is in `issue-map.json` as a `test` entity of this project
   and exists in Jira (`getJiraIssue`). Test cases without `test_key` would be matched by Generic definition or
   **create new Tests** (xray doc §6.2) — list them and stop unless the user explicitly accepts that.
4. Mapped Tests' Xray test type is compatible (Generic, or the behavior for other types was verified — see §6.2).
5. `--test-exec` / `--test-plan` keys, if given, exist and have the Test Execution / Test Plan type.
6. The report contains no secrets (scan for the redaction patterns in authentication-and-security.md §6).

## Allowed (when operational)

`xray.mjs import-junit` → `POST /api/v2/import/execution/junit?projectKey=…[&testExecKey=…][&testPlanKey=…]`
(or `/junit/multipart` when Test Execution fields must be set); Xray read queries; MCP reads.

## Prohibited

Importing to a project other than the configured one; deleting or resetting test runs; editing Tests; uploading
evidence files that were not reviewed; reporting success from the HTTP status alone.

## Verification after upload

1. Response gives the Test Execution `key` and `id`; read it with `getJiraIssue` (type = Test Execution).
2. Xray `getTestExecution(issueId)` `tests(limit: 100)` (page through all): set of Tests equals the set of `test_key`s.
3. Test run statuses equal the JUnit outcomes (failure/error → FAIL, skipped → TODO, else PASS).
4. No Tests created in the last minutes that are not in `issue-map.json` (`getTests(jql: "project = … AND created >= -15m")`).
5. If `--test-plan` was given, the execution is in the plan (`getTestPlan`).

Any mismatch → result FAIL even though the upload returned 200.

Failed tests are not automatically product defects (`.claude/rules/traceability-rules.md`): the report classifies
each failure as product defect, test-script defect, environment failure, third-party outage, or known defect
(`knownDefect()` in `src/support/known-defect.ts`) where the evidence allows, and never creates or links Bugs itself.

## Output

`test-management/reports/import-<YYYYMMDD-HHmmss>.md`: input file and counts, validation results, Test Execution key,
per-test expected vs actual status, unexpected Tests, final PASS/FAIL/NOT RUN with reason.

## Failure handling

401 → re-authenticate once, then stop. 400 → stop, report the message. 429/5xx → do **not** re-upload automatically
(the first upload may have created an execution): search for a Test Execution created in the last 15 minutes first.
