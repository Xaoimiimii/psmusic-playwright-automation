---
description: Read-only discovery of Jira/Xray configuration for a project; writes a configuration report
argument-hint: <PROJECT_KEY>
allowed-tools: Read, Glob, Grep, Write(test-management/reports/*), mcp__atlassian-rovo__getAccessibleAtlassianResources, mcp__atlassian-rovo__atlassianUserInfo, mcp__atlassian-rovo__discover, mcp__atlassian-rovo__executeRead, mcp__atlassian-rovo__searchJiraIssuesUsingJql, mcp__atlassian-rovo__getJiraIssue
---

# Discover Jira/Xray configuration (read-only)

Target project: `$ARGUMENTS` (if empty, use `JIRA_PROJECT_KEY` from `.env`; if both are empty, stop and ask).

Reference: `docs/integrations/capability-matrix.md`, `docs/integrations/jira-cloud-rest-api.md` §3,
`docs/integrations/xray-cloud-rest-api.md` §8. Previous results: `docs/integrations/site-discovery-*.md`.

**Status:** Jira part operational through MCP. Xray part needs `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET` **and** the
not-yet-built adapter `scripts/xray/xray.mjs`; until then report every Xray item as UNVERIFIED.

## Prerequisites

- `atlassian-rovo` MCP connected and authenticated (`/mcp`).
- Optional: `test-management/config/project-map.json` to compare against.

## Allowed

Read-only MCP calls only: `getAccessibleAtlassianResources`, `atlassianUserInfo`, `discover`, `executeRead`,
`searchJiraIssuesUsingJql`, `getJiraIssue`. Reading repo files. Writing the report file.
If the adapter exists: `node scripts/xray/xray.mjs auth-check | project-settings` (read-only subcommands only).

## Prohibited

`createJiraIssue`, `editJiraIssue`, `transitionJiraIssue`, `addOrEditJiraIssueComment`, `executeWrite`,
`executeDestructive`, any Xray mutation or import, any write to `project-map.json` or `issue-map.json`.
Do not call an operation name that `discover` did not return. Do not print tokens, emails or account IDs.

## Steps

1. `getAccessibleAtlassianResources` once; keep the `cloudId` in memory only. Confirm Jira access is `read-write`.
2. `discover` for: "create xray test", "add tests to test set", "import test execution results". Record whether any
   Xray operation exists (expected: none).
3. `executeRead listJiraProjects`: record key, id, `style` for the target project. Stop if it is not found.
4. `executeRead listJiraProjectIssueTypesMetadata` for the project: record every type id/name/subtask flag. Flag
   missing Epic, Story, Bug, Risk, Test, Test Set, Test Plan, Test Execution as **CRITICAL**.
5. For each type the plan uses: `executeRead getJiraIssueTypeMetaWithFields` with `requiredFieldsOnly: false`.
   Record required fields and custom fields with `schema.custom`. Mark look-alike Xray fields (plain
   `textfield`/`textarea` named Test Type, Action, Data, Expected Result) as **not Xray data**.
6. `executeRead listJiraIssueLinkTypes`: record id, name, inward, outward.
7. Existing data: `searchJiraIssuesUsingJql` with `searchResultMode: "count"` per issue type; list summaries that start
   with a local ID (`US-`, `FA-`, `PR-`, `TR-`, `TS-`) and report local IDs that map to more than one issue.
8. Sample one Story and one Test with `getJiraIssue` `view: "evidence"`: record whether `parent` and `issuelinks`
   are populated.
9. Xray (only if the adapter exists and credentials are set): `auth-check`, then `project-settings`; record test
   types, default test type, coverable issue types, coverage link type and direction, defect issue types.
10. Compare with `project-map.json` if present; list every difference.

## Output

`test-management/reports/discover-<YYYYMMDD-HHmmss>.md` with sections: Summary (OK / CRITICAL issues), MCP
capabilities, Project, Issue types, Fields per type, Link types, Existing data and duplicates, Xray settings
(or UNVERIFIED + reason), Differences from project-map.json, Proposed project-map.json values (each with the call
that verified it). Then print a short summary and the report path.

## Failure handling

- MCP unauthenticated → stop, tell the user to run `/mcp`.
- Project not found / no permission → stop, report.
- A single read fails → retry once with corrected input, then record it as UNVERIFIED and continue.
