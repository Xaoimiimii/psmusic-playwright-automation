# Capability matrix: Atlassian MCP vs Xray API vs Jira REST

Research date 2026-10-09. "MCP tool" names come from the official supported-tools page
(https://developer.atlassian.com/cloud/rovo-mcp/guides/supported-tools/) and, where marked **live**, were also
returned by the MCP server's `discover` or executed read-only against the project's site on 2026-10-09.

Rule: use **Atlassian MCP** for standard Jira operations it supports; use the **Xray API** (GraphQL v2 or the
import endpoints) for Xray data; use **Jira REST** only as a fallback when MCP is unavailable (for example in CI,
where no interactive OAuth sign-in exists).

There is **no Xray MCP server** configured in this repository, and the Atlassian MCP catalog has no Xray tools
(live: `discover` for Xray test/test set/test plan/test execution operations returned none).

| # | Capability | Atlassian MCP tool (support) | Xray API | Jira REST fallback | Auth / permission | Still unverified |
|---|---|---|---|---|---|---|
| 1 | Read a work item | `getJiraIssue` (primary; live) | `getTest`, `getTestSet`, … return Xray data for Xray types | `GET /rest/api/3/issue/{issueIdOrKey}` | MCP: `read:jira:agent-interface`; REST: `read:jira-work`; *Browse projects* | — |
| 2 | Search work items | `searchJiraIssuesUsingJql` (primary; live) | `getTests(jql:…)`, `getCoverableIssues(jql:…)` | `POST /rest/api/3/search/jql` (`/rest/api/3/search` is being removed) | MCP: `search:jira:agent-interface` | — |
| 3 | List projects | `listJiraProjects` (live) | — | `GET /rest/api/3/project/{projectIdOrKey}` | *Browse projects* | — |
| 4 | List work item types of a project | `listJiraProjectIssueTypesMetadata` (live) | — | `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` | *Create issues* | — |
| 5 | Field metadata for a type (required fields, custom field IDs) | `getJiraIssueTypeMetaWithFields` (live, `requiredFieldsOnly:false` for all) | — | `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` | *Create issues* | — |
| 6 | List issue link types | `listJiraIssueLinkTypes` (live) | `getIssueLinkTypes` | `GET /rest/api/3/issueLinkType` | *Browse projects* | — |
| 7 | Create Epic / Story / Bug / Risk / Requirement | `createJiraIssue` (primary; documented) | — | `POST /rest/api/3/issue`, bulk `POST /rest/api/3/issue/bulk` (≤ 50) | MCP: `write:jira:agent-interface`; REST: `write:jira-work`; *Create issues* | Not executed here (no writes in this task) |
| 8 | Update fields | `editJiraIssue` (primary; sets, does not append, multi-value fields) | — | `PUT /rest/api/3/issue/{issueIdOrKey}` | *Edit issues* | Not executed |
| 9 | Parent-child (Epic → Story) | `createJiraIssue` / `editJiraIssue` with `parent` (documented in REST spec; MCP passes Jira fields) | — | `fields.parent: {"key": "…"}` on create/edit | *Edit issues* on the child | `parent` is on the MSC Story create screen (live); setting one via MCP not executed yet |
| 10 | Issue links (Relates, Blocks, Test, Defect …) | `createJiraIssueLink` (deferred; run via `executeWrite`; documented) | — | `POST /rest/api/3/issueLink` | *Link issues* on the outward issue | Not executed. Semantics of `Test`/`Defect` link types for Xray coverage: check `getProjectSettings.testCoverageSettings` |
| 11 | Create Xray Test with test type and steps | **Not supported** (only a Jira issue of type Test) | `createTest(testType, steps, unstructured, gherkin, jira)`; bulk `POST /api/v2/import/test/bulk` | Jira create gives the issue only; type/steps are Xray data | Xray API key | Whether a Jira-created Test gets the project's default test type: UNVERIFIED |
| 12 | Change test type / steps of an existing Test | **Not supported** | `updateTestType`, `addTestStep`, `updateTestStep`, `updateUnstructuredTestDefinition` | — | Xray API key | — |
| 13 | Create Test Set / Test Plan / Test Execution issue | `createJiraIssue` creates the Jira issue only | `createTestSet`, `createTestPlan`, `createTestExecution` (can attach tests in the same call) | `POST /rest/api/3/issue` (issue only) | Xray API key (Xray) or MCP write scope (issue only) | — |
| 14 | Add Tests to a Test Set / Test Plan / Test Execution | **Not supported** | `addTestsToTestSet`, `addTestsToTestPlan`, `addTestsToTestExecution`, `addTestExecutionsToTestPlan` | — | Xray API key | — |
| 15 | Import automated results | **Not supported** | `POST /api/v2/import/execution/junit` (also `/testng`, `/nunit`, `/xunit`, `/robot`, `/cucumber`, `/behave`, Xray JSON `/import/execution`) | — | Xray API key | — |
| 16 | Verify Xray membership / coverage | **Not supported** | `getTestSet{tests}`, `getTestPlan{tests}`, `getTestExecution{tests}`, `getTestRuns`, `getCoverableIssues` | — | Xray API key | — |
| 17 | Verify Jira hierarchy and links | `getJiraIssue` (`view: "evidence"` returns `issuelinks` and `parent`; live) | — | `GET /rest/api/3/issue/{key}?fields=parent,issuelinks` | *Browse projects* | — |
| 18 | Store sync markers on an issue | `editJiraEntityProperty` / `getJiraEntityProperty` (key must start with `atlassian-mcp.`) | — | `PUT/GET /rest/api/3/issue/{key}/properties/{propertyKey}` (≤ 32 768 chars) | *Edit issues* | Not executed |
| 19 | Delete anything | `deleteJiraIssue` exists but the `delete_jira` group is **disabled by default** and needs admin enablement | `deleteTest`, `deleteTestSet`, … | `DELETE /rest/api/3/issue/{key}` | — | **Prohibited by every command in this repo** |

## Consequences for the commands

- `/sync-jira-xray` creates Epics, Stories, Risks, Bugs, parents and Jira links with MCP. For Tests it uses Xray
  `createTest` when the adapter exists; otherwise it stops at "Test issue planned, Xray definition pending" and
  never pretends the Test is fully configured.
- `/verify-jira-xray` can mark Jira-side checks PASS/FAIL today; Xray-side checks are UNVERIFIED until the adapter
  exists and credentials are present.
- `/import-xray-results` has no MCP path at all.
