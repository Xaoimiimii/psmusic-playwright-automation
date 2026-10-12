# Failure triage

Classifies every failed test of a run from the evidence the framework recorded, and matches it to recorded Bugs by
stable identifiers. **Phase 1, report-only**: it never creates, edits or links a Jira issue. It runs after every test
run in CI (all suites) and locally with `npm run triage`. **Phase 2** (§7) turns a triage into Jira/Xray changes, only
those a person approves, from a local command (`/triage-jira`); CI never writes.

Code: [`scripts/triage/`](../scripts/triage/) (`collect.mjs` evidence, `classify.mjs` rules, `bug-index.mjs` Bug
matching, `triage.mjs` command). Unit tests: [`tests-unit/triage.spec.ts`](../tests-unit/triage.spec.ts).
Rules it follows: [`.claude/rules/traceability-rules.md`](../.claude/rules/traceability-rules.md).

## 1. Requirements and how they were adjusted

| Requirement | Status | Notes |
|---|---|---|
| Categories PRODUCT_DEFECT, TEST_DEFECT, INFRASTRUCTURE_FAILURE, FLAKY_OR_INCONCLUSIVE, UNKNOWN | Done | Plus a **confidence** (§2): the category alone does not say how sure it is |
| No category from a timeout, HTTP status, exception class or test name alone | Done | Every rule combines at least two facts; unit tests check each single fact stays UNKNOWN |
| Collect test ID, Xray key, failing step, assertion, stack, retries, environment, commit, CI URL, Allure URL | Done, **adjusted** | Allure has no per-test URL: the report is one file inside an artifact. Links are the CI run attempt, the artifact names, the Xray Test and the Test Execution |
| Raw outcome kept apart from the classification | Done | `raw` (Playwright status per attempt) and `xrayStatus` (what the import sends) are separate fields; no report is edited |
| Triage summary per failure | Done | Run summary, `reports/triage.md`, `reports/triage.json` |
| Search recorded Bugs before proposing one; stable identifiers, not titles | Done | §4. Source: `plan.json` / `issue-map.json` (the synced copy of Jira). The live Jira status of a Bug is not read in phase 1 |
| No duplicate Bugs for repeated failures | Done | Phase 1 creates nothing. Repeated failures are grouped (same Bug or same fingerprint) |
| Link confirmed product defects to Test and execution | Done (phase 2) | The Bug becomes a defect of the failed Xray test run; Xray then adds Jira *Defect* links to the Test and the Test Execution (§7.4) |
| Exploratory Bugs keep their provenance; no invented CI execution | Done | Provenance labels (`found-by-exploration`, `needs-confirmation`) are shown; a reproduced Bug is reported as *reproduced by this run*, never as found by it |
| Uncertain failures stay recommendations | Done | Only a reproduced known defect is *confirmed*; everything else has `reviewRequired: true` |
| Report-only first; Jira writes separately configurable and approved | Done | Phase 1 has no Jira client. Phase 2 writes need `TRIAGE_JIRA_WRITES=enabled`, an explicit `--approve` list, and refuse to run in CI |
| Never close, resolve, reassign or re-prioritize Bugs | Done | No such code; a fixed known defect gives `verify-fix`, a human acts |
| Every automated Jira mutation logged | Done (phase 2) | `test-management/reports/triage-audit.jsonl`: intent before, outcome (with read-back) after each write |
| Unit tests: classification, duplicate detection, missing evidence; fixtures before live changes | Done | 24 tests, real and synthetic fixtures (§6) |

**Changes made to support it** (the framework did not record enough evidence before):

1. **`knownDefect()` takes the Bug's local ID** (`knownDefect('BUG-A-7', …)`), type-checked against the recorded
   Bugs (`RecordedBugId` in `src/data/test-metadata.ts`). It used to take an acceptance-criterion ID, which did not
   always identify a Bug: `session.spec.ts` passed `US-003-AC-05`, which no Bug carries, so TS-AUTH-08 had no Bug
   link. The Bug ID is the stable key both Allure and triage use.
2. **New failure signal `slow-response`**: an API response, or a request still unanswered when the test failed,
   slower than `PSMUSIC_SLOW_RESPONSE_MS` (default 4000 ms). Without it, a failure like TS-AUTH-01 on the slow
   deployed API (login waiting > 5 s) could only be UNKNOWN.

## 2. Categories and confidence

| Confidence | Meaning | Review |
|---|---|---|
| `confirmed` | A recorded fact decides it. Only case: a reproduced known defect | Not required |
| `probable` | Two or more independent facts agree | Required |
| `suspected` | A plausible reading that other causes could also explain | Required |

Rules, first match wins (`classify.mjs`):

| # | Facts required | Category, confidence |
|---|---|---|
| 1 | `knownDefect(<Bug>)` reached, story assertion failed as expected, Bug recorded in the plan | PRODUCT_DEFECT, confirmed |
| 1b | Same, but the Bug ID is not in the plan | UNKNOWN |
| 1c | Known defect test passed (defect no longer reproduces) | notice `verify-fix` (not a failure) |
| 2 | Failed, then passed on retry | FLAKY_OR_INCONCLUSIVE, probable |
| 3 | Every attempt failed, but with different errors or in different steps | FLAKY_OR_INCONCLUSIVE, probable |
| 4 | `network-error` in every failed attempt **and** the error is not a wrong value from the app | INFRASTRUCTURE_FAILURE, probable |
| 5 | `slow-response` in every failed attempt **and** the error is a wait that expired | INFRASTRUCTURE_FAILURE, probable (a performance defect stays possible) |
| 6 | JavaScript exception **and** its top stack frame in `tests/` or `src/` | TEST_DEFECT, probable |
| 6b | Strict-mode violation (locator matched several elements) | TEST_DEFECT, suspected |
| 7 | Same assertion mismatch in every attempt (at least 2), same step, **and** no environment signal | PRODUCT_DEFECT, suspected |
| — | Anything else (a timeout with no signal, a 5xx, a page error, a set-up failure, one attempt only) | UNKNOWN, with the reason |

Run level (`classifyRun`): no test ran **and** global set-up stopped on its own reachability or configuration check
(messages written by `src/global-setup.ts`) → INFRASTRUCTURE_FAILURE, probable. No report at all → UNKNOWN.

**Error form** (`errorShape`): a `Received:` line means the app answered with another value
(`assertion-mismatch`), even when a polled or web-first assertion also reports its timeout; `element(s) not found` or
a test timeout means nothing was there to compare (`wait-expired`). This matters: TS-AUTH-11 on the deployed
environment is `expect.poll` with `Received: true` after 5 s, a wrong value, not a slow page.

## 3. Evidence per failure

| Field | Source |
|---|---|
| Test (title path, `tests/…:line`), scenario ID, Xray Test key | Playwright JSON report (`test_key` annotation) |
| Raw outcome: status per attempt, expected status | Playwright JSON report |
| Xray status (what the import sends) | Derived like `junit-for-xray.mjs` |
| Failing step | Deepest step with the error (`test.step` and page-object `@step`) |
| Error message (masked, cut at 1500 chars), error form, location, top 3 stack frames and their origin | Playwright JSON report |
| Failure signals per attempt, with details | Allure `failure_signal` labels; *Failure context* attachment |
| Environment, commit, CI run attempt, artifacts, Test Execution | CI variables; `reports/xray-execution.json` |

Masking (`redact`): JWTs, `Bearer`/`Basic` values, `password=`/`token=`/cookie pairs, and the configured secrets
(`PSMUSIC_SERVICE_KEY`, `JIRA_API_TOKEN`, `XRAY_*`). When evidence is missing (no error, signals not readable, no
scenario ID, an unknown Bug ID) the record lists it under `evidenceMissing` and the category stays UNKNOWN.

## 4. Matching recorded Bugs

Relations, strongest first (`bug-index.mjs`). Titles and error text are never compared.

| Relation | From | Exact? |
|---|---|---|
| `known-defect` | The test called `knownDefect(<Bug ID>)` | Yes: the failure is that Bug |
| `previous-triage` | The same fingerprint was linked to a Bug by an earlier reviewed phase-2 write (`test-management/state/triage-map.json`) | Strong candidate |
| `detected-by-test` | `bugFoundByTest` in `plan.json` (the Bug's *Detected by*) | Candidate |
| `same-criterion` | Bug and Test name the same acceptance criterion (*Story / AC* field) | Candidate |
| `same-story` | `bugAffectsStory` ∩ `testCoversRequirement` | Weak candidate |

Recommendations (`recommend`): `reuse-existing-bug` (exact), `review-existing-bug` (candidates exist),
`review-propose-bug` (suspected product defect, nothing related: a person drafts the Bug),
`check-environment`, `fix-test`, `investigate-flakiness`, `review-evidence`, `verify-fix`. There is no
`create-bug`.

**Fingerprint** (16 hex): Xray key or scenario + failing step + error signature (numbers, quoted values, URLs
removed). Failures sharing a fingerprint or an exact Bug are grouped under *Same cause in this run*.

## 5. Output

| Where | What |
|---|---|
| GitHub run summary | *Failure triage (report-only)*: counts, one table row per failure, details per failure |
| `reports/triage.json` | Records (schema below), in the `playwright-<suite>` artifact |
| `reports/triage.md` | The summary as a file, same artifact |

`triage.json`: `{ schemaVersion, mode: "report-only", generatedAt, run, runErrors, runClassification, counts,
reviewRequired, failures[], notices[], groups[] }`. Each failure: `id, location, titlePath, scenarioId, xrayTestKey,
knownDefect, raw, xrayStatus, attempts[], fingerprint, classification { category, confidence, reviewRequired,
reasons, evidenceMissing }, bugMatch { match, bugs[] }, recommendation { action, text }, links`.

Locally after a run: `npm run triage` (prints the summary, writes both files).

## 6. Verification (2026-10-12)

`npm run test:unit` (also in the CI build job): 36 tests (24 phase 1, 12 phase 2 with an in-memory Jira/Xray) over

- **a real run** (`tests-unit/fixtures/deployed-run/`): auth, profile and song specs in CI mode against the deployed
  environment, reduced to the 5 failing / known-defect tests; paths and test user names replaced, screenshots and
  HTTP exchanges removed;
- **synthetic outcomes**, one per rule and per missing-evidence case.

Triage of that real run:

| Test | Raw → Xray | Category | Recorded Bug | Recommendation |
|---|---|---|---|---|
| TS-PROF-02 | expected failure → FAILED | PRODUCT_DEFECT, confirmed | BUG-US-023-AC-03 (MSC-91), known-defect | Reuse, no new Bug |
| TS-SONG-06 | expected failure → FAILED | PRODUCT_DEFECT, confirmed | BUG-US-011-AC-06 (MSC-83), known-defect | Reuse, no new Bug |
| TS-AUTH-11 | failed, failed → FAILED | PRODUCT_DEFECT, suspected | BUG-A-11 (MSC-93), detected-by-test | Check MSC-93 first |
| TS-AUTH-08 | failed, failed → FAILED | PRODUCT_DEFECT, suspected | BUG-A-7 (MSC-92), detected-by-test | Check MSC-92 first |
| TS-AUTH-10 (/favorites) | failed, failed → FAILED | PRODUCT_DEFECT, suspected | BUG-US-004-AC-01 (MSC-79) detected-by-test; BUG-A-11 same story | Check both |

The three suspected ones are the known deployed-environment defect A-11 (`exploration/browser/authentication.md`
§10): triage points at the right recorded Bug without confirming it, which is the intended behavior. No live
`slow-response` case was observed that day (the API was warm); that rule is covered by synthetic fixtures only.

## 7. Phase 2: approved Jira/Xray changes

Code: [`scripts/triage/proposals.mjs`](../scripts/triage/proposals.mjs) (proposals, Bug draft; pure),
[`jira-actions.mjs`](../scripts/triage/jira-actions.mjs) (live checks, writes, read-back),
[`triage-jira.mjs`](../scripts/triage/triage-jira.mjs) (command). Claude Code: `/triage-jira <triage.json>`.
Unit tests: [`tests-unit/triage-jira.spec.ts`](../tests-unit/triage-jira.spec.ts).

### 7.1 Workflow

1. **Input**: a `triage.json`. From CI: the `playwright-<suite>` artifact of the run (it names the run's Test
   Execution). Locally: `reports/triage.json` after `xray.mjs import-junit`, with `--test-execution <KEY>`.
2. **Plan** (read-only): `npm run triage:jira -- plan --triage <file> [--test-execution KEY] [--decide …]`. Each
   failure becomes one proposal, checked against live Jira/Xray, saved as
   `test-management/reports/triage-plan-<timestamp>.json` and printed.
3. **Decide**: for `needs-decision` rows the reviewer adds `--decide <fingerprint>=<BUG-…|KEY|new|skip>:<reason>`
   and plans again. The reason is mandatory and goes into the audit log.
4. **Apply**: `TRIAGE_JIRA_WRITES=enabled npm run triage:jira -- apply --plan <plan> --approve P2,P5`. Each approved
   proposal is checked again, written, read back and audited. The command stops at the first error.
5. **Commit** `test-management/state/triage-map.json`, `test-management/reports/triage-audit.jsonl` and the plan.

### 7.2 Proposals

| Type | When, without a reviewer decision | Write |
|---|---|---|
| `link-defect` | A reproduced known defect (confirmed), or the same fingerprint linked before (`previous-triage`) | `addDefectsToTestRun` on the failed test run |
| `create-bug` | Never: only `--decide <fp>=new:<reason>` | Bug (REST v2, wiki markup) labelled `found-by-automation`, `needs-confirmation`, `triage-<fingerprint>`; *Relates* link to each story the Test covers; then `addDefectsToTestRun` |

| Status | Meaning | Can be approved |
|---|---|---|
| `ready` | Checks passed | Yes |
| `needs-decision` | Suspected or unknown, with candidate Bugs listed | No |
| `skipped` | Infrastructure, test or flaky failure, a notice, or a reviewer `skip` | No |
| `blocked` | No Xray key or Test Execution, no test run, Bug not in Jira, Bug *Done* (a possible regression: decide by hand), not a Bug, or several Bugs with the same fingerprint label | No |
| `already-done` | Recorded in `triage-map.json` for this execution, or the Bug is already a defect of the run | No |

A Bug draft holds only facts from the triage record: test, Xray key, failing step, attempts, environment, commit,
Test Execution, CI link, an 8-line masked assertion excerpt, the automated classification and the reviewer's reason.
No priority, assignee or screenshots. A `create-bug` repeated after an interruption finds the Bug by its
`triage-<fingerprint>` label and links it instead of creating a second one.

### 7.3 Safety

- Writes only with `TRIAGE_JIRA_WRITES=enabled` and an `--approve` list; `apply` exits in CI (`GITHUB_ACTIONS`).
- Live checks run at plan time **and** again right before each write.
- Never: close, resolve, transition, reassign, re-prioritize, or edit an existing Bug's fields, description or
  provenance. A linked exploratory Bug keeps `found-by-exploration`; the run is added as evidence, not as its origin.
- Audit (`triage-audit.jsonl`, append-only, committed): `at`, `actor` (git user name, not an e-mail), `phase`
  (`intent` / `outcome` / `error`), operation, targets, decision, `verified`. An `intent` without an `outcome`
  marks an interrupted write to check before retrying.
- State (`triage-map.json`): fingerprint → Bug and the runs it was linked for. Read by phase 1 (`previous-triage`)
  and by phase 2 (`already-done`). A Bug created by triage is known there until it is added to `docs/` and the plan.

### 7.4 Verified live (2026-10-12)

TS-PROF-02 and TS-AUTH-11 run in CI mode against the deployed environment, imported with `xray.mjs import-junit`
→ Test Execution **MSC-233** (both runs FAILED; TS-PROF-02 is the reproduced known defect BUG-US-023-AC-03).

- `plan`: P1 TS-AUTH-11 `needs-decision` (suspected, candidates MSC-93, MSC-79), P2 TS-PROF-02 `ready` (test run
  FAILED, MSC-91 *To Do*). Only P2 was applied: the TS-AUTH-11 decision belongs to a reviewer.
- `apply --approve P2`: outcome `linked`, read back. Independent Xray query: the MSC-119 run in MSC-233 has
  `defects: ["10318"]` (MSC-91); the MSC-111 run is untouched. MSC-91's status, priority, assignee and description
  are unchanged.
- **Xray adds the Jira links itself**: MSC-91 gained *Defect* links "created by" MSC-119 (Test) and MSC-233 (Test
  Execution). That is where a reviewer sees them: the Bug's *Linked work items* section, and the test run's
  *Defects* section in the Test Execution. Phase 2 therefore creates no Jira link of its own for `link-defect`.
- `plan` again: P2 `already-done`. Audit: one `intent` and one `outcome` (`verified: true`) line.
- **Not exercised live**: `create-bug` (no reviewed new defect existed; covered by unit tests with fakes only).

## 8. Limitations

- The classification is decision support. A suspected product defect can still be a wrong expectation, test data or
  environment configuration; that is why it is never confirmed automatically.
- Signals are recorded per test, not per request the assertion depended on: a slow call unrelated to the failing
  step still counts. Rule 5 needs it in **every** failed attempt to reduce that risk.
- Bug matching uses the plan's copy of Jira. A Bug created directly in Jira and not synced is invisible to it.
- Flaky detection is within one run (retry); history across runs is not kept in CI.
