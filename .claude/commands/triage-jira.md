---
description: Failure triage phase 2 - propose Jira/Xray changes from a triage.json, then apply only the ones the user approves (link a recorded Bug to a failed test run, or create a reviewed Bug)
argument-hint: <path/to/triage.json> [--test-execution <KEY>]
allowed-tools: Read, Glob, Grep, Bash(node scripts/triage/triage.mjs:*), Bash(node scripts/triage/triage-jira.mjs plan:*), mcp__atlassian-rovo__getJiraIssue, mcp__atlassian-rovo__searchJiraIssuesUsingJql
---

# Failure triage → Jira/Xray (approved writes only)

Arguments: `$ARGUMENTS`. Reference: `docs/failure-triage.md` §7 (what is allowed), `.claude/rules/traceability-rules.md`.

`triage-jira.mjs apply` is deliberately **not** pre-approved: every apply asks for permission.

## Input

A `triage.json`: from the `playwright-<suite>` artifact of a CI run (download it from the run page; it carries the
run's Test Execution), or `reports/triage.json` after a local run imported with `xray.mjs import-junit` (then pass
`--test-execution <KEY>` from the import's answer).

## Steps

1. `node scripts/triage/triage-jira.mjs plan --triage <file> [--test-execution KEY]`. Read-only: proposals checked
   against live Jira/Xray, saved under `test-management/reports/triage-plan-<timestamp>.json`.
2. Show the user the table. For each `needs-decision` row, show the failure (error excerpt, failing step, signals,
   candidate Bugs with their relation) from `triage.json` and ask what to do with AskUserQuestion: link one of the
   candidates, create a new Bug, or skip. Never decide for the user; a reason is mandatory.
3. Re-run `plan` with one `--decide <fingerprint>=<BUG-…|KEY|new|skip>:<reason>` per decision.
4. Ask the user which `ready` proposals to apply (multiSelect). Then
   `TRIAGE_JIRA_WRITES=enabled node scripts/triage/triage-jira.mjs apply --plan <plan> --approve P…`.
5. Report every outcome. `linked` / `created` are read back; `unverified` or `error` must be investigated before any
   other write (the command stops at the first error). Tell the user to commit
   `test-management/state/triage-map.json`, `test-management/reports/triage-audit.jsonl` and the plan file.
6. For a created Bug: tell the user it is not in `docs/` or `plan.json` yet. Add it to the design documents and
   re-plan when it is confirmed; until then triage knows it through `triage-map.json`.

## Prohibited

Writing without the user's approval in this conversation; approving `needs-decision`, `blocked` or `already-done`
rows; closing, resolving, transitioning, reassigning, re-prioritizing or editing existing Bugs; creating a Bug for an
INFRASTRUCTURE_FAILURE, TEST_DEFECT or FLAKY_OR_INCONCLUSIVE failure unless the user explicitly overrides it with a
reason; running `apply` in CI.
