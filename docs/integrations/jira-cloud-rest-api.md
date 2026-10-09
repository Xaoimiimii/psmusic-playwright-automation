# Jira Cloud REST API (fallback channel)

Research date 2026-10-09. Prefer Atlassian MCP for these operations (see [capability-matrix.md](capability-matrix.md));
use this REST API when MCP is not available, for example in CI.

**Sources.** Operation details (method, path, parameters, permissions, OAuth scopes, examples) were extracted from the
official OpenAPI spec https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json (spec version
`1001.0.0-SNAPSHOT-0c0db68a…`), which backs https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/,
`…/api-group-issues/` and `…/api-group-issue-links/`. Those HTML pages were too large to fetch whole.
Each section names its operation ID so it can be found on the reference page (`#api-rest-api-3-…`).

Label legend: **DOC** = documented by Atlassian; **LIVE** = also observed in a real read-only request (through MCP,
which calls the same Jira APIs) on 2026-10-09; **UNVERIFIED** = not confirmed.

## 1. Base URL and versions

| Auth method | Base URL |
|---|---|
| Classic API token (Basic) | `https://<site>.atlassian.net` |
| Scoped API token or OAuth 2.0 (3LO) | `https://api.atlassian.com/ex/jira/{cloudId}` |

Paths below are relative, e.g. `{base}/rest/api/3/issue`. Scoped tokens fail against the site URL and need the
`api.atlassian.com` form (Atlassian support article "401 Unauthorized error when service account accesses Jira or
Confluence API").

**v2 vs v3.** Both are current and expose the same operations under `/rest/api/2/…` and `/rest/api/3/…`.
The difference that matters here (DOC, both specs):

- v3 `description`, `environment` and every `textarea` custom field take **Atlassian Document Format (ADF)**.
  Single-line `textfield` custom fields take a plain string in both versions.
- v2 takes plain strings (wiki markup) for the same fields. The v2 spec's create example uses
  `"description": "Order entry fails when selecting supplier."`; the v3 example uses an ADF document.
- Do not reuse a v2 payload against v3 or vice versa. Check `schema.custom` in the field metadata (§3.3): a
  `…:textarea` custom field needs ADF in v3.

Minimal ADF paragraph:

```json
{ "type": "doc", "version": 1, "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Plain text here" } ] } ] }
```

## 2. Authentication (summary)

Details in [authentication-and-security.md](authentication-and-security.md#2-jira-cloud-rest-api).

| Method | Header | Notes |
|---|---|---|
| Basic auth with API token | `Authorization: Basic base64(email:api_token)` | DOC (`basic-auth-for-rest-apis`). Passwords are deprecated. Repeated failures can trigger CAPTCHA (`X-Seraph-LoginReason: AUTHENTICATION_DENIED`) |
| Scoped API token | Same Basic header, base URL `api.atlassian.com/ex/jira/{cloudId}` | Token carries granular scopes chosen at creation |
| OAuth 2.0 (3LO) | `Authorization: Bearer <access_token>` | Classic scopes `read:jira-work`, `write:jira-work`; granular scopes listed per operation |

## 3. Discovering project configuration

Run these before any create, and record the results in `test-management/config/project-map.json`.

### 3.1 Get project — `GET /rest/api/3/project/{projectIdOrKey}` (`getProject`)

DOC. Permission: *Browse projects*. Scope: `read:jira-work`. Returns `id`, `key`, `style` (`classic` =
company-managed, `next-gen` = team-managed), issue types, components. LIVE via MCP `listJiraProjects`:
MSC is `classic`.

### 3.2 Work item types — `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` (`getCreateIssueMetaIssueTypes`)

DOC. Permission: *Create issues*. Query: `startAt`, `maxResults`. Response (spec example):

```json
{ "issueTypes": [ { "description": "An error in the code", "iconUrl": "https://your-domain.atlassian.net/images/icons/issuetypes/bug.png", "id": "1", "name": "Bug", "self": "https://your-domain.atlassian.net/rest/api/3/issueType/1", "subtask": false } ], "maxResults": 1, "startAt": 0, "total": 1 }
```

The older `GET /rest/api/3/issue/createmeta` is **deprecated** (CHANGE-1304). Do not use it.

### 3.3 Field metadata — `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` (`getCreateIssueMetaIssueTypeId`)

DOC. Permission: *Create issues*. Paged with `startAt`/`maxResults`. Each field has `fieldId`, `name`, `required`,
`schema`, `allowedValues`, `operations`. Response (spec example):

```json
{ "fields": [ { "fieldId": "assignee", "hasDefaultValue": false, "key": "assignee", "name": "Assignee", "operations": ["set"], "required": true } ], "maxResults": 1, "startAt": 0, "total": 1 }
```

Custom field IDs (`customfield_NNNNN`) differ per site. Never hardcode one that was not read from this call.

### 3.4 All fields — `GET /rest/api/3/field` (`getFields`)

DOC. Lists system and custom fields with `id`, `name`, `schema.custom` (plugin type). Use it to tell a native Xray
field from a look-alike plain text field (for example one a generic Jira CSV import created).

### 3.5 Link types — `GET /rest/api/3/issueLinkType` (`getIssueLinkTypes`)

DOC. Permission: *Browse projects*. Returns `issueLinkTypes[]` with `id`, `name`, `inward`, `outward`. 404 if issue
linking is disabled. LIVE: the site has `Blocks`, `Cloners`, `Defect`, `Duplicate`, `Relates`, `Test`.

### 3.6 Permissions — `GET /rest/api/3/mypermissions?projectKey=…&permissions=CREATE_ISSUES,EDIT_ISSUES,LINK_ISSUES,BROWSE_PROJECTS` (`getMyPermissions`)

DOC. `permissions` is required. Returns `permissions.<KEY>.havePermission`.

## 4. Creating work items

### 4.1 Create issue — `POST /rest/api/3/issue` (`createIssue`)

DOC. Permission: *Browse projects* + *Create issues*. Scope: `write:jira-work` (granular: `write:issue:jira`, …).
Query: `updateHistory`. Body: `fields` (and optionally `update`, `transition`, `properties`).
Required fields always include `project`, `issuetype`, `summary`; any other required field comes from §3.3.

Minimal Epic (company-managed project; IDs are from project-map.json, not literals to copy):

```json
{ "fields": { "project": { "key": "<PROJECT_KEY>" }, "issuetype": { "id": "<EPIC_TYPE_ID>" }, "summary": "FA-02 Authentication and session", "labels": ["psmusic"] } }
```

Story under that Epic (the `parent` field, see §5):

```json
{ "fields": { "project": { "key": "<PROJECT_KEY>" }, "issuetype": { "id": "<STORY_TYPE_ID>" }, "summary": "US-002 Log in", "parent": { "key": "<EPIC_KEY>" }, "labels": ["psmusic"] } }
```

Response `201` (spec example):

```json
{ "id": "10000", "key": "ED-24", "self": "https://your-domain.atlassian.net/rest/api/3/issue/10000", "transition": { "status": 200, "errorCollection": { "errorMessages": [], "errors": {} } } }
```

Errors: `400` missing/invalid field or field not on the create screen (body has `errors.<fieldId>`); `401`; `403`;
`422` configuration problem.

**No idempotency key.** Repeating a create creates a duplicate. Search first (§7) and record the key in
`issue-map.json` immediately after each `201`.

### 4.2 Bulk create — `POST /rest/api/3/issue/bulk` (`createIssues`)

DOC. Up to **50** issues: `{ "issueUpdates": [ { "fields": {…} }, … ] }`. Returns `201` if *any* succeeded; the body
has `issues[]` (id, key, self) and `errors[]` per failed element. A `201` therefore does not mean all were created:
check `errors` and map each created key back to its local ID by summary/label.

### 4.3 Work item types used in this project

LIVE in MSC (`listJiraProjectIssueTypesMetadata`): Epic `10000`, Story `10005`, Test `10029`, Test Set `10030`,
Test Plan `10031`, Test Execution `10032`, Precondition `10033`, Sub Test Execution `10034` (subtask), Sub-task `10035`,
Task `10036`, Feature `10037`, Bug `10038`, Requirement `10039`, Risk `10040`. Re-check them for any other project.

`Risk` is a plain Jira issue type here (no description, no special fields) — not a Jira Product Discovery or Xray
type. Its fields come from §3.3.

## 5. Parent-child relationships

- DOC (`createIssue`, `editIssue`): `parent` takes `{ "key": "…" }` or `{ "id": "…" }`. For standard issue types the
  parent can be removed with `update.parent.set.none: true` on edit.
- Sub-tasks need a sub-task issue type and a parent in the same project.
- LIVE: in MSC (company-managed) the Story, Test and Risk create screens have `parent`; Epic does not. On this site
  the legacy `Epic Link` field (`customfield_10014`) mirrors `parent` on Stories. Set `parent`; do not write
  `Epic Link` directly.
- A Test is **not** a child of a Story. Test-to-requirement coverage in Xray uses an issue link (§6) or the Xray
  coverage configuration, not `parent`.

## 6. Issue links

### 6.1 Create — `POST /rest/api/3/issueLink` (`linkIssues`)

DOC. Permissions: *Browse project* on both projects, *Link issues* on the project of the **outward** issue.
Required: `type`, `inwardIssue`, `outwardIssue`; optional `comment` (added to the outward issue).

```json
{ "type": { "name": "Relates" }, "inwardIssue": { "key": "<KEY_A>" }, "outwardIssue": { "key": "<KEY_B>" } }
```

Response `201` with **no body** and no link ID. Errors: `400` (comment not created), `404` (linking disabled or an
issue not visible), `413` (per-issue link limit reached). DOC: "If the link request duplicates a link, the response
indicates that the issue link was created" — so a `201` does not prove a new link exists; read it back.

**Direction.** The rendered sentence is "*outwardIssue* <outward wording> *inwardIssue*" — UNVERIFIED as a rule from
the spec text alone; confirm on one pair by reading both issues' `issuelinks` (each entry has either `inwardIssue` or
`outwardIssue` relative to the issue read) before creating links in bulk.

### 6.2 Read back

`GET /rest/api/3/issue/{key}?fields=issuelinks` returns `fields.issuelinks[]` with `id`, `type`, and `inwardIssue` or
`outwardIssue`. Single link: `GET /rest/api/3/issueLink/{linkId}` (`getIssueLink`).

### 6.3 Link types on this site and their intended use

| Link type (LIVE) | inward / outward | Intended use here | Status |
|---|---|---|---|
| `Test` | is tested by / tests | Test → Story/Requirement coverage | Name suggests Xray coverage link; confirm with Xray `getProjectSettings.testCoverageSettings.issueLinkTypeId` — UNVERIFIED |
| `Defect` | created by / created | Bug ↔ Test | Semantics not documented on this site — UNVERIFIED; do not use until confirmed |
| `Relates` | relates to / relates to | Risk ↔ Story, Risk ↔ Epic | Symmetric; safe |
| `Blocks` | is blocked by / blocks | Bug blocks Story | Use only when a blocker is explicit |
| `Duplicate`, `Cloners` | — | Not used by sync | — |

## 7. Searching and reading

### 7.1 Search — `POST /rest/api/3/search/jql` (`searchAndReconsileIssuesUsingJqlPost`)

DOC. Body fields: `jql` (must be **bounded**, e.g. include `project = X`), `fields`, `maxResults`, `nextPageToken`,
`expand`, `properties` (≤ 5), `fieldsByKeys`, `reconcileIssues` (≤ 50 issue IDs for read-after-write consistency).
Response: `issues[]`, `nextPageToken`, `isLast`. **Pagination is token-based**: repeat with the returned
`nextPageToken` until `isLast` is true. There is no `total`; use `POST /rest/api/3/search/approximate-count`
(`{ "jql": "…" }` → `{ "count": 153 }`) for an estimate.

`GET`/`POST /rest/api/3/search` (the `startAt`/`total` style) are marked "Currently being removed" (CHANGE-2046).
Do not use them.

DOC: "Recent updates might not be immediately visible in the returned search results." A duplicate check right after
a create must therefore also consult `issue-map.json`, or pass the new IDs in `reconcileIssues`.

Example duplicate check by local ID (label or summary prefix):

```json
{ "jql": "project = <PROJECT_KEY> AND issuetype = Story AND summary ~ \"\\\"US-002\\\"\"", "fields": ["summary", "issuetype", "parent", "labels"], "maxResults": 50 }
```

### 7.2 Get issue — `GET /rest/api/3/issue/{issueIdOrKey}` (`getIssue`)

DOC. Query: `fields`, `fieldsByKeys`, `expand`, `properties`, `failFast`. Does not redirect for moved issues; returns
the found issue's current key — compare it with the mapped key.

## 8. Safe updates

`PUT /rest/api/3/issue/{issueIdOrKey}` (`editIssue`). DOC. Permission: *Browse* + *Edit issues*. Query: `notifyUsers`
(set `false` for bulk sync), `returnIssue`, `expand`. Returns `204` (or `200` with `returnIssue=true`); `409` on a
conflicting concurrent update; `422` configuration problem. Transitions are ignored here.

- `fields.X` **replaces** the value; `update.X: [{ "add": … }, { "remove": … }]` changes it incrementally. Use
  `update.labels` add/remove so labels set by people are kept.
- Read the current value first and skip the call when nothing changes (fewer writes, cleaner history).
- Per-issue write limit: 20 writes / 2 s and 100 writes / 30 s (rate-limiting page).

## 9. Issue properties (sync markers)

`PUT /rest/api/3/issue/{key}/properties/{propertyKey}` (`setIssueProperty`) stores a JSON value ≤ 32 768 characters;
`GET` reads it. A property such as `{ "localId": "US-002", "planHash": "…" }` lets a later run find an issue by local
ID even after its summary changed. Through MCP the key must start with `atlassian-mcp.` (MCP `editJiraEntityProperty`
description), so use `atlassian-mcp.psmusic-sync` on both channels. Whether JQL can search a property depends on an
app indexing it — UNVERIFIED; rely on summary/label search plus `issue-map.json`.

## 10. Rate limits, errors and retries

Source: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ (DOC).

- Limits: a points-based hourly quota (enforced for OAuth 2.0/Forge/Connect apps), per-second burst limits per
  endpoint (default 100 req/s GET/POST, 50 req/s PUT/DELETE), and a per-issue write limit. API-token traffic is
  subject to the burst limits.
- Throttled responses: `429` with `Retry-After` (seconds), `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset`, `X-RateLimit-NearLimit`, `RateLimit-Reason` (`jira-quota-global-based`,
  `jira-quota-tenant-based`, `jira-burst-based`, `jira-per-issue-on-write`).
- Retry policy for the adapter (Atlassian's recommendation): retry only **idempotent** requests, and only when
  `Retry-After` is present; wait at least `Retry-After`; otherwise start at 2–5 s, double, cap at 30 s, jitter ×0.7–1.3,
  at most 4 attempts. `jira-per-issue-on-write` → slow writes to that issue; `jira-burst-based` → slow that endpoint;
  quota reasons → pause everything until reset. A `503` may also carry `Retry-After`.
- **Creates are not idempotent.** After a timeout or `5xx` on `POST /issue`, do not blindly retry: search for the
  issue (§7) first; retry only when it is confirmed absent.

| Status | Meaning | Action |
|---|---|---|
| 400 | Invalid/missing field, field not on screen | Fix payload from `errors`; re-read field metadata |
| 401 | Bad or missing credentials, wrong base URL for scoped token | Stop; see troubleshooting |
| 403 | Missing permission | Stop; report the permission |
| 404 | Not found or not visible; linking disabled | Stop for that entity |
| 409 | Concurrent update | Re-read, re-apply once |
| 413 | Per-issue link limit | Stop linking that issue |
| 422 | Project configuration problem | Stop; critical configuration |
| 429 | Rate limited | Back off as above |
| 5xx | Transient | Reads: retry with backoff. Creates: search first |
