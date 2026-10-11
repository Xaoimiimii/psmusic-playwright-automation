---
description: Reconcile the approved plan with Jira/Xray, create or update entities in dependency order, persist mappings, verify by reading back
argument-hint: [--dry-run] [--only <type,...>] [--limit <n>]
allowed-tools: Read, Glob, Grep, Write(test-management/state/issue-map.json), Write(test-management/reports/*), mcp__atlassian-rovo__getAccessibleAtlassianResources, mcp__atlassian-rovo__discover, mcp__atlassian-rovo__executeRead, mcp__atlassian-rovo__searchJiraIssuesUsingJql, mcp__atlassian-rovo__getJiraIssue
---

# Sync plan → Jira/Xray

Arguments: `$ARGUMENTS`. `--dry-run` (recommended first) does everything except writes and reports what would
happen. `--only epic,story` restricts types. `--limit n` stops after n writes (use a small number on the first run).

Write tools (`createJiraIssue`, `editJiraIssue`, `executeWrite`) are deliberately **not** pre-approved: each write
asks for permission unless the user approves otherwise.

Reference: `docs/integrations/capability-matrix.md` (which channel for which step),
`docs/integrations/jira-cloud-rest-api.md` §4–8, `docs/integrations/xray-cloud-rest-api.md` §4–5, §9,
`docs/integrations/troubleshooting.md` (duplicates, retries), `.claude/rules/traceability-rules.md` (link only when
evidence supports it; verify direction and type; record mapping conflicts).

**Status: partially operational.** Jira steps (Epic, Story, Requirement, Risk, Bug issues, `parent`, issue links) run
through MCP. Xray steps (test type/steps, Test Set/Plan creation with membership) run through
`scripts/test-management/sync-xray.mjs` (client: `scripts/xray/xray-client.mjs`). On MSC these were blocked on 2026-10-09 until the API key was replaced. If Xray again cannot see or create issues (`project-map.json` `xray.accessBlocker`,
[troubleshooting](../../docs/integrations/troubleshooting.md#xray-authenticates-but-cannot-see-or-create-jira-issues)):
then mark those entities `creationStatus: "skipped"` with the blocker as reason and do not create Tests,
Test Sets or Test Plans as bare Jira issues (they would look complete but have no type, steps or members).

Helpers: `node scripts/test-management/build-plan.mjs [--approve]` (plan), `issue-map.mjs` (payloads, checkpoints),
`verify-jira.mjs` (compares MCP read-back with the map). Xray's search resolvers fail on MSC, so `sync-xray.mjs`
reconciles against `test-management/tmp/existing-index.json`, exported from an MCP JQL search.

## Prerequisites (stop if any fails — critical configuration)

1. `test-management/config/project-map.json` exists, `jira.projectKey` equals `JIRA_PROJECT_KEY`, and every issue
   type id the plan needs is non-null.
2. `test-management/state/plan.json` exists and has at least one `approved: true` entity.
3. Plan `sources` hashes match the current files; otherwise ask to re-run `/plan-jira-xray`.
4. A `/discover-jira-xray` report from the last 7 days with no CRITICAL items.
5. MCP authenticated; for Xray steps, `node scripts/xray/xray.mjs auth-check` succeeds.
6. If `verificationPolicy.dryRunFirst` is true, a live run (no `--dry-run`) needs a `sync-*.md` dry-run report in
   `test-management/reports/` made from the same `plan.json` (same `generatedAt` and source hashes) with no failures.
   Otherwise run the dry run instead and stop.

## Allowed

- MCP reads; MCP writes `createJiraIssue`, `editJiraIssue`, and `createJiraIssueLink` (via `discover` +
  `executeWrite`); `editJiraEntityProperty` for the `atlassian-mcp.psmusic-sync` marker.
- Xray adapter subcommands `create-test`, `update-test-definition`, `create-test-set`, `add-tests-to-set`,
  `create-test-plan`, `add-tests-to-plan` (once they exist).
- Writing `issue-map.json` and the report.

## Prohibited

- Deleting or archiving anything (`executeDestructive`, `delete*`), transitions, comments on issues, editing issues
  not mapped to an approved plan entity.
- Creating a relationship whose `project-map.json` entry has `semanticsVerified: false`.
- Writing a field not listed in `project-map.json` `fields`; guessing custom field IDs or option values.
- Retrying a create after an unknown outcome without searching first.
- Printing tokens, credentials, emails, account IDs.

## Order (dependencies first)

1. Epics → 2. Stories, Requirement (with `parent` Epic) → 3. Risks → 4. Tests (Jira issue + Xray definition) →
5. Bugs → 6. Issue links → 7. Test Sets → 8. Test Plans → 9. memberships → 10. verification.

## Per entity

1. **Reconcile.** If `issue-map.json` has a key: `getJiraIssue` it; confirm project, type and summary prefix
   (local ID). Mismatch → `FAIL`, skip, report. If no key: search
   `project = <KEY> AND issuetype = "<type>" AND summary ~ "\"<localId>\""` and check summaries start with
   `<localId> `. Exactly one → `matched` (record key + id). More than one → record all in `duplicates`, choose none,
   report for a person to decide, skip. None → create.
2. **Create** (not in `--dry-run`): set `creationStatus: "creating"` and save `issue-map.json` *before* the call.
   Call the write. On success save key + numeric id, `created`, immediately. On error or timeout: search again
   (step 1); found → `matched`; not found and error was 429/5xx → wait per backoff, retry (max 4); otherwise
   `failed` with the redacted error.
3. **Update** a matched/created entity only when its planned fields differ (compare `planHash`). Use
   `editJiraIssue`; labels via add/remove so labels added by people stay. `notifyUsers` off where available.
   Procedure (operational since 2026-10-09):
   - `node scripts/test-management/issue-map.mjs updates` lists drifted entities. For an issue that exists,
     `planHash` is the hash last written to Jira; `init` does not overwrite it.
   - For each one, `listJiraIssueChangelogs` (via `executeRead`): if anyone changed summary, description,
     labels or priority after creation, do **not** overwrite. Record a conflict for a person to resolve.
   - `getJiraIssue` for the current labels, then `issue-map.mjs update-payload <localId> <labels,csv>`. This keeps
     every current label and removes only sync-managed labels that the plan no longer lists (`MANAGED_LABEL_GROUPS`:
     automation status, priority label, smoke, story status).
   - `editJiraIssue` with that payload, read it back (JQL on the key and labels), check the Xray side with
     `sync-xray.mjs verify --only <localId>`, then `issue-map.mjs mark-updated <localId>`.
   - The Xray test type and steps are not changed by this step.
4. **Read back** with `getJiraIssue` (`view: "evidence"`): type, summary, required fields, `parent`. Set
   `verificationStatus` PASS/FAIL.

Tests: create with the Xray adapter `create-test` (GraphQL `createTest`) so test type and steps are set in one call.
For an existing Jira-only Test (created without Xray data) use `update-test-definition`, only when the plan entity says
so and the user approved converting it.

Relationships: skip if either end is not `created`/`matched`. Before creating a link, read the outward issue's
`issuelinks`; already present → `matched`. After creating, read back and confirm direction. Memberships: after
`add-tests-to-*`, read the container (`getTestSet`/`getTestPlan`) and compare the member list.

## Failure handling

- 401 / MCP not authenticated / Xray auth fails → stop the run.
- 403, 422, missing type or required field → stop the run (critical configuration); report what to fix.
- 400 on one entity → mark it `failed`, continue with entities that do not depend on it.
- More than 5 failures in a row → stop.
- Interrupted run: just run the command again; `issue-map.json` + search-before-create make it resumable.

## Output

- `test-management/state/issue-map.json` (schema `issue-map.schema.json`), saved after every operation.
- `test-management/reports/sync-<YYYYMMDD-HHmmss>.md`: mode (dry-run or live), counts per type (planned / matched /
  created / updated / skipped / failed), every write with local ID → key, every skipped relationship with the reason,
  duplicates found, verification results, follow-ups. Finish with a one-paragraph summary in the chat and the path.
