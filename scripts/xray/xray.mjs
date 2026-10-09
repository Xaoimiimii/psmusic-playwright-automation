// Xray Cloud adapter: the only channel this repo uses for Xray data (test type, steps, Test Set / Test Plan
// membership). Jira-only operations go through Atlassian MCP. Contract: docs/integrations/xray-cloud-rest-api.md.
// Reads XRAY_BASE_URL, XRAY_CLIENT_ID, XRAY_CLIENT_SECRET from .env. Prints JSON on stdout; never prints the token.
//
// Usage: node scripts/xray/xray.mjs <command> [args]
//   query <file.graphql> [vars.json]    Read-only raw GraphQL query (mutations refused)
//   auth-check                          Authenticate only (no data read or written)
//   project-settings <projectIdOrKey>   getProjectSettings
//   get-tests <jql> [start]             getTests (type, steps count, key), 100 per page
//   get-test-set <issueId> [start]      getTestSet with member tests, 100 per page
//   get-test-plan <issueId> [start]     getTestPlan with member tests, 100 per page
//   create-test <input.json>            createTest. input = { testType: {name}, steps?, unstructured?, jira }
//   create-test-set <input.json>        createTestSet. input = { testIssueIds?, jira }
//   create-test-plan <input.json>       createTestPlan. input = { testIssueIds?, jira }
//   add-tests-to-set <issueId> <id,id>  addTestsToTestSet
//   add-tests-to-plan <issueId> <id,id> addTestsToTestPlan
// Mutations that create issues are never retried: after an unknown outcome, search first (xray-cloud-rest-api.md §9).
// Core (auth, retry, redaction) lives in xray-client.mjs.
import fs from 'node:fs';
import { authenticate, graphql, redact } from './xray-client.mjs';

const baseUrl = (process.env.XRAY_BASE_URL || 'https://xray.cloud.getxray.app').replace(/\/+$/, '');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = (list) => list.split(',').map((id) => id.trim()).filter(Boolean);

const TEST_FIELDS = `issueId testType { name kind } steps { id action data result } unstructured jira(fields: ["key", "summary"])`;

const commands = {
  /** Read-only raw query from a file (for introspection and ad-hoc verification). Mutations are refused. */
  async query(file, variablesFile) {
    const text = fs.readFileSync(file, 'utf8');
    if (/^\s*mutation\b/m.test(text)) throw new Error('query: mutations are not allowed here');
    return graphql(text, variablesFile ? readJson(variablesFile) : {}, { retry: true });
  },

  async 'auth-check'() {
    await authenticate();
    return { authenticated: true, baseUrl };
  },

  async 'project-settings'(project) {
    return graphql(
      `query ($p: String) { getProjectSettings(projectIdOrKey: $p) {
        projectId
        testEnvironments
        testCoverageSettings { coverableIssueTypeIds epicIssuesRelation issueSubTasksRelation issueLinkTypeId issueLinkTypeDirection }
        defectIssueTypes
        testTypeSettings { testTypes { id name kind } defaultTestTypeId }
      } }`,
      { p: project },
      { retry: true },
    );
  },

  async 'get-tests'(jql, start = '0') {
    return graphql(
      `query ($jql: String, $start: Int) { getTests(jql: $jql, limit: 100, start: $start) {
        total start limit results { ${TEST_FIELDS} } } }`,
      { jql, start: Number(start) },
      { retry: true },
    );
  },

  async 'get-test-set'(issueId, start = '0') {
    return graphql(
      `query ($id: String, $start: Int) { getTestSet(issueId: $id) {
        issueId jira(fields: ["key", "summary"]) tests(limit: 100, start: $start) { total start limit results { issueId jira(fields: ["key"]) } } } }`,
      { id: issueId, start: Number(start) },
      { retry: true },
    );
  },

  async 'get-test-plan'(issueId, start = '0') {
    return graphql(
      `query ($id: String, $start: Int) { getTestPlan(issueId: $id) {
        issueId jira(fields: ["key", "summary"]) tests(limit: 100, start: $start) { total start limit results { issueId jira(fields: ["key"]) } } } }`,
      { id: issueId, start: Number(start) },
      { retry: true },
    );
  },

  async 'create-test'(file) {
    const input = readJson(file);
    return graphql(
      `mutation ($testType: UpdateTestTypeInput, $steps: [CreateStepInput], $unstructured: String, $jira: JSON!) {
        createTest(testType: $testType, steps: $steps, unstructured: $unstructured, jira: $jira) {
          test { ${TEST_FIELDS} } warnings } }`,
      { testType: input.testType, steps: input.steps ?? null, unstructured: input.unstructured ?? null, jira: input.jira },
    );
  },

  async 'create-test-set'(file) {
    const input = readJson(file);
    return graphql(
      `mutation ($ids: [String], $jira: JSON!) { createTestSet(testIssueIds: $ids, jira: $jira) {
        testSet { issueId jira(fields: ["key"]) } warnings } }`,
      { ids: input.testIssueIds ?? [], jira: input.jira },
    );
  },

  async 'create-test-plan'(file) {
    const input = readJson(file);
    return graphql(
      `mutation ($ids: [String], $jira: JSON!) { createTestPlan(testIssueIds: $ids, jira: $jira) {
        testPlan { issueId jira(fields: ["key"]) } warnings } }`,
      { ids: input.testIssueIds ?? [], jira: input.jira },
    );
  },

  async 'add-tests-to-set'(issueId, list) {
    return graphql(
      `mutation ($id: String!, $ids: [String]!) { addTestsToTestSet(issueId: $id, testIssueIds: $ids) { addedTests warning } }`,
      { id: issueId, ids: ids(list) },
      { retry: true },
    );
  },

  async 'add-tests-to-plan'(issueId, list) {
    return graphql(
      `mutation ($id: String!, $ids: [String]!) { addTestsToTestPlan(issueId: $id, testIssueIds: $ids) { addedTests warning } }`,
      { id: issueId, ids: ids(list) },
      { retry: true },
    );
  },
};

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.error(`Unknown command: ${command ?? '(none)'}. Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
try {
  console.log(JSON.stringify(await commands[command](...args), null, 2));
} catch (error) {
  console.error(redact(error.message));
  process.exit(1);
}
