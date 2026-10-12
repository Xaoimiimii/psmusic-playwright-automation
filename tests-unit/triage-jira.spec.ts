import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bugDraft, buildProposals, parseDecision } from '../scripts/triage/proposals.mjs';
import { applyProposal, checkProposal } from '../scripts/triage/jira-actions.mjs';

// Phase 2 (docs/failure-triage.md §7) against an in-memory Jira/Xray: no credentials, no network.
// The triage input is the real deployed-run fixture, run through the phase-1 command.
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(__dirname, 'fixtures/deployed-run');
const projectMap = JSON.parse(fs.readFileSync(path.join(root, 'test-management/config/project-map.json'), 'utf8'));

function realTriage() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-'));
  execFileSync(process.execPath, [path.join(root, 'scripts/triage/triage.mjs'), '--report', path.join(fixtureDir, 'test-results.json'), '--allure', path.join(fixtureDir, 'allure-results.json'), '--out', out, '--triage-map', path.join(out, 'none.json')], {
    env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_RUN_ID: '' },
    stdio: 'pipe',
  });
  return JSON.parse(fs.readFileSync(path.join(out, 'triage.json'), 'utf8'));
}
const triage = realTriage();
const byScenario = (id: string) => triage.failures.find((f: { scenarioId: string }) => f.scenarioId === id);
const EXEC = 'MSC-900';

/** In-memory Jira + Xray with the operations the command uses, and a log of every write. */
function fakeApi({ bugStatus = 'To Do', bugCategory = 'new', existingDefects = [] as string[], labelled = [] as { key: string; id: string }[], dropDefect = false } = {}) {
  const issues: Record<string, { id: string; fields: Record<string, unknown> }> = {
    MSC: { id: '0', fields: {} },
    [EXEC]: { id: '9000', fields: { issuetype: { name: 'Test Execution' } } },
  };
  for (const f of triage.failures) issues[f.xrayTestKey] = { id: `1${f.xrayTestKey.split('-')[1]}`, fields: { issuetype: { name: 'Test' } } };
  for (const key of ['MSC-91', 'MSC-83', 'MSC-93', 'MSC-92', 'MSC-79']) {
    issues[key] = { id: `2${key.split('-')[1]}`, fields: { issuetype: { name: 'Bug' }, status: { name: bugStatus, statusCategory: { key: bugCategory } }, labels: [] } };
  }
  const runs: Record<string, { id: string; status: { name: string }; defects: string[] }> = {};
  const writes: string[] = [];
  let created = 0;
  return {
    writes,
    issues,
    getIssue: async (key: string) => {
      if (!issues[key]) throw new Error(`no issue ${key}`);
      return { key, ...issues[key] };
    },
    searchIssues: async () => labelled,
    createIssue: async (fields: { labels: string[] }) => {
      created += 1;
      const key = `MSC-${950 + created}`;
      issues[key] = { id: `3${created}`, fields: { issuetype: { name: 'Bug' }, labels: fields.labels, issuelinks: [] } };
      writes.push(`createIssue ${key}`);
      return { id: issues[key].id, key };
    },
    createIssueLink: async (type: string, inward: string, outward: string) => {
      (issues[inward].fields.issuelinks as unknown[]).push({ type: { name: type }, outwardIssue: { key: outward } });
      writes.push(`link ${inward} ${type} ${outward}`);
    },
    getTestRun: async (testId: string, execId: string) => (runs[`${testId}|${execId}`] ??= { id: `run-${testId}`, status: { name: 'FAILED' }, defects: [...existingDefects] }),
    getTestRunById: async (id: string) => Object.values(runs).find((r) => r.id === id),
    addDefectsToTestRun: async (id: string, keys: string[]) => {
      const run = Object.values(runs).find((r) => r.id === id)!;
      if (!dropDefect) run.defects.push(...keys.map((k) => issues[k].id));
      writes.push(`addDefects ${id} ${keys.join(',')}`);
      return { addedDefects: keys, warnings: [] };
    },
  };
}

/** Store with an inspectable audit log (the command's fileStore writes the same entries to triage-audit.jsonl). */
function store() {
  const entries: Record<string, unknown>[] = [];
  let map: { schemaVersion: number; fingerprints: Record<string, { bug: string; runs: unknown[] }> } = { schemaVersion: 1, fingerprints: {} };
  return {
    entries,
    get map() { return map; },
    loadMap: () => JSON.parse(JSON.stringify(map)),
    saveMap: (m: typeof map) => { map = JSON.parse(JSON.stringify(m)); },
    audit: (entry: Record<string, unknown>) => entries.push(entry),
  };
}

test.describe('proposals (no Jira access)', () => {
  test('a reproduced known defect is ready to link to its recorded Bug; nothing else is ready without a decision', () => {
    const proposals = buildProposals(triage, { testExecution: EXEC });
    const ready = proposals.filter((p: { status: string }) => p.status === 'ready');
    expect(ready.map((p: { bugKey: string }) => p.bugKey).sort()).toEqual(['MSC-83', 'MSC-91']);
    expect(ready.every((p: { type: string }) => p.type === 'link-defect')).toBe(true);
    const suspected = proposals.find((p: { test: { scenarioId: string } }) => p.test.scenarioId === 'TS-AUTH-11');
    expect(suspected).toMatchObject({ status: 'needs-decision', type: null });
    expect(suspected.candidates.map((c: { jiraKey: string }) => c.jiraKey)).toContain('MSC-93');
  });

  test('without a Test Execution nothing can be linked', () => {
    expect(buildProposals(triage).every((p: { status: string }) => p.status === 'blocked')).toBe(true);
  });

  test('a reviewer decision links a chosen Bug or asks for a new one, always with a recorded reason', () => {
    const fp = byScenario('TS-AUTH-11').fingerprint;
    const [link] = buildProposals(triage, { testExecution: EXEC, decisions: [parseDecision(`${fp}=BUG-A-11:deployed env cookie defect, see authentication.md 10`)] }).filter((p: { fingerprint: string }) => p.fingerprint === fp);
    expect(link).toMatchObject({ status: 'ready', type: 'link-defect', bugKey: 'MSC-93', relation: 'detected-by-test' });
    expect(() => parseDecision(`${fp}=new`)).toThrow(/reason/);
    expect(() => buildProposals(triage, { testExecution: EXEC, decisions: [parseDecision('0123456789abcdef=new:no such failure')] })).toThrow(/unknown fingerprint/);
  });

  test('a failure already linked for this execution is not proposed again', () => {
    const f = byScenario('TS-PROF-02');
    const triageMap = { fingerprints: { [f.fingerprint]: { bug: 'MSC-91', runs: [{ testExecution: EXEC, testKey: f.xrayTestKey }] } } };
    const p = buildProposals(triage, { testExecution: EXEC, triageMap }).find((x: { fingerprint: string }) => x.fingerprint === f.fingerprint);
    expect(p.status).toBe('already-done');
  });

  test('a Bug draft holds only facts from the triage record, masked, with provenance labels and no priority', () => {
    const f = byScenario('TS-AUTH-08');
    const [p] = buildProposals(triage, { testExecution: EXEC, decisions: [parseDecision(`${f.fingerprint}=new:reviewed, new defect`)] }).filter((x: { fingerprint: string }) => x.fingerprint === f.fingerprint);
    const draft = bugDraft(f, triage, p, { projectMap, stories: ['MSC-12'] });
    expect(draft.fields.labels).toEqual(['psmusic', 'found-by-automation', 'needs-confirmation', `triage-${f.fingerprint}`]);
    expect(draft.fields).not.toHaveProperty('priority');
    expect(draft.fields.description).toContain('reviewed, new defect');
    expect(draft.fields.description).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);
  });
});

test.describe('live checks and writes (fake Jira/Xray)', () => {
  const ready = (scenario: string, decisions: string[] = []) =>
    buildProposals(triage, { testExecution: EXEC, decisions: decisions.map(parseDecision) }).find((p: { test: { scenarioId: string } }) => p.test.scenarioId === scenario);

  test('links the known Bug to the failed test run, reads it back and audits intent and outcome', async () => {
    const api = fakeApi();
    const s = store();
    const checked = await checkProposal(ready('TS-PROF-02'), api);
    expect(checked.status).toBe('ready');
    const result = await applyProposal(checked, { api, store: s, failure: byScenario('TS-PROF-02'), triage, projectMap, stories: [] });
    expect(result).toMatchObject({ outcome: 'linked', bug: 'MSC-91' });
    expect(api.writes).toEqual([`addDefects ${checked.testRunId} MSC-91`]);
    expect(s.entries.map((e) => `${e.phase}:${e.operation}`)).toEqual(['intent:addDefectsToTestRun', 'outcome:addDefectsToTestRun']);
    expect(s.entries[1].verified).toBe(true);
    expect(Object.keys(s.map.fingerprints)).toEqual([byScenario('TS-PROF-02').fingerprint]);
  });

  test('a write that cannot be read back is reported unverified and not recorded as done', async () => {
    const api = fakeApi({ dropDefect: true });
    const s = store();
    const result = await applyProposal(await checkProposal(ready('TS-PROF-02'), api), { api, store: s, failure: byScenario('TS-PROF-02'), triage, projectMap, stories: [] });
    expect(result.outcome).toBe('unverified');
    expect(s.map.fingerprints).toEqual({});
  });

  test('a closed Bug is never reopened or linked automatically', async () => {
    const checked = await checkProposal(ready('TS-PROF-02'), fakeApi({ bugStatus: 'Done', bugCategory: 'done' }));
    expect(checked.status).toBe('blocked');
    expect(checked.reasons.join()).toContain('decide by hand');
  });

  test('a defect already on the test run is not added twice', async () => {
    const checked = await checkProposal(ready('TS-PROF-02'), fakeApi({ existingDefects: ['291'] }));
    expect(checked.status).toBe('already-done');
  });

  test('a reviewed new Bug is created once, related to its story, added to the run; a repeat reuses it', async () => {
    const f = byScenario('TS-AUTH-08');
    const decision = [`${f.fingerprint}=new:reviewed on 2026-10-12, not explained by MSC-92`];
    const api = fakeApi();
    const s = store();
    const result = await applyProposal(await checkProposal(ready('TS-AUTH-08', decision), api), { api, store: s, failure: f, triage, projectMap, stories: ['MSC-12'] });
    expect(result).toMatchObject({ outcome: 'created', bug: 'MSC-951' });
    expect(api.writes).toEqual(['createIssue MSC-951', 'link MSC-951 Relates MSC-12', 'addDefects run-1108 MSC-951']);

    // Interrupted earlier, run again: the fingerprint label finds the Bug, so it is linked, not created again.
    const again = await checkProposal(ready('TS-AUTH-08', decision), { ...fakeApi({ labelled: [{ key: 'MSC-951', id: '31' }] }) });
    expect(again).toMatchObject({ type: 'link-defect', bugKey: 'MSC-951', relation: 'previous-triage' });
  });
});

test.describe('write gate', () => {
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [path.join(root, 'scripts/triage/triage-jira.mjs'), 'apply', '--plan', 'missing.json', '--approve', 'P1'], {
      env: { ...process.env, TRIAGE_JIRA_WRITES: '', GITHUB_ACTIONS: '', ...env },
      encoding: 'utf8',
    });

  test('apply refuses unless writes are enabled for the command', () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Writes are disabled');
  });

  test('apply never runs in CI', () => {
    const result = run({ TRIAGE_JIRA_WRITES: 'enabled', GITHUB_ACTIONS: 'true' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('never runs in CI');
  });
});
