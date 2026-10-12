// Failure triage phase 2: approved Jira/Xray changes from a triage.json (docs/failure-triage.md §7).
// Run by a person, locally; refuses to write in CI.
//
//   plan  --triage <triage.json> [--test-execution KEY] [--decide <fp>=<BUG-…|KEY|new|skip>:<reason>]...
//         Read-only. Builds proposals (proposals.mjs), checks each against live Jira/Xray, writes
//         test-management/reports/triage-plan-<timestamp>.json and prints the table.
//   apply --plan <triage-plan.json> --approve P1,P3
//         Needs TRIAGE_JIRA_WRITES=enabled. For each approved `ready` proposal: checks again, writes, reads back,
//         and records it in test-management/reports/triage-audit.jsonl and test-management/state/triage-map.json.
//
// Writes it can make: add a Bug as a defect of an Xray test run; create a reviewed Bug (needs-confirmation), relate it
// to the story, add it to the test run. Never closes, resolves, reassigns, re-prioritizes or edits an existing Bug.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildBugIndex } from './bug-index.mjs';
import { applyProposal, checkProposal, liveApi } from './jira-actions.mjs';
import { buildProposals, parseDecision } from './proposals.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fromRoot = (file) => path.resolve(root, file);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const STATE_FILE = 'test-management/state/triage-map.json';
export const AUDIT_FILE = 'test-management/reports/triage-audit.jsonl';

// ---------- audit and state ----------

/** Who ran it: the git user name (not an e-mail address, which is personal data). */
const actor = () => {
  try {
    return execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
};

export function fileStore(dir = root) {
  const state = path.join(dir, STATE_FILE);
  const audit = path.join(dir, AUDIT_FILE);
  return {
    loadMap: () => (fs.existsSync(state) ? readJson(state) : { schemaVersion: 1, fingerprints: {} }),
    saveMap: (map) => {
      fs.mkdirSync(path.dirname(state), { recursive: true });
      fs.writeFileSync(state, `${JSON.stringify(map, null, 2)}\n`);
    },
    // Append-only: one line before a write (intent) and one after (outcome), so an interrupted write is visible.
    audit: (entry) => {
      fs.mkdirSync(path.dirname(audit), { recursive: true });
      fs.appendFileSync(audit, `${JSON.stringify({ at: new Date().toISOString(), actor: actor(), ...entry })}\n`);
    },
  };
}

// ---------- command ----------

function args(argv) {
  const out = { decide: [] };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, '');
    if (name === 'decide') out.decide.push(argv[++i]);
    else if (argv[i].startsWith('--')) out[name] = argv[++i];
    else out._ = argv[i];
  }
  return out;
}

const table = (proposals) => [
  '| # | Test | Xray | Triage | Proposal | Status | Why |',
  '|---|---|---|---|---|---|---|',
  ...proposals.map((p) => `| ${p.id} | ${p.test.title.replace(/\|/g, '/')} | ${p.test.key ?? '—'} | ${p.classification.category} (${p.classification.confidence}) | ${p.type ? `${p.type}${p.bugKey ? ` → ${p.bugKey}` : ''}` : '—'} | **${p.status}** | ${[...p.reasons, ...(p.checks ?? [])].join('; ').replace(/\|/g, '/')} |`),
].join('\n');

/** Jira keys of the stories a scenario's Test covers (plan relations + issue map). */
function storyKeysFor(scenarioId) {
  const plan = readJson(fromRoot('test-management/state/plan.json'));
  const issueMap = readJson(fromRoot('test-management/state/issue-map.json'));
  const test = buildBugIndex(plan, issueMap).tests.get(scenarioId);
  return (test?.stories ?? []).map((id) => issueMap.entities[id]?.jiraKey).filter(Boolean);
}

async function plan(options, api, store) {
  if (!options.triage) throw new Error('plan needs --triage <triage.json>');
  const triage = readJson(path.resolve(options.triage));
  const decisions = options.decide.map(parseDecision);
  const proposals = buildProposals(triage, { decisions, triageMap: store.loadMap(), testExecution: options['test-execution'] });
  const checked = [];
  for (const proposal of proposals) checked.push(await checkProposal(proposal, api));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const file = fromRoot(`test-management/reports/triage-plan-${stamp}.json`);
  // Forward slashes, so a plan written on Windows applies anywhere.
  const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ createdAt: new Date().toISOString(), triageFile: rel(path.resolve(options.triage)), proposals: checked }, null, 2)}\n`);
  console.log(`${table(checked)}\n\nPlan: ${rel(file)}. Nothing was written to Jira or Xray.`);
  const ready = checked.filter((p) => p.status === 'ready').map((p) => p.id);
  console.log(ready.length ? `Ready: ${ready.join(', ')}. To apply after review: TRIAGE_JIRA_WRITES=enabled node scripts/triage/triage-jira.mjs apply --plan ${rel(file)} --approve ${ready.join(',')}` : 'Nothing ready to apply.');
}

async function apply(options, api, store) {
  if (process.env.GITHUB_ACTIONS) throw new Error('triage-jira apply never runs in CI');
  if (process.env.TRIAGE_JIRA_WRITES !== 'enabled') throw new Error('Writes are disabled: set TRIAGE_JIRA_WRITES=enabled for this command only');
  if (!options.plan || !options.approve) throw new Error('apply needs --plan <file> and --approve P1,P2');
  const planFile = readJson(path.resolve(options.plan));
  const triage = readJson(fromRoot(planFile.triageFile));
  const projectMap = readJson(fromRoot('test-management/config/project-map.json'));
  const approved = options.approve.split(',').map((s) => s.trim());
  const results = [];
  for (const id of approved) {
    const planned = planFile.proposals.find((p) => p.id === id);
    if (!planned) { results.push({ id, outcome: 'not-in-plan' }); continue; }
    // Checked again now: the Bug or the run may have changed since the plan.
    const proposal = await checkProposal(planned, api);
    if (proposal.status !== 'ready') { results.push({ id, outcome: `not-applied (${proposal.status})`, reasons: proposal.reasons }); continue; }
    const failure = triage.failures.find((f) => f.fingerprint === proposal.fingerprint);
    try {
      results.push(await applyProposal(proposal, { api, store, failure, triage, projectMap, stories: storyKeysFor(proposal.test.scenarioId) }));
    } catch (error) {
      store.audit({ phase: 'error', proposal: id, message: String(error.message).slice(0, 500) });
      results.push({ id, outcome: 'error', message: error.message });
      break; // Stop: an unknown outcome must be looked at before anything else is written.
    }
  }
  console.log(JSON.stringify(results, null, 2));
  console.log(`Audit: ${AUDIT_FILE}. State: ${STATE_FILE}. Commit both.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const options = args(process.argv.slice(2));
  const command = { plan, apply }[options._];
  if (!command) {
    console.error('Usage: node scripts/triage/triage-jira.mjs plan --triage <file> [--test-execution KEY] [--decide fp=target:reason]... | apply --plan <file> --approve P1,P2');
    process.exit(2);
  }
  try {
    await command(options, await liveApi(), fileStore());
  } catch (error) {
    const { redact } = await import('../xray/xray-client.mjs');
    console.error(redact(error.message));
    process.exit(1);
  }
}
