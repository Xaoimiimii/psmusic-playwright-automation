# Troubleshooting

Each entry: symptom → likely cause → what to do. Commands stop and report rather than work around configuration
problems. Links point to the reference sections.

## MCP authentication failure

- **Symptom:** MCP tools missing from the session, or calls return 401 / "not authenticated".
- **Cause:** OAuth sign-in not completed or expired; server not enabled in `.claude/settings.local.json`.
- **Fix:** run `/mcp` in Claude Code, select `atlassian-rovo`, authenticate in the browser. Check
  `enabledMcpjsonServers` contains `atlassian-rovo`. Then call `getAccessibleAtlassianResources`: it must list the
  site with `jira` access `read-write`.

## Missing MCP tools or permission scopes

- **Symptom:** `discover` does not return an operation (e.g. `createJiraIssueLink`), or `executeWrite` is refused.
- **Cause:** deferred tools are only reachable through `discover` + `executeRead/Write/Destructive`; delete/manage
  groups are disabled by default; API-token MCP auth may expose fewer groups.
- **Fix:** call `discover` with the product noun ("create a link between two jira issues"); use only names it returns.
  Never call a guessed name. If the group is disabled, report it — do not ask for `delete_jira` to be enabled.
- **Xray operations never appear in MCP** — that is expected, not an error ([capability-matrix](capability-matrix.md)).

## Jira permission errors

- **Symptom:** 403 on create/edit/link, or 404 on an issue you know exists.
- **Cause:** missing *Create issues*, *Edit issues*, *Link issues* (on the **outward** issue's project), or
  issue-level security. Jira returns 404 rather than 403 when the issue is not visible.
- **Fix:** check with REST `GET /rest/api/3/mypermissions?projectKey=…&permissions=…`. Stop the run; ask a project
  admin. ([jira-cloud-rest-api.md](jira-cloud-rest-api.md) §3.6)

## Missing issue types or required fields

- **Symptom:** 400 `issuetype` invalid, or `errors.customfield_…: … is required`.
- **Cause:** the type is not in the project's issue type scheme, or a field is required by the field configuration
  but missing / not on the create screen.
- **Fix:** re-run `/discover-jira-xray`. Compare with `project-map.json`. A required field with no value in the plan
  is a planning gap: stop and ask, never invent a value.

## Incorrect parent-child relationships

- **Symptom:** a Story has no Epic, the wrong Epic, or `parent` is rejected.
- **Cause:** the parent's type is not one level above the child in the hierarchy (e.g. Test under Story); wrong
  key mapping after an interrupted run; team-managed vs company-managed differences.
- **Fix:** read the child with `getJiraIssue` (`view: "evidence"`) and compare `parent.key` with the plan. Correct with
  `editJiraIssue` `parent` only after confirming the mapped key is the right issue. Coverage (Test → Story) is a
  link, not a parent ([jira §5](jira-cloud-rest-api.md#5-parent-child-relationships)).

## Xray authentication failures

- **Symptom:** `/api/v2/authenticate` returns 401 or 400.
- **Cause:** 401 = **Xray license not valid** (per the docs) or revoked key; 400 = malformed JSON body; wrong regional
  base URL for a data-residency site.
- **Fix:** check `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET` are set (never print them), the body is
  `{"client_id": "…", "client_secret": "…"}`, and try the regional URL. Ask the Jira admin to confirm the Xray
  subscription and the key in Global Settings → API Keys.

## Invalid Xray payloads

- **Symptom:** GraphQL `errors[]`, non-empty `warnings`, or import `400`.
- **Cause:** keys passed where **issue IDs** are expected; unknown `testType.name`; `savedFilter` combined with
  `testIssueIds`; JUnit `test_key` that does not exist; `limit` missing or > 100.
- **Fix:** resolve IDs from `issue-map.json` (`jiraId`); read test type names from `getProjectSettings`; check each
  operation's signature in [xray §4–7](xray-cloud-rest-api.md). Treat `warnings` as a FAIL until explained.

## Rate limiting and transient server errors

- **Symptom:** 429, 503, timeouts.
- **Cause:** Jira burst/per-issue limits; Xray 300 requests / 5 min on Standard.
- **Fix:** honour `Retry-After`; exponential backoff 2–30 s with jitter, max 4 attempts, reads and idempotent
  operations only. Sync processes entities sequentially. For creates, see the next entry.

## Duplicate creation after interrupted runs

- **Symptom:** two issues for one local ID (e.g. `US-014 Sign-in prompt…` and a second, bare `US-014`).
- **Cause:** a create succeeded but its key was not recorded (crash, timeout, manual retry); CSV re-import;
  renamed Playwright test re-imported as a new Generic Test.
- **Prevention (built into `/sync-jira-xray`):** record `status: "creating"` in `issue-map.json` *before* the call;
  after any error, search by local ID (summary prefix / label / sync property) before retrying; write the key
  immediately after success. Use `test_key` annotations for every imported automated test.
- **Fix:** `/verify-jira-xray` lists duplicates. Choose the survivor, update `issue-map.json`, and have a person
  delete or close the extra issue in Jira — **commands never delete**.

## Relationships that cannot be verified

- **Symptom:** a check is UNVERIFIED instead of PASS/FAIL.
- **Cause:** Xray membership needs Xray credentials/adapter; link semantics not confirmed (e.g. whether `Test` is
  Xray's coverage link type); search index lag right after a create.
- **Fix:** leave it UNVERIFIED with the reason in the report; never upgrade to PASS on assumption. For index lag,
  read the issue directly (`getJiraIssue`) instead of searching, or pass `reconcileIssues` to `/search/jql`.

## Result import "succeeded" but nothing changed

- **Symptom:** import returns 200 with a Test Execution key, but runs are missing or new Generic Tests appeared.
- **Cause:** test cases without `test_key` were matched by Generic definition or created new; wrong `projectKey`.
- **Fix:** `/import-xray-results` reads the Test Execution back and compares every test with the report
  ([xray §6.4](xray-cloud-rest-api.md#64-before-and-after-an-import)).
