// Builds test-management/state/plan.json (schema: test-management/state/plan.schema.json) from the test-design
// documents. Parsing is delegated to scripts/test-management/jira-export.mjs (run into test-management/tmp/plan-export) so the plan
// and the CSV import files never disagree. No Jira or Xray call is made here.
//
// Usage: node scripts/test-management/build-plan.mjs [--approve]
//   --approve  marks every non-blocked entity approved (only when the person running the sync has authorized it;
//              approvals of unchanged entities in an existing plan.json are always kept).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const rel = (file) => path.relative(root, file).replace(/\\/g, '/');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const approveAll = process.argv.includes('--approve');

const sourceFiles = [
  'docs/requirements/user-stories.md',
  'docs/test-strategy/test-strategy.md',
  'docs/test-strategy/risk-register.md',
  'docs/test-strategy/test-scenarios.md',
  'docs/test-strategy/automation-analysis.md',
  'docs/test-case-implementation-progress.md',
  'docs/exploration/exploration-validation.md',
  'docs/exploration/browser/authentication.md',
  'scripts/test-management/jira-export.mjs',
];

// ---------- run the existing parser ----------

const exportDir = path.join(root, 'test-management/tmp/plan-export');
execFileSync(process.execPath, [path.join(root, 'scripts/test-management/jira-export.mjs')], {
  env: { ...process.env, JIRA_EXPORT_OUT: exportDir },
  stdio: 'ignore',
});

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else if (c !== '\r') cell += c;
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
const csv = (name) => parseCsv(fs.readFileSync(path.join(exportDir, `${name}.csv`), 'utf8'));

/** The export writes Jira wiki markup; MCP takes Markdown. Reverses jira-export.mjs toJira(). */
const toMarkdown = (text) =>
  text
    .replace(/\{\{(.+?)\}\}(?!\})/g, '`$1`')
    .replace(/(^|[\s(|:])\*([^*\n]+?)\*(?=[\s).,;:|]|$)/gm, '$1**$2**')
    .replace(/^h3\. /gm, '### ')
    .replace(/^bq\. /gm, '> ');

const words = (s) => s.split(/\s+/).filter(Boolean);
const truncate = (s, n = 255) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
const idLabel = (localId) => `lid_${localId}`;
/** Classification label written by jira-export.mjs: "automate", "automate-ui", "automate-multi-layer", ... */
const isAutomateClass = (labels) => labels.some((l) => l === 'automate' || l.startsWith('automate-'));

// ---------- automated specs and smoke tags (tests/**) ----------

function scanSpecs() {
  const specs = {};
  const smoke = new Set();
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(path.join(root, 'tests')).filter((f) => f.endsWith('.spec.ts')).sort()) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/(?:test(?:\.describe)?\(\s*['`]|scenario:\s*')(TS-[A-Z0-9]+-\d+)((?:\\.|[^'`\\])*)['`]/);
      if (!m) return;
      const id = m[1];
      specs[id] ??= `${rel(file)} > ${(m[1] + m[2].replace(/\\(.)/g, '$1')).trim()}`;
      // A smoke tag on the test line or within the next few lines (tag arrays are on the same call).
      if (/@smoke/.test(lines.slice(i, i + 6).join('\n'))) smoke.add(id);
    });
  }
  return { specs, smoke };
}

/** Area code -> area name, from the "# Area" headings of the progress document. */
function areaNames() {
  const names = {};
  let heading = null;
  for (const line of read('docs/test-case-implementation-progress.md').split('\n')) {
    const h = line.match(/^# (.+)$/);
    if (h) heading = h[1].trim();
    const row = line.match(/^\| TS-([A-Z0-9]+)-\d+ \|/);
    if (row && heading) names[row[1]] ??= heading;
  }
  return names;
}

// ---------- entities ----------

const entities = [];
const relationships = [];
const ambiguities = [];
const coverageGaps = [];
const add = (entity) => entities.push({ approved: false, ...entity });
const link = (kind, from, to, relationshipKey, source) => relationships.push({ kind, from, to, relationshipKey, source });

const epics = csv('epics');
for (const e of epics) {
  add({
    localId: e['Epic ID'],
    type: 'epic',
    summary: e.Summary,
    description: toMarkdown(e.Description),
    labels: [...words(e.Labels), idLabel(e['Epic ID'])],
    priority: null,
    source: `docs/test-strategy/test-strategy.md#3-functional-test-areas (${e['Epic ID']})`,
  });
}

const stories = csv('stories');
for (const s of stories) {
  const id = s['Story ID'];
  const isTech = id === 'TECH';
  add({
    localId: id,
    type: isTech ? 'requirement' : 'story',
    summary: isTech ? 'TECH Technical behaviors (API access control and cross-cutting rules)' : s.Summary,
    description: toMarkdown(s.Description),
    labels: [...words(s.Labels), idLabel(id)],
    priority: null,
    source: `docs/requirements/user-stories.md#${isTech ? 'technical-behaviors' : id}`,
  });
  if (s['Epic ID']) link('parent', id, s['Epic ID'], isTech ? 'requirementParent' : 'storyParent', 'docs/test-strategy/test-strategy.md §3');
}
ambiguities.push({
  id: 'AMB-TECH-NO-EPIC',
  description: 'TECH (Technical behaviors) is cross-cutting and belongs to no functional area in test-strategy.md §3, so it has no parent Epic. Planned as a Requirement without parent.',
  affects: ['TECH'],
  blocking: false,
});

const risks = csv('risks');
const riskPriority = {};
for (const r of risks) {
  const id = r['Risk ID'];
  riskPriority[id] = (r.Labels.match(/\bp([123])\b/) ?? [])[1] ? `P${r.Labels.match(/\bp([123])\b/)[1]}` : null;
  add({
    localId: id,
    type: 'risk',
    summary: r.Summary,
    description: toMarkdown(r.Description),
    labels: [...words(r.Labels), idLabel(id)],
    priority: r.Priority || null,
    source: `docs/test-strategy/risk-register.md#${id}`,
  });
  for (const story of words(r['Story IDs'])) link('issueLink', id, story, 'riskRelatesToStory', `docs/test-strategy/risk-register.md §2.1 (${id})`);
  for (const epic of words(r['Epic IDs'])) link('issueLink', id, epic, 'riskRelatesToEpic', `docs/test-strategy/risk-register.md §2.1 (${id})`);
}

const { specs, smoke } = scanSpecs();
const tests = csv('tests');
const knownStories = new Set(stories.map((s) => s['Story ID']));
const knownRisks = new Set(risks.map((r) => r['Risk ID']));
const automateIds = [];
for (const t of tests) {
  const id = t['Test ID'];
  const labels = words(t.Labels);
  const automated = labels.includes('automated') || labels.includes('partially-automated');
  if (isAutomateClass(labels)) automateIds.push(id);
  add({
    localId: id,
    type: 'test',
    summary: t.Summary,
    description: toMarkdown(t.Description),
    labels: [...words(t.Labels), idLabel(id), ...(smoke.has(id) ? ['smoke'] : [])],
    priority: t.Priority || null,
    xray: {
      testType: 'Manual',
      steps: [
        {
          action: toMarkdown(t.Action) || '(see description)',
          ...(t.Data ? { data: toMarkdown(t.Data) } : {}),
          result: toMarkdown(t['Expected Result']) || '(see description)',
        },
      ],
      unstructured: null,
      automatedSpec: automated ? (specs[id] ?? null) : null,
    },
    source: `docs/test-strategy/test-scenarios.md#${id}`,
  });
  for (const story of words(t['Story IDs'])) {
    if (!knownStories.has(story)) {
      ambiguities.push({ id: `AMB-${id}-UNKNOWN-${story}`, description: `${id} references ${story}, which is not in user-stories.md.`, affects: [id], blocking: false });
      continue;
    }
    link('issueLink', id, story, 'testCoversRequirement', `docs/test-strategy/test-scenarios.md (${id} Story field)`);
  }
  for (const risk of words(t['Risk IDs'])) {
    if (!knownRisks.has(risk)) continue;
    link('issueLink', id, risk, 'testCoversRisk', `docs/test-strategy/test-scenarios.md (${id} Risk field)`);
  }
  if (automated && !specs[id]) {
    ambiguities.push({ id: `AMB-${id}-NO-SPEC`, description: `${id} is marked implemented in test-case-implementation-progress.md, but no spec title or scenario row in tests/ names it.`, affects: [id], blocking: false });
  }
}
ambiguities.push({
  id: 'AMB-AUTOMATED-TEST-TYPE',
  description:
    'All Tests are planned as Xray "Manual" with one step (Flow / Data / Expected) because project-map.json has no automatedTestType and the JUnit import mapping (test_key annotations) is not built. Implemented scenarios carry automatedSpec and the automated label; converting them to Generic is deferred to the import-xray-results work.',
  affects: tests.filter((t) => ['automated', 'partially-automated'].some((l) => words(t.Labels).includes(l))).map((t) => t['Test ID']),
  blocking: false,
});

const bugs = csv('bugs');
for (const b of bugs) {
  const id = `BUG-${b['Bug ID']}`;
  const observed = b.Summary.replace(/^[A-Z0-9-]+:\s*/, '');
  // Some observations ("Server accepts") only make sense next to the expected behavior.
  const expected = (toMarkdown(b.Description).match(/^\*\*Expected:\*\* (.*)$/m)?.[1] ?? '').replace(/`/g, '');
  add({
    localId: id,
    type: 'bug',
    summary: truncate(observed.length < 100 && expected ? `${id} ${observed} (expected: ${expected})` : `${id} ${observed}`),
    description: toMarkdown(b.Description),
    labels: [...words(b.Labels), idLabel(id)],
    priority: b.Priority || null,
    source: /^A-\d+$/.test(b['Bug ID']) ? `docs/exploration/browser/authentication.md#${b['Bug ID']}` : `docs/exploration/exploration-validation.md#2 (${b['Bug ID']})`,
  });
  for (const story of words(b['Story IDs'])) link('issueLink', id, story, 'bugAffectsStory', `docs/exploration/exploration-validation.md §2 (${b['Bug ID']})`);
  for (const test of words(b['Detected by tests'])) link('issueLink', test, id, 'bugFoundByTest', `docs/exploration/exploration-validation.md §2 (${b['Bug ID']} detected by)`);
  if (!b['Risk ID']) {
    ambiguities.push({ id: `AMB-${id}-NO-RISK`, description: `${id} has no matching risk in risk-register.md (labelled needs-triage).`, affects: [id], blocking: false });
  }
  if (/needs-confirmation/.test(b.Labels)) {
    ambiguities.push({ id: `AMB-${id}-UNCONFIRMED`, description: `${id} is recorded as "needs confirmation as a defect" in browser/authentication.md. Created as a Bug with the needs-confirmation label.`, affects: [id], blocking: false });
  }
}
ambiguities.push({
  id: 'AMB-BUG-FOUND-BY-TEST',
  description:
    'Bugs were found by exploration, not by a failed Xray test run, and the Defect link type semantics are undocumented (project-map.json bugFoundByTest.semanticsVerified=false). Test -> Bug links are planned but will be skipped; Xray records defects on test runs once executions are imported.',
  affects: bugs.map((b) => `BUG-${b['Bug ID']}`),
  blocking: false,
});

// ---------- Test Sets and Test Plans ----------

const names = areaNames();
const byArea = {};
for (const t of tests) (byArea[t['Test ID'].split('-')[1]] ??= []).push(t['Test ID']);
for (const [area, ids] of Object.entries(byArea)) {
  const localId = `SET-${area}`;
  add({
    localId,
    type: 'testSet',
    summary: `${localId} ${names[area] ?? area} scenarios`,
    description: `All test scenarios of area ${area} (${names[area] ?? 'unknown name'}) from docs/test-strategy/test-scenarios.md: ${ids.join(', ')}.`,
    labels: ['psmusic', `area-${area.toLowerCase()}`, idLabel(localId)],
    priority: null,
    source: `docs/test-strategy/test-scenarios.md (area ${area})`,
  });
  for (const id of ids) link('testSetMember', id, localId, null, 'test ID area');
}

const plans = [
  {
    localId: 'PLAN-REGRESSION',
    summary: 'PLAN-REGRESSION Automated regression scope',
    description: 'Scenarios classified AUTOMATE in docs/test-strategy/automation-analysis.md §3 (implemented or not). Scope for the automated regression run (test-strategy.md §10.2–10.3).',
    members: automateIds,
    source: 'docs/test-strategy/automation-analysis.md §3; test-strategy.md §10',
  },
  {
    localId: 'PLAN-SMOKE',
    summary: 'PLAN-SMOKE Smoke gate',
    description: 'Scenarios with a test tagged @smoke in tests/ (the PR gate, test-strategy.md §10.1, npm run test:smoke).',
    members: [...smoke].sort(),
    source: 'tests/**/*.spec.ts @smoke tags; test-strategy.md §10.1',
  },
];
for (const p of plans) {
  add({ localId: p.localId, type: 'testPlan', summary: p.summary, description: p.description, labels: ['psmusic', idLabel(p.localId)], priority: null, source: p.source });
  for (const id of p.members) link('testPlanMember', id, p.localId, null, p.source);
}

// ---------- coverage gaps ----------

const covered = (to, key) => relationships.some((r) => r.relationshipKey === key && r.to === to);
for (const s of stories) {
  if (!covered(s['Story ID'], 'testCoversRequirement')) coverageGaps.push({ localId: s['Story ID'], gap: 'In-scope story with no test scenario referencing it.' });
}
for (const r of risks) {
  const id = r['Risk ID'];
  if (riskPriority[id] !== 'P1') continue;
  if (id.startsWith('TR-')) {
    coverageGaps.push({ localId: id, gap: 'P1 test/project risk: mitigated by process (risk-register.md §4 Mitigation), not by a product test. Documented exception.' });
  } else if (!covered(id, 'testCoversRisk')) {
    coverageGaps.push({ localId: id, gap: 'P1 product risk with no test scenario referencing it.' });
  }
}
for (const t of tests) {
  const labels = words(t.Labels);
  if (labels.includes('p1') && labels.includes('not-automated') && isAutomateClass(labels)) {
    coverageGaps.push({ localId: t['Test ID'], gap: 'P1 scenario classified AUTOMATE but not implemented yet.' });
  }
}

// ---------- approvals, diff, write ----------

const planFile = path.join(root, 'test-management/state/plan.json');
const previous = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
const hash = (e) => crypto.createHash('sha256').update(JSON.stringify({ ...e, approved: undefined })).digest('hex');
const prevById = Object.fromEntries((previous?.entities ?? []).map((e) => [e.localId, e]));
const blocked = new Set(ambiguities.filter((a) => a.blocking).flatMap((a) => a.affects));
for (const e of entities) {
  const prev = prevById[e.localId];
  if (approveAll && !blocked.has(e.localId)) e.approved = true;
  else if (prev && hash(prev) === hash(e)) e.approved = prev.approved;
}

const plan = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  sources: sourceFiles.map((file) => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
  entities,
  relationships,
  ambiguities,
  coverageGaps,
};
fs.mkdirSync(path.dirname(planFile), { recursive: true });
fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);

const count = (list, key) => list.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] ?? 0) + 1), acc), {});
const relCount = count(relationships.map((r) => ({ k: r.relationshipKey ?? r.kind })), 'k');
const diff = previous
  ? {
      added: entities.filter((e) => !prevById[e.localId]).map((e) => e.localId),
      removed: previous.entities.filter((e) => !entities.some((x) => x.localId === e.localId)).map((e) => e.localId),
      changed: entities.filter((e) => prevById[e.localId] && hash(prevById[e.localId]) !== hash(e)).map((e) => e.localId),
    }
  : null;
console.log(JSON.stringify({ entities: count(entities, 'type'), approved: entities.filter((e) => e.approved).length, relationships: relCount, ambiguities: ambiguities.length, coverageGaps: coverageGaps.length, diff }, null, 2));
