---
description: Read-only audit of Jira/Xray entities and relationships against the plan and issue map; PASS/FAIL/UNVERIFIED report
argument-hint: [--only <type,...>]
allowed-tools: Read, Glob, Grep, Write(test-management/reports/*), mcp__atlassian-rovo__getAccessibleAtlassianResources, mcp__atlassian-rovo__discover, mcp__atlassian-rovo__executeRead, mcp__atlassian-rovo__searchJiraIssuesUsingJql, mcp__atlassian-rovo__getJiraIssue
---

# Verify Jira/Xray (read-only)

Arguments: `$ARGUMENTS` — optional type filter.

Reference: `docs/integrations/capability-matrix.md` rows 16–17, `docs/integrations/xray-cloud-rest-api.md` §7,
`docs/integrations/troubleshooting.md` "Relationships that cannot be verified", `.claude/rules/traceability-rules.md`
(a planned link never counts as an existing link).

**Status: partially operational.** Jira checks run through MCP. Xray checks (test type, steps, Test Set membership,
Test Plan scope, Test Execution runs) need `scripts/xray/xray.mjs` read subcommands (`get-tests`, `get-test-set`,
`get-test-plan`) and Xray credentials; without them each such check is **UNVERIFIED** with that reason.

## Prerequisites

`test-management/state/plan.json`, `test-management/state/issue-map.json`, `test-management/config/project-map.json`.
If `issue-map.json` is missing, audit by searching for local-ID summaries and say the map is missing.

## Allowed

Read-only MCP calls; Xray adapter read subcommands; writing the report. **Never** update `issue-map.json` (report
proposed corrections instead), never call a write tool.

## Prohibited

Any create, edit, link, transition, comment, delete, Xray mutation, or result import.

## Checks (each → PASS, FAIL or UNVERIFIED with evidence)

1. **Existence:** every mapped key exists (`getJiraIssue`), is in the project, and its current key equals the mapped
   key (moved issues return a different key).
2. **Type:** issue type id equals `project-map.json` for the entity type.
3. **Identity:** summary starts with `<localId> `; numeric id equals `jiraId`.
4. **Required fields:** every field required by `project-map.json` has a value.
5. **Hierarchy:** Story/Requirement `parent` equals the planned Epic's key.
6. **Issue links:** each planned link exists with the right type and direction (read `issuelinks` on both ends).
   Links with `semanticsVerified: false` → UNVERIFIED, not FAIL.
7. **Xray test definition:** test type and step count equal the plan.
8. **Test Set membership / Test Plan scope:** container members equal the planned members (missing and unexpected).
9. **Coverage:** every approved in-scope Story has at least one Test linked by the coverage link type, and every P1
   Risk a linked mitigation Test, or a documented gap/exception in `plan.json`; list the rest. Existence of a Test
   does not make a Risk "mitigated".
10. **Duplicates:** JQL per type for summaries starting with each local ID; more than one issue → FAIL, list keys.
11. **Orphans:** issues in the project with a local-ID summary prefix but not in `issue-map.json`.
12. **Drift:** plan `sources` hashes vs current files.

## Output

`test-management/reports/verify-<YYYYMMDD-HHmmss>.md`: totals PASS/FAIL/UNVERIFIED per check, a table of FAIL items
(local ID, key, check, expected, actual), UNVERIFIED items with the reason, duplicates and orphans, proposed
`issue-map.json` corrections. Print the totals and the path.

## Failure handling

MCP unauthenticated → stop. A single read fails twice → that check UNVERIFIED, continue. Search index lag: if a
just-created issue is missing from JQL, read it by key before marking FAIL.
