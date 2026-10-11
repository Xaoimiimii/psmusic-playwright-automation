# Jira Cloud and Xray Cloud integration

How this repository's testware (Epics, Stories, Risks, Bugs, Xray Tests, Test Sets, Test Plans, Test
Executions) is planned locally, created in Jira/Xray, verified, and kept in sync.

Research date for every document in this folder: **2026-10-09**. Every API operation cites an official source.
Where a fact was also confirmed with a real read-only request against the project's Jira site, it is marked
**VERIFIED (live)**. Anything not confirmed either way is marked **UNVERIFIED** with what to check.

## Documents

| Document | Contents |
|---|---|
| [capability-matrix.md](capability-matrix.md) | Which operation goes through Atlassian MCP, Xray GraphQL, or a REST fallback |
| [jira-cloud-rest-api.md](jira-cloud-rest-api.md) | Jira Cloud REST v3: create, metadata, parent, links, search, limits, retries |
| [xray-cloud-rest-api.md](xray-cloud-rest-api.md) | Xray Cloud: authentication, GraphQL v2, test import, result import, verification |
| [authentication-and-security.md](authentication-and-security.md) | OAuth for MCP, API tokens, Xray API keys, environment variables, redaction |
| [troubleshooting.md](troubleshooting.md) | Symptoms, causes and fixes for MCP, Jira and Xray failures |

Related, outside this folder:

| Path | Purpose |
|---|---|
| [`../../.claude/commands/`](../../.claude/commands/) | Claude Code commands: `discover-`, `plan-`, `sync-`, `verify-jira-xray`, `import-xray-results` |
| [`../../.claude/rules/traceability-rules.md`](../../.claude/rules/traceability-rules.md) | Coverage, risk, defect and repeatability rules every command applies |
| [`../../test-management/config/project-map.example.json`](../../test-management/config/project-map.example.json) | Template for the verified project configuration (types, fields, link types) |
| [`../../test-management/state/`](../../test-management/state/) | Persistent local-ID ↔ Jira/Xray mapping and its schema |
| [`../../scripts/jira-export.mjs`](../../scripts/jira-export.mjs) | Existing generator of Jira CSV import files from the test-design Markdown |

## Architecture

```
 docs/requirements, docs/test-strategy, tests/           (source of truth for content)
                │
                ▼
   /plan-jira-xray ──► test-management/state/plan.json   (local IDs: FA-01, US-001, PR-01, TS-AUTH-01 ...)
                │
                ▼
   /sync-jira-xray ──┬─► Atlassian MCP (OAuth) ─────────► Jira: Epic, Story, Risk, Bug, parent, issue links
                     │
                     └─► Xray adapter (scripts/xray) ───► Xray GraphQL /api/v2/graphql:
                          client_id/secret → token        Test type + steps, Test Set, Test Plan, Test Execution
                │
                ▼
   test-management/state/issue-map.json                   (local ID → Jira key / issue id, status, verification)
                │
                ▼
   /verify-jira-xray (read-only)  ──► test-management/reports/verify-<timestamp>.md
   /import-xray-results           ──► Xray /api/v2/import/execution/junit ──► Test Execution + runs
```

### Why two channels

- **Atlassian Rovo MCP** (`https://mcp.atlassian.com/v2/mcp`, already configured in [`.mcp.json`](../../.mcp.json))
  covers standard Jira work: read, search, create, edit, transition, link. It authenticates with OAuth 2.1 as the
  signed-in user, so Jira permissions apply unchanged.
- **The MCP catalog has no Xray operations.** VERIFIED (live): `discover` for "create xray test, test set, test plan
  or test execution" returned only Jira/Capacity Planning operations, and the official tool list has no test
  management group. Xray data that lives outside Jira fields (test type, steps, Test Set/Plan/Execution membership,
  test runs) can only be written through **Xray Cloud's own API**, authenticated with an Xray API key.

A Test created with a plain Jira create call (MCP `createJiraIssue` or REST `POST /rest/api/3/issue`) is a Jira issue
of type Test, but its Xray test type and steps are Xray data. Use Xray `createTest` (GraphQL) when the test type or
steps matter. See [xray-cloud-rest-api.md §4](xray-cloud-rest-api.md#4-creating-tests).

## Prerequisites

| Need | For | How to check |
|---|---|---|
| Jira Cloud site with Xray Cloud installed | Everything | Project issue types include Test, Test Set, Test Plan, Test Execution. VERIFIED (live) for project MSC |
| Atlassian account with *Browse*, *Create*, *Edit*, *Link issues* in the target project | MCP writes | `/discover-jira-xray` reports permissions |
| Atlassian Rovo MCP connected (OAuth) | Jira operations | `getAccessibleAtlassianResources` returns the site |
| Xray API key (Client ID + Client Secret) created by a Jira admin in Xray Global Settings | Xray operations | `POST /api/v2/authenticate` returns a token |
| Node.js 22 (already used by CI) | The future Xray adapter script | `node --version` |

## Authentication options (summary)

| Channel | Method | Details |
|---|---|---|
| Atlassian MCP | OAuth 2.1 (recommended); API token only if an org admin enables it | [authentication-and-security.md §1](authentication-and-security.md#1-atlassian-rovo-mcp) |
| Jira REST (fallback) | Basic auth `email:api_token`; scoped tokens via `https://api.atlassian.com/ex/jira/{cloudId}` | [§2](authentication-and-security.md#2-jira-cloud-rest-api) |
| Xray Cloud | `POST /api/v2/authenticate` with Client ID/Secret → bearer token (24 h) | [§3](authentication-and-security.md#3-xray-cloud) |

## Setup and verification checklist

1. [ ] `.mcp.json` lists `atlassian-rovo` and Claude Code shows it connected (`/mcp`). Complete the OAuth sign-in.
2. [ ] Copy the new variables from [`.env.example`](../../.env.example) into `.env` (git-ignored) and fill them in.
3. [x] Target project: **MSC**. `test-management/config/project-map.json` holds its verified values
       (for another project, start again from `project-map.example.json`).
4. [ ] Run `/discover-jira-xray MSC` and fill the remaining `null` values only with values the report verified.
5. [x] Ask a Jira admin for an Xray API key; check it with the authenticate call (no data is written).
6. [x] Build the Xray adapter (see [Follow-up implementation plan](#follow-up-implementation-plan)).
       `/import-xray-results` is still not executable.
6a. [x] Jira admin: give Xray access to MSC (done 2026-10-09 by replacing the API key) (see
       [troubleshooting](troubleshooting.md#xray-authenticates-but-cannot-see-or-create-jira-issues)). Until then
       `/sync-jira-xray` runs Jira-only steps.
7. [ ] Run `/plan-jira-xray`, review the plan, then `/sync-jira-xray --dry-run`, `/sync-jira-xray` and `/verify-jira-xray`.

## Command status

| Command | Status | Why |
|---|---|---|
| `/discover-jira-xray` | Operational (Jira part via MCP); Xray part needs credentials + adapter | Read-only MCP tools exist and were exercised |
| `/plan-jira-xray` | Operational | Local analysis only; writes `test-management/state/plan.json` |
| `/sync-jira-xray` | Operational | Jira via MCP, Xray via `scripts/test-management/sync-xray.mjs`. First full run 2026-10-09: `test-management/reports/sync-20261009-130902.md` |
| `/verify-jira-xray` | Operational | Jira checks via MCP (`verify-jira.mjs`); Xray type, steps, coverage and membership via `sync-xray.mjs verify` / `members` |
| `/import-xray-results` | **Scaffold, not executable** | Needs the adapter, Xray credentials, and a JUnit reporter in `playwright.config.ts` |

## Follow-up implementation plan

| # | Task | Notes |
|---|---|---|
| 1 | **Done 2026-10-09.** `scripts/xray/xray-client.mjs`: authenticate, GraphQL POST, retry on 429/5xx with backoff, token redaction | Node built-in `fetch`; no new dependency. Reads `XRAY_*` from `.env` |
| 2 | **Done 2026-10-09, except `import-junit` and `--dry-run`.** `scripts/xray/xray.mjs` CLI with subcommands: `auth-check`, `project-settings`, `get-tests`, `create-test`, `add-tests-to-set`, `add-tests-to-plan`, `get-test-set`, `get-test-plan`, `import-junit` | Each subcommand prints JSON so commands can parse it; `--dry-run` prints the request without sending |
| 3 | `scripts/test-management/validate-state.mjs`: JSON Schema check of `issue-map.json` and `plan.json` | Use the schema in `test-management/state/` |
| 4 | **Done and verified 2026-10-09** (trial Test Execution MSC-230). Playwright JUnit reporter with Xray options and a `test_key` annotation helper | Changes `playwright.config.ts` and test files: needs an explicit request |
| 5 | **Done 2026-10-09.** Read MSC's Xray project settings and fill `project-map.json` `xray` | Remaining: a Jira admin fixes Xray's access to MSC (`xray.accessBlocker`) |
| 6 | Optional CI step that imports results after the regression run | Needs `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET` as GitHub secrets |

## Sources consulted (2026-10-09)

| Source | Final URL | Note |
|---|---|---|
| Rovo MCP getting started | https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/ | |
| Rovo MCP supported tools | https://developer.atlassian.com/cloud/rovo-mcp/guides/supported-tools/ | |
| Jira REST v3 intro / issues / issue links | https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ (and `api-group-issues/`, `api-group-issue-links/`) | Pages too large to fetch whole; details taken from the official OpenAPI spec below |
| Jira REST v3 OpenAPI spec | https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json | Spec version `1001.0.0-SNAPSHOT-0c0db68a…` |
| Jira REST v2 OpenAPI spec | https://developer.atlassian.com/cloud/jira/platform/swagger.v3.json | |
| Jira rate limiting | https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ | |
| Jira basic auth | https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/ | |
| Atlassian API tokens / scoped tokens | https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ | |
| Xray Cloud REST API (required URL) | https://getxraydocs.atlassian.net/wiki/spaces/XRAYCLOUD/pages/44564499/REST+API | **Returns "Page Not Found"** on 2026-10-09 |
| Xray Cloud REST API (working equivalent) | https://docs.getxray.app/display/XRAYCLOUD/REST+API | Base URLs, rate limits, token lifetime |
| Xray Authentication – REST v2 | https://docs.getxray.app/space/XRAYCLOUD/44577089/Authentication%20-%20REST%20v2 | |
| Xray Import Execution Results – REST v2 | https://docs.getxray.app/display/XRAYCLOUD/Import+Execution+Results+-+REST+v2 | |
| Xray Taking advantage of JUnit XML reports | https://docs.getxray.app/space/XRAYCLOUD/44564745/Taking%20advantage%20of%20JUnit%20XML%20reports | |
| Xray Testing web applications using Playwright | https://docs.getxray.app/space/XRAYCLOUD/44565437 | |
| Xray Importing Tests – REST (v1) | https://docs.getxray.app/space/XRAYCLOUD/44564857 | v2 page not retrievable (403) |
| Xray GraphQL API reference | https://xray.cloud.getxray.app/doc/graphql/ | One page per query/mutation, e.g. `createtest.doc.html` |
