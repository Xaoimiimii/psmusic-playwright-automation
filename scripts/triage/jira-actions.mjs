// Live checks and writes for failure triage phase 2 (docs/failure-triage.md §7), used by triage-jira.mjs.
// Jira/Xray access comes in as `api` and the audit/state store as `store`, so unit tests use in-memory fakes.
// Writes only what checkProposal() left `ready`; reads every write back and audits intent and outcome.
import { bugDraft } from './proposals.mjs';

// ---------- live access (replaced by fakes in unit tests) ----------

/** Real Jira (REST) and Xray (GraphQL) access. Loaded lazily so unit tests never need credentials. */
export async function liveApi() {
  const jira = await import('../xray/jira-client.mjs');
  const { graphql } = await import('../xray/xray-client.mjs');
  const RUN_FIELDS = 'id status { name } defects test { jira(fields: ["key"]) } testExecution { jira(fields: ["key"]) }';
  return {
    getIssue: (key, fields) => jira.getIssue(key, fields),
    searchIssues: (jql, fields) => jira.searchIssues(jql, fields),
    createIssue: (fields) => jira.createIssue(fields),
    createIssueLink: (type, inward, outward) => jira.createIssueLink(type, inward, outward),
    async getTestRun(testIssueId, testExecIssueId) {
      const data = await graphql(`query ($t: String, $e: String) { getTestRun(testIssueId: $t, testExecIssueId: $e) { ${RUN_FIELDS} } }`, { t: testIssueId, e: testExecIssueId }, { retry: true });
      return data.getTestRun;
    },
    async getTestRunById(id) {
      const data = await graphql(`query ($id: String) { getTestRunById(id: $id) { ${RUN_FIELDS} } }`, { id }, { retry: true });
      return data.getTestRunById;
    },
    // Adding a defect that is already there changes nothing, so a retry is safe.
    async addDefectsToTestRun(id, issues) {
      const data = await graphql('mutation ($id: String!, $issues: [String]!) { addDefectsToTestRun(id: $id, issues: $issues) { addedDefects warnings } }', { id, issues }, { retry: true });
      return data.addDefectsToTestRun;
    },
  };
}

// ---------- live checks ----------

/** Status of the Bug and the test run right now. Turns a `ready` proposal into blocked / already-done when needed. */
export async function checkProposal(proposal, api) {
  if (proposal.status !== 'ready') return proposal;
  const checks = [];
  const test = await api.getIssue(proposal.test.key, ['issuetype']);
  const execution = await api.getIssue(proposal.testExecution, ['issuetype']);
  if (execution.fields.issuetype.name !== 'Test Execution') return { ...proposal, status: 'blocked', reasons: [...proposal.reasons, `${proposal.testExecution} is not a Test Execution`] };
  const run = await api.getTestRun(test.id, execution.id);
  if (!run) return { ...proposal, status: 'blocked', reasons: [...proposal.reasons, `${proposal.test.key} has no test run in ${proposal.testExecution}`] };
  checks.push(`test run ${run.id} (${run.status.name})`);

  if (proposal.type === 'link-defect') {
    const bug = await api.getIssue(proposal.bugKey, ['issuetype', 'status', 'labels']);
    if (bug.fields.issuetype.name !== 'Bug') return { ...proposal, status: 'blocked', reasons: [...proposal.reasons, `${proposal.bugKey} is a ${bug.fields.issuetype.name}, not a Bug`] };
    checks.push(`${proposal.bugKey} status ${bug.fields.status.name}`);
    if (bug.fields.status.statusCategory?.key === 'done') {
      return { ...proposal, status: 'blocked', checks, reasons: [...proposal.reasons, `${proposal.bugKey} is ${bug.fields.status.name}: a reproduction may be a regression; decide by hand (no automatic reopen)`] };
    }
    if ((run.defects ?? []).includes(bug.id)) return { ...proposal, status: 'already-done', checks, reasons: [...proposal.reasons, `${proposal.bugKey} is already a defect of this test run`] };
    return { ...proposal, checks, testRunId: run.id, bugIssueId: bug.id };
  }

  // create-bug: a Bug from an earlier, interrupted attempt carries the fingerprint label; reuse it.
  const existing = await api.searchIssues(`project = "${proposal.test.key.split('-')[0]}" AND issuetype = Bug AND labels = "triage-${proposal.fingerprint}"`, ['summary', 'status']);
  if (existing.length > 1) return { ...proposal, status: 'blocked', reasons: [...proposal.reasons, `${existing.length} Bugs carry label triage-${proposal.fingerprint}: resolve by hand`] };
  if (existing.length === 1) {
    return { ...proposal, type: 'link-defect', bugKey: existing[0].key, bugIssueId: existing[0].id, relation: 'previous-triage', testRunId: run.id, checks, reasons: [...proposal.reasons, `Bug ${existing[0].key} with this fingerprint already exists: linked instead of created`] };
  }
  return { ...proposal, checks, testRunId: run.id };
}

// ---------- writes ----------

async function linkDefect(proposal, api, store) {
  store.audit({ phase: 'intent', proposal: proposal.id, operation: 'addDefectsToTestRun', testRun: proposal.testRunId, bug: proposal.bugKey, testExecution: proposal.testExecution, test: proposal.test.key, decision: proposal.decision ?? null });
  await api.addDefectsToTestRun(proposal.testRunId, [proposal.bugKey]);
  const after = await api.getTestRunById(proposal.testRunId);
  const verified = (after?.defects ?? []).includes(proposal.bugIssueId);
  store.audit({ phase: 'outcome', proposal: proposal.id, operation: 'addDefectsToTestRun', testRun: proposal.testRunId, bug: proposal.bugKey, verified });
  return verified;
}

/** Applies one checked, approved proposal. Returns { id, outcome, ... }; never throws past one proposal. */
export async function applyProposal(proposal, { api, store, failure, triage, projectMap, stories }) {
  const map = store.loadMap();
  const remember = (bugKey, bugId, created) => {
    const entry = (map.fingerprints[proposal.fingerprint] ??= { bug: bugKey, bugId, createdByTriage: created, runs: [] });
    entry.runs.push({ testExecution: proposal.testExecution, testKey: proposal.test.key, testRunId: proposal.testRunId, linkedAt: new Date().toISOString() });
    store.saveMap(map);
  };

  if (proposal.type === 'link-defect') {
    const verified = await linkDefect(proposal, api, store);
    if (verified) remember(proposal.bugKey, proposal.bugId ?? null, false);
    return { id: proposal.id, outcome: verified ? 'linked' : 'unverified', bug: proposal.bugKey };
  }

  // create-bug
  const draft = bugDraft(failure, triage, proposal, { projectMap, stories });
  store.audit({ phase: 'intent', proposal: proposal.id, operation: 'createIssue', fingerprint: proposal.fingerprint, summary: draft.fields.summary, labels: draft.fields.labels, decision: proposal.decision });
  const created = await api.createIssue(draft.fields);
  const readBack = await api.getIssue(created.key, ['labels', 'issuetype']);
  const createdOk = readBack.fields.issuetype.name === 'Bug' && readBack.fields.labels.includes(`triage-${proposal.fingerprint}`);
  store.audit({ phase: 'outcome', proposal: proposal.id, operation: 'createIssue', bug: created.key, verified: createdOk });
  if (!createdOk) return { id: proposal.id, outcome: 'unverified', bug: created.key };
  // Recorded before the links, so a failure below never leads to a second Bug for this fingerprint.
  map.fingerprints[proposal.fingerprint] = { bug: created.key, bugId: null, createdByTriage: true, runs: [] };
  store.saveMap(map);

  const linked = [];
  for (const story of stories) {
    store.audit({ phase: 'intent', proposal: proposal.id, operation: 'createIssueLink', type: 'Relates', bug: created.key, story });
    await api.createIssueLink('Relates', created.key, story);
    const links = (await api.getIssue(created.key, ['issuelinks'])).fields.issuelinks ?? [];
    const ok = links.some((l) => l.type.name === 'Relates' && (l.outwardIssue?.key === story || l.inwardIssue?.key === story));
    store.audit({ phase: 'outcome', proposal: proposal.id, operation: 'createIssueLink', bug: created.key, story, verified: ok });
    linked.push({ story, verified: ok });
  }
  const verified = await linkDefect({ ...proposal, bugKey: created.key, bugIssueId: created.id }, api, store);
  if (verified) {
    const next = store.loadMap();
    next.fingerprints[proposal.fingerprint].runs.push({ testExecution: proposal.testExecution, testKey: proposal.test.key, testRunId: proposal.testRunId, linkedAt: new Date().toISOString() });
    store.saveMap(next);
  }
  return { id: proposal.id, outcome: verified && linked.every((l) => l.verified) ? 'created' : 'created-unverified-links', bug: created.key, stories: linked };
}

