# Xray Cloud API

Research date 2026-10-09. Xray-specific data cannot be written through Atlassian MCP (see
[capability-matrix.md](capability-matrix.md)); this document is the contract for the **Xray adapter**, which does
not exist yet (see [README §Follow-up](README.md#follow-up-implementation-plan)).

Label legend: **DOC** = in official Xray documentation; **LIVE** = observed on the project's site on 2026-10-09
(Jira side only — no Xray credentials were available, so **no Xray endpoint was called**); **UNVERIFIED** = not
confirmed.

## 1. Sources

| Topic | URL |
|---|---|
| REST API overview (base URLs, rate limits, token lifetime) | https://docs.getxray.app/display/XRAYCLOUD/REST+API — the URL given in the task brief, `https://getxraydocs.atlassian.net/wiki/spaces/XRAYCLOUD/pages/44564499/REST+API`, returned "Page Not Found" on 2026-10-09 |
| Authentication – REST v2 | https://docs.getxray.app/space/XRAYCLOUD/44577089/Authentication%20-%20REST%20v2 |
| Import Execution Results – REST v2 | https://docs.getxray.app/display/XRAYCLOUD/Import+Execution+Results+-+REST+v2 |
| JUnit XML mapping | https://docs.getxray.app/space/XRAYCLOUD/44564745/Taking%20advantage%20of%20JUnit%20XML%20reports |
| Playwright integration | https://docs.getxray.app/space/XRAYCLOUD/44565437 (Testing web applications using Playwright) |
| Importing Tests – REST (v1 page) | https://docs.getxray.app/space/XRAYCLOUD/44564857 |
| GraphQL reference | https://xray.cloud.getxray.app/doc/graphql/ and one page per operation, e.g. `…/doc/graphql/createtest.doc.html` |

## 2. Base URLs, versions and API styles

| Region | Base URL (DOC) |
|---|---|
| Global | `https://xray.cloud.getxray.app/` |
| USA | `https://us.xray.cloud.getxray.app/` |
| EU (Frankfurt) | `https://eu.xray.cloud.getxray.app/` |
| Australia (Sydney) | `https://au.xray.cloud.getxray.app/` |

DOC: sites with data residency should use the URL of their Xray region. Which region this site uses: UNVERIFIED —
start with the global URL; record the working one as `XRAY_BASE_URL`.

| Style | Path | Use it for |
|---|---|---|
| REST v2 | `/api/v2/authenticate`, `/api/v2/import/…` | Token, importing results, bulk-importing test definitions |
| GraphQL v2 | `POST /api/v2/graphql` | Creating/reading Tests (type, steps), Test Sets, Test Plans, Test Executions, memberships, test runs, project settings |
| REST v1 | `/api/v1/…` | Older equivalent; documented pages still exist. Use v2 |

## 3. Authentication and token lifecycle

`POST {XRAY_BASE_URL}/api/v2/authenticate` — DOC.

```json
{ "client_id": "<XRAY_CLIENT_ID>", "client_secret": "<XRAY_CLIENT_SECRET>" }
```

- `200` `application/json`: a **JSON string** (in double quotes) holding the token. Strip the quotes.
- `400` bad syntax · `401` **Xray license not valid** · `500` internal error (all `text/plain`).
- Use: `Authorization: Bearer <token>` (DOC: literal in the import examples).
- Lifetime: the REST API overview page says the token "expires after 24 hours" (DOC). The adapter should
  re-authenticate on `401` once, and at least every 23 h in long runs. Never write the token to disk or logs.
- Client ID/Secret come from an **API key** created for a specific user in Xray **Global Settings → API Keys** (DOC);
  that needs a Jira admin. Calls act with that user's Jira permissions.

## 4. Creating Tests

A Jira create (MCP `createJiraIssue` or REST `POST /rest/api/3/issue` with issue type Test) creates the Jira issue.
**Test type, steps, Gherkin/unstructured definition, and repository folder are Xray data**, set only through Xray.
What test type a Jira-created Test gets: UNVERIFIED (likely the project's `defaultTestTypeId`, readable via
`getProjectSettings`).

### 4.1 GraphQL `createTest` (DOC, verbatim signature)

```graphql
createTest(testType: UpdateTestTypeInput, steps: [CreateStepInput], unstructured: String, gherkin: String, preconditionIssueIds: [String], folderPath: String, jira: JSON!): CreateTestResult
```

`jira` is the same object as Jira's create-issue body (`{ fields: { … } }`). Official example (Manual test):

```graphql
mutation {
    createTest(
        testType: { name: "Manual" },
        steps: [
            { action: "Create first example step", result: "First step was created" },
            { action: "Create second example step with data", data: "Data for the step", result: "Second step was created with data" }
        ],
        jira: { fields: { summary:"Exploratory Test", project: {key: "CALC"} } }
    ) {
        test { issueId testType { name } steps { action data result } jira(fields: ["key"]) }
        warnings
    }
}
```

For a Generic (automated) test the doc uses `testType: { name: "Generic" }, unstructured: "…"`.
Test type names available in the project come from `getProjectSettings` (§8). Always read `warnings`.

Response: GraphQL returns `data.createTest.test` and `data.createTest.warnings` following the selection set.
No captured response exists — UNVERIFIED until the adapter's first dry run against a sandbox project.

### 4.2 Updating an existing Test's definition (DOC)

```graphql
updateTestType(issueId: String!, versionId: Int, testType: UpdateTestTypeInput!): Test
```

Steps: `addTestStep`, `updateTestStep`, `removeTestStep`, `removeAllTestSteps`; Generic:
`updateUnstructuredTestDefinition`; Cucumber: `updateGherkinTestDefinition` (all listed on the GraphQL index page;
argument lists not yet transcribed — read each operation's page before use).

### 4.3 Bulk import of Tests (REST)

- DOC (v1 page): `POST /api/v1/import/test/bulk` with a JSON array of items (`testtype`, `fields`, `steps`,
  `gherkin_def`, `unstructured_def`, `xray_test_sets`, `xray_test_repository_folder`, `update`), **max 1000** per
  request; returns `{ "jobId": "34a4106b1d0948d1aae1170cc8df3bb4" }`. Poll `GET /api/v1/import/test/bulk/{jobId}/status`
  → `status` one of `pending`, `working`, `failed`, `successful`, `partially_successful`, `unsuccessful`, with
  `result.errors[]` and `result.issues[]` (`elementNumber`, `id`, `key`, `self`).
- v2 (`/api/v2/import/test/bulk`, `/api/v2/import/test/bulk/{jobId}/status`): named in the v2 page's search snippet,
  one job per user at a time, status kept ~1 day. The v2 page itself returned 403 to the fetcher, so the v2 payload is
  **UNVERIFIED** — confirm against the v2 page in a browser before using.
- An async job's `successful` is the only success signal; the HTTP 200 of the submit call only means "queued".

## 5. Test Sets, Test Plans, Test Executions (GraphQL, DOC, verbatim signatures)

```graphql
createTestSet(testIssueIds: [String], jira: JSON!): CreateTestSetResult
createTestPlan(savedFilter: String, testIssueIds: [String], jira: JSON!): CreateTestPlanResult      # savedFilter XOR testIssueIds
createTestExecution(testIssueIds: [String], tests: [TestWithVersionInput], testEnvironments: [String], jira: JSON!): CreateTestExecutionResult
addTestsToTestSet(issueId: String!, testIssueIds: [String]!): AddTestsResult
addTestsToTestPlan(issueId: String!, testIssueIds: [String]!): AddTestsResult
addTestsToTestExecution(issueId: String!, testIssueIds: [String], tests: [TestWithVersionInput]): AddTestsResult
addTestExecutionsToTestPlan(issueId: String!, testExecIssueIds: [String]!): AddTestExecutionsResult
```

Official example:

```graphql
mutation {
    addTestsToTestSet(issueId: "12345", testIssueIds: ["54321"]) { addedTests warning }
}
```

- **IDs are Jira issue IDs** (the numeric `id` returned with the key, e.g. `"10042"`), not keys. Keep both in
  `issue-map.json`.
- `addedTests` lists what was added; `warning` explains skipped items (for example a Test already in the set —
  exact wording UNVERIFIED). Re-adding is therefore safe to retry, but still verify (§7).
- `createTestSet`/`createTestPlan` return `testSet`/`testPlan` with `issueId` and `jira(fields: ["key"])`, plus
  `warnings`; `createTestExecution` also returns `createdTestEnvironments`.

## 6. Importing automated results

### 6.1 Endpoints (DOC)

| Format | Endpoint (POST) | Body |
|---|---|---|
| JUnit XML | `/api/v2/import/execution/junit` | `Content-Type: text/xml`, raw XML |
| JUnit XML multipart | `/api/v2/import/execution/junit/multipart` | `multipart/form-data`: `results` (XML), `info` (Test Execution fields JSON), `testInfo` (Test fields JSON) |
| TestNG / NUnit / xUnit / Robot | `/api/v2/import/execution/{testng,nunit,xunit,robot}` (+ `/multipart`) | Same pattern |
| Cucumber / Behave JSON | `/api/v2/import/execution/{cucumber,behave}` (+ `/multipart`) | `application/json` |
| Xray JSON | `/api/v2/import/execution` (+ `/multipart`) | `{ testExecutionKey?, info{…}, tests[{ testKey, status, start, finish, comment, … }] }` |

JUnit query parameters (DOC examples): `projectKey`, `testExecKey` (existing execution to update), `testPlanKey`,
`revision`, `fixVersion`. Test environments are set only through Xray JSON `info.testEnvironments` or multipart `info`.

Response `200` (DOC example): `{"id": "10200", "key": "XNP-24", "self": "https://www.example.com/rest/api/2/issue/10200"}`
— the **Test Execution** issue. `400` error message · `401` invalid token / license · `500` internal.

### 6.2 How JUnit test cases map to Tests (DOC, JUnit page)

- Each `<testcase>` becomes an Xray **Generic** test; `classname` + `name` form its Generic Test Definition.
- With a `test_key` (or `test_id`) property the result attaches to that existing Test; an unknown key is an **error**.
- Without one, Xray matches an existing Test with the same Generic definition, otherwise **creates a new Test**.
  Renaming a Playwright test therefore creates a new Generic Test on the next import — the main source of duplicates.
- `requirements` property (comma-separated keys) links the Test to requirements; `test_summary`,
  `test_description`, `tags` (labels); `testrun_comment`, `testrun_evidence` (Base64 files).
- Status: failure or error → FAIL; skipped → TODO; otherwise PASS.
- What happens when `test_key` points at a **Manual** Test: not stated — UNVERIFIED. Test it
  on one Test in a sandbox before mapping automated specs to existing manual Tests.

### 6.3 Playwright (DOC, Xray Playwright page)

Playwright's built-in `junit` reporter with options:

```ts
// playwright.config.ts (NOT applied in this repo yet — needs an explicit request)
const xrayOptions = {
  embedAnnotationsAsProperties: true,
  textContentAnnotations: ['test_description'],
  embedAttachmentsAsProperty: 'testrun_evidence',
  outputFile: './xray-report.xml',
};
// reporter: [['junit', xrayOptions], …existing reporters]
```

and per test: `testInfo.annotations.push({ type: 'test_key', description: '<TEST_KEY>' });` (also `test_summary`,
`requirements`, `test_description`).

Repository impact: `embedAttachmentsAsProperty` embeds screenshots in the XML. Screenshots of an authenticated page
can show personal data; keep it off in CI unless reviewed (see authentication-and-security.md §6).

### 6.4 Before and after an import

Before: the report's every `test_key` exists in `issue-map.json` with `xray.testType = Generic` (or the behavior in
§6.2 has been verified for the target type); `projectKey` equals `project-map.json` `jira.projectKey`.

After (never trust the HTTP 200 alone): `getTestExecution(issueId)` with `tests(limit: 100)`; `getTestRuns` for the
execution; compare the count and each Test's status with the JUnit report; confirm no new Tests were created
unexpectedly (`getTests(jql: "project = X AND created >= -15m")`).

## 7. Reading and verifying (GraphQL, DOC signatures)

```graphql
getTests(jql: String, issueIds: [String], projectId: String, testType: TestTypeInput, modifiedSince: String, limit: Int!, start: Int, folder: FolderSearchInput): TestResults
getTestSet(issueId: String): TestSet
getTestPlan(issueId: String): TestPlan
getTestExecution(issueId: String): TestExecution
getCoverableIssues(jql: String, issueIds: [String], limit: Int!, start: Int): CoverableIssueResults
getProjectSettings(projectIdOrKey: String): ProjectSettings
getIssueLinkTypes: [IssueLinkType]
```

Official example:

```graphql
{
    getTestSet(issueId: "12345") {
        issueId
        tests(limit: 100) { results { issueId testType { name } } }
    }
}
```

Pagination: `limit` (1–100, required on every connection) and `start`; result objects carry `total`, `start`,
`limit`, `results`. Per call: at most 10 000 items and 25 resolvers (DOC, GraphQL index). Page until
`start + limit >= total`.

## 8. Project configuration prerequisites

`getProjectSettings(projectIdOrKey: "<PROJECT_ID>")` returns (DOC example selection):
`testEnvironments`, `testCoverageSettings { coverableIssueTypeIds epicIssuesRelation issueSubTasksRelation issueLinkTypeId issueLinkTypeDirection }`,
`defectIssueTypes`, `testTypeSettings { testTypes { id name kind } defaultTestTypeId }`.

Record these in `project-map.json` before syncing:

| Setting | Why it matters | State on this site |
|---|---|---|
| Xray issue types mapped to the project | Test/Test Set/Test Plan/Test Execution must be Xray's types, not look-alikes | LIVE: types exist in MSC with Xray's descriptions ("This is the Xray Test Work Type…") |
| `coverableIssueTypeIds` | Which types (Story? Requirement? Epic?) count as requirements for coverage | UNVERIFIED |
| `issueLinkTypeId` + direction | Which link Xray reads as "Test covers requirement" | Site has link type `Test` (is tested by / tests) — UNVERIFIED that it is the configured one |
| `defectIssueTypes` | Whether Bug counts as a defect in Xray | UNVERIFIED |
| `testTypes`, `defaultTestTypeId` | Names for `testType: { name }`; type of Jira-created Tests | UNVERIFIED |

## 9. Errors, rate limits and retries

- Rate limits (DOC): Xray Standard **300 requests / 5 minutes**, Enterprise **1000 / 5 minutes**; Xray says it follows
  Jira's approach (`429`, `Retry-After`). Which edition this site has: UNVERIFIED — assume 300/5 min (≈ 1 request/s).
- GraphQL errors: by GraphQL convention errors arrive in an `errors[]` array, possibly with HTTP 200 — not stated on
  the Xray pages (UNVERIFIED); the adapter must treat any `errors[]` or non-empty `warnings` as needing attention,
  not only non-2xx.
- Retries: same policy as Jira (backoff with jitter, ≤ 4 attempts) for reads and for `add…To…` mutations.
  **Never** auto-retry `createTest`/`createTestSet`/`createTestPlan`/`createTestExecution` or an import after a
  timeout: search first (`getTests(jql: …)` / Jira JQL by summary or label), because the first call may have succeeded.
- `401` from any call: re-authenticate once; a second `401` → stop (expired key or invalid license).
