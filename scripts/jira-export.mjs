// Generates Jira / Xray import files from the test-design documents, so the
// CSVs never drift from the Markdown they come from.
//   docs/jira-import/epics.csv    <- docs/test-strategy/test-strategy.md §3 (functional areas)
//   docs/jira-import/stories.csv  <- docs/requirements/user-stories.md
//   docs/jira-import/risks.csv    <- docs/test-strategy/risk-register.md §2, §3, §4
//   docs/jira-import/tests.csv    <- docs/test-strategy/test-scenarios.md
//                                    + automation-analysis.md §3 (classification)
//                                    + test-case-implementation-progress.md (status)
//   docs/jira-import/bugs.csv     <- docs/exploration/exploration-validation.md §2
//                                    + browser/authentication.md (A-7, A-11)
//                                    + risk-register.md §2.1 (severity, priority)
// Usage: node scripts/jira-export.mjs [path/to/keys.json]
// keys.json (optional) maps ids to Jira keys once the issues exist, e.g.
// {"FA-01": "PSM-1", "US-001": "PSM-20", "PR-01": "PSM-50", "TS-AUTH-10": "PSM-140"}.
// Each import step adds the key columns for the issues already imported:
// epic keys -> "Parent key" in stories.csv; story keys -> "Requirement keys" in
// tests.csv and "Linked story keys" in risks.csv; risk keys -> "Risk keys" in
// tests.csv and bugs.csv; test keys -> "Linked test keys" in bugs.csv.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
// JIRA_EXPORT_OUT writes elsewhere, e.g. to compare with the committed files.
const outDir = process.env.JIRA_EXPORT_OUT ?? path.join(root, 'docs/jira-import');

const keysFile = process.argv[2];
const keys = keysFile ? JSON.parse(fs.readFileSync(keysFile, 'utf8')) : null;

// ---------- helpers ----------

/** Markdown inline marks to Jira wiki markup (the CSV importer renders descriptions as wiki markup). */
function toJira(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/`([^`]+)`/g, '{{$1}}')
    .replace(/^#{3,} (.*)$/gm, 'h3. $1')
    .replace(/^> ?/gm, 'bq. ');
}

function csv(rows, columns) {
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.map(cell).join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\r\n') + '\r\n';
}

/** Cells of a Markdown table row, without the outer pipes. */
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const label = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Risk priority to Jira priority (same mapping for tests and bugs). */
const jiraPriority = { P1: 'High', P2: 'Medium', P3: 'Low' };

/** Story ids referenced by a "Story" field, e.g. "US-016-AC-07, US-020-AC-04, SD-5" -> ["US-016", "US-020"]. */
function storyIds(storyField) {
  const ids = [...storyField.matchAll(/US-\d{3}/g)].map((m) => m[0]);
  if (/Technical behaviors/i.test(storyField)) ids.push('TECH');
  return [...new Set(ids)];
}

/** Full AC ids of a "Story" field, expanding short forms: "US-014-AC-02, AC-03" -> US-014-AC-02, US-014-AC-03. */
function acIds(storyField) {
  const ids = [];
  let story = null;
  for (const m of storyField.matchAll(/(US-\d{3})(?:-AC-(\d+))?|\bAC-(\d+)/g)) {
    if (m[1]) story = m[1];
    const n = m[2] ?? m[3];
    if (story && n) ids.push(`${story}-AC-${n.padStart(2, '0')}`);
  }
  return ids;
}

/** Jira keys for the ids that have one in keys.json, comma-separated (empty without keys.json). */
const keysOf = (ids) => (keys ? ids.map((id) => keys[id]).filter(Boolean).join(',') : '');

/** Fields of a "| Field | Value |" table (risk-register.md §3). */
function fieldTable(text) {
  const fields = {};
  for (const line of text.split('\n')) {
    if (!line.startsWith('| ') || /^\| (Field|---)/.test(line)) continue;
    const [name, ...value] = cells(line);
    fields[name] = value.join(' | ');
  }
  return fields;
}

// ---------- epics (functional areas) ----------

function parseEpics() {
  const text = read('docs/test-strategy/test-strategy.md');
  const section = text.split(/^## 3\. Functional Test Areas/m)[1].split(/^## /m)[0];
  return section
    .split('\n')
    .filter((line) => /^\| FA-\d{2} \|/.test(line))
    .map((line) => {
      const [id, area, stories, behaviors, constraints] = cells(line);
      return {
        'Epic ID': id,
        'Issue Type': 'Epic',
        Summary: `${id} ${area}`,
        Description: toJira(
          [
            `*Stories:* ${stories}`,
            `*Key behaviors:* ${behaviors}`,
            `*Main constraints:* ${constraints || '-'}`,
            '',
            'Source: docs/test-strategy/test-strategy.md §3',
          ].join('\n'),
        ),
        Labels: ['psmusic', 'functional-area', label(id)].join(' '),
        // Whole stories only: "US-016-AC-07" in FA-03 is one AC of a story whose epic is FA-09.
        _stories: [...stories.matchAll(/US-(\d{3})(?: to US-(\d{3}))?(?!-AC)/g)].flatMap((m) => {
          const [from, to] = [Number(m[1]), Number(m[2] ?? m[1])];
          return Array.from({ length: to - from + 1 }, (_, i) => `US-${String(from + i).padStart(3, '0')}`);
        }),
      };
    });
}

// ---------- stories ----------

function parseStories(epics) {
  const text = read('docs/requirements/user-stories.md');
  const sections = text.split(/^## /m).slice(1);
  const stories = [];
  for (const section of sections) {
    const [heading, ...body] = section.split('\n');
    const us = heading.match(/^(US-\d{3}) (.*)$/);
    const isTech = heading.trim() === 'Technical behaviors';
    if (!us && !isTech) continue;
    const id = us ? us[1] : 'TECH';
    const title = us ? us[2].trim() : 'Technical behaviors (API access control and cross-cutting rules)';
    const content = body.join('\n').replace(/\n---\s*$/, '').trim();
    const labels = ['psmusic'];
    if (/\bDEFECT\b/.test(content)) labels.push('has-defect');
    if (/\bBLOCKED\b/.test(content)) labels.push('blocked');
    if (/PROVISIONAL/.test(content)) labels.push('provisional');
    // "Technical behaviors" is cross-cutting: no functional area, so no epic.
    const epic = epics.find((e) => e._stories.includes(id))?.['Epic ID'] ?? '';
    stories.push({
      'Story ID': id,
      'Issue Type': 'Story',
      Summary: `${id === 'TECH' ? 'Technical behaviors' : id} ${id === 'TECH' ? '' : title}`.trim(),
      Description: `${toJira(content)}\n\nSource: docs/requirements/user-stories.md`,
      Labels: labels.join(' '),
      'Epic ID': epic,
      ...(keys && { 'Parent key': keysOf([epic]) }),
    });
  }
  return stories;
}

// ---------- tests ----------

function parseClassification() {
  const text = read('docs/test-strategy/automation-analysis.md');
  const byId = {};
  for (const line of text.split('\n')) {
    if (!/^\| TS-[A-Z0-9]+-\d+ \|/.test(line)) continue;
    const row = cells(line);
    const classification = row.find((c) => /^(AUTOMATE|MANUAL|DEFER|EXPLORATORY)\b/.test(c));
    if (classification && !byId[row[0]]) byId[row[0]] = classification;
  }
  return byId;
}

function parseImplementationStatus() {
  const text = read('docs/test-case-implementation-progress.md');
  const byId = {};
  for (const line of text.split('\n')) {
    if (!/^\| TS-[A-Z0-9]+-\d+ \|/.test(line)) continue;
    const row = cells(line);
    const status = row[row.length - 1];
    if (['Yes', 'Partial', 'No'].includes(status)) byId[row[0]] = status;
  }
  return byId;
}

function parseScenarios() {
  const text = read('docs/test-strategy/test-scenarios.md');
  const classification = parseClassification();
  const status = parseImplementationStatus();
  const statusLabel = { Yes: 'automated', Partial: 'partially-automated', No: 'not-automated' };

  const tests = [];
  const blocks = text.split(/^#### /m).slice(1);
  for (const block of blocks) {
    const [heading, ...lines] = block.split(/\n(?=- \*\*)/);
    const head = heading.split('\n')[0].match(/^(TS-[A-Z0-9]+-\d+) (.*?) \[(P[123])\](?:\s*—\s*(.*))?$/);
    if (!head) continue; // the format example in "How to read a scenario"
    const [, id, title, priority, flags = ''] = head;

    const field = {};
    for (const line of lines) {
      const m = line.match(/^- \*\*([A-Za-z]+)(?::\*\*|\*\*)\s*([\s\S]*)$/);
      if (m) field[m[1]] = m[2].replace(/\n+(?=#{1,3} |---)[\s\S]*$/, '').trim();
    }
    // "Level SYS · Layers UI · Story US-001-AC-01 · Risk PR-22 · Condition TC-PR22-1"
    const meta = {};
    for (const part of (field.Level ?? '').split('·')) {
      const m = part.trim().match(/^(?:\*\*)?(Level|Layers|Story|Risk|Condition)(?:\*\*)?\s+(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    meta.Level = (field.Level ?? '').split('·')[0].trim();
    // "Data: x. **Rule:** y." and "Dependencies: x. **Notes:** y." share a bullet.
    const [data, rule] = (field.Data ?? '').split(/\s*\*\*Rule:\*\*\s*/);
    const [dependencies, notes] = (field.Dependencies ?? '').split(/\s*\*\*Notes:\*\*\s*/);

    const area = id.split('-')[1];
    const cls = classification[id] ?? '';
    const impl = status[id] ?? 'No';
    const labels = ['psmusic', `area-${label(area)}`, label(priority), `level-${label(meta.Level.split(/[+ ]/)[0])}`, statusLabel[impl]];
    if (cls) labels.push(label(cls.replace(/—/g, ' ')));
    for (const flag of flags.split(',').map((f) => f.trim()).filter(Boolean)) labels.push(label(flag.replace(/\(.*\)/, '')));

    const stories = storyIds(meta.Story ?? '');
    // Product risks only: TR-nn are risks to the test project, which a test does not cover.
    const risks = [...new Set([...(meta.Risk ?? '').matchAll(/PR-\d{2}/g)].map((m) => m[0]))];
    const description = [
      `*Objective:* ${field.Objective ?? ''}`,
      `*Preconditions:* ${field.Preconditions ?? ''}`,
      '',
      `*Level:* ${meta.Level} | *Layers:* ${meta.Layers ?? ''}`,
      `*Story / AC:* ${meta.Story ?? ''}`,
      `*Risk:* ${meta.Risk ?? ''} | *Condition:* ${meta.Condition ?? ''}`,
      `*Rule:* ${rule ?? '-'}`,
      `*Dependencies:* ${dependencies ?? '-'}`,
      `*Notes:* ${notes ?? '-'}`,
      '',
      `*Automation:* ${cls || 'not classified'}; implemented: ${impl}`,
      flags ? `*Flags:* ${flags}` : '',
      '',
      'Source: docs/test-strategy/test-scenarios.md',
    ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');

    tests.push({
      'Test ID': id,
      'Issue Type': 'Test',
      'Test Type': 'Manual',
      Summary: `${id} ${title}`,
      Priority: jiraPriority[priority],
      Labels: labels.join(' '),
      Description: toJira(description),
      Action: toJira(field.Flow ?? ''),
      Data: toJira(data ?? ''),
      'Expected Result': toJira(field.Expected ?? ''),
      'Story IDs': stories.join(' '),
      'Risk IDs': risks.join(' '),
      ...(keys && { 'Requirement keys': keysOf(stories), 'Risk keys': keysOf(risks) }),
      _acs: acIds(meta.Story ?? ''),
    });
  }
  return tests;
}

// ---------- bugs ----------

/** Risk rows: priority, severity and the ACs they cover (e.g. "US-022-AC-14/15" -> two ACs). */
function parseRisks() {
  const text = read('docs/test-strategy/risk-register.md');
  const risks = [];
  for (const line of text.split('\n')) {
    if (!/^\| PR-\d+ \|/.test(line)) continue;
    const [id, , summary, , severity, priority, storiesCell] = cells(line);
    if (!storiesCell) continue;
    const acs = [];
    const stories = [];
    for (const m of storiesCell.matchAll(/(US-\d{3})(?:-AC-([\d/]+))?/g)) {
      if (m[2]) for (const n of m[2].split('/')) acs.push(`${m[1]}-AC-${n.padStart(2, '0')}`);
      else stories.push(m[1]);
    }
    risks.push({ id, summary, severity, priority: priority.replace(/\*|\(.*\)/g, '').trim(), acs, stories });
  }
  return risks;
}

function riskFor(ac, risks) {
  return risks.find((r) => r.acs.includes(ac)) ?? risks.find((r) => r.stories.includes(ac.slice(0, 6)));
}

/** Findings recorded outside the §2 table (browser/authentication.md). Texts copied from the findings. */
const extraFindings = [
  {
    ac: 'US-003-AC-05',
    finding: 'A-7',
    expected: 'A failed token refresh logs the user out and lands on `/` with the Login button',
    observed: 'After a failed refresh on `/favorites` the app logs out but lands on `/auth` (same redirect mechanism as US-004-AC-01)',
    evidence: 'Runtime (controlled 401 + invalid refresh cookie) + source; browser/authentication.md A-7. Needs confirmation as a defect',
    extraLabels: ['needs-confirmation'],
  },
  {
    ac: 'US-004-AC-02',
    finding: 'A-11',
    expected: 'Logout removes the `RefreshToken` cookie, so the browser is signed out',
    observed: 'On the deployed environment the logout deletion cookie is sent without `Secure` and with `SameSite=Lax`, the browser ignores it, and the session is restored on the next load. Locally it works',
    evidence: 'Runtime (deployed UI https://psmusic.netlify.app / API https://psmusic-5zfx.onrender.com) + source (`AuthController.RemoveRefreshTokenCookie` uses `Request.IsHttps`); browser/authentication.md A-11',
    extraLabels: ['environment-specific', 'deployed-only'],
  },
];

function parseBugs(tests) {
  const text = read('docs/exploration/exploration-validation.md');
  const section = text.split(/^## 2\. /m)[1].split(/^## /m)[0];
  const risks = parseRisks();
  const rows = section
    .split('\n')
    .filter((line) => /^\| US-\d{3}-AC-\d+ \|/.test(line))
    .map((line) => {
      const [ac, expected, observed, evidence] = cells(line);
      return { ac, finding: '', expected, observed, evidence, extraLabels: [] };
    });

  return [...rows, ...extraFindings].map((bug) => {
    const risk = riskFor(bug.ac, risks);
    const sourceOnly = /source only/i.test(bug.evidence);
    const labels = ['psmusic', 'found-by-exploration', `story-${label(bug.ac.slice(0, 6))}`, ...bug.extraLabels];
    if (risk) labels.push(`severity-${label(risk.severity)}`, label(risk.id));
    else labels.push('needs-triage');
    if (sourceOnly) labels.push('source-only');
    if (bug.ac.startsWith('US-022')) labels.push('third-party');

    const detectedBy = tests.filter((t) => t._acs.includes(bug.ac)).map((t) => t['Test ID']);
    const description = [
      `*Story / AC:* ${bug.ac}${bug.finding ? ` (finding ${bug.finding})` : ''}`,
      `*Expected:* ${bug.expected}`,
      `*Actual:* ${bug.observed}`,
      `*Evidence:* ${bug.evidence}`,
      `*Risk:* ${risk ? `${risk.id} ${risk.summary} (severity ${risk.severity}, priority ${risk.priority})` : 'not in the risk register: triage needed'}`,
      `*Detected by:* ${detectedBy.join(', ') || 'no scenario yet'}`,
      '',
      'Environment: local dev build (UI https://localhost:5174, API https://localhost:7215) unless stated otherwise.',
      'Steps to reproduce: see the detecting scenario(s) above and the evidence reference.',
      'Source: docs/exploration/exploration-validation.md §2',
    ].join('\n');

    const summary = `${bug.ac}: ${bug.observed}`.replace(/`/g, '');
    return {
      'Bug ID': bug.finding || bug.ac,
      'Issue Type': 'Bug',
      Summary: summary.length > 250 ? `${summary.slice(0, 247)}...` : summary,
      Priority: risk ? jiraPriority[risk.priority] : '',
      Labels: labels.join(' '),
      Description: toJira(description),
      'Story IDs': bug.ac.slice(0, 6),
      'Detected by tests': detectedBy.join(' '),
      'Risk ID': risk?.id ?? '',
      ...(keys && { 'Linked test keys': keysOf(detectedBy), 'Risk keys': keysOf(risk ? [risk.id] : []) }),
    };
  });
}

// ---------- risks ----------

/** Product risks (PR, §2.1 + §3 detail) and test/project risks (TR, §2.2 + §4 detail). */
function parseRiskIssues(tests, bugs) {
  const text = read('docs/test-strategy/risk-register.md');
  const lines = text.split('\n');
  const rows = (prefix, from, to) => {
    const section = text.split(from)[1].split(to)[0];
    return section.split('\n').filter((line) => line.startsWith(`| ${prefix}-`)).map(cells);
  };
  const product = rows('PR', /^### 2\.1 /m, /^### 2\.2 /m);
  const project = Object.fromEntries(rows('TR', /^### 2\.2 /m, /^## 3\. /m).map((r) => [r[0], r]));
  const projectDetail = rows('TR', /^## 4\. /m, /^## 5\. /m);

  const issue = ({ id, kind, area, title, likelihood, severity, priority, description, stories, epics }) => {
    const p = priority.replace(/\*|\(.*\)/g, '').trim();
    return {
      'Risk ID': id,
      'Issue Type': 'Risk',
      Summary: `${id} ${title}`,
      Priority: jiraPriority[p] ?? '',
      Labels: ['psmusic', kind, `area-${label(area)}`, `likelihood-${label(likelihood)}`, `severity-${label(severity)}`, label(p)].join(' '),
      Description: toJira(description),
      'Story IDs': stories.join(' '),
      'Epic IDs': epics.join(' '),
      ...(keys && { 'Linked story keys': keysOf(stories), 'Linked epic keys': keysOf(epics) }),
    };
  };

  const productIssues = product.map(([id, area, short, likelihood, severity, priority, storiesCell, fa]) => {
    const heading = lines.findIndex((line) => line.startsWith(`### ${id} `));
    const title = heading >= 0 ? lines[heading].slice(`### ${id} `.length).trim() : short;
    const detail = heading >= 0 ? lines.slice(heading + 1).join('\n').split(/^#{2,3} /m)[0] : '';
    const fields = fieldTable(detail);
    const coveredBy = tests.filter((t) => t['Risk IDs'].split(' ').includes(id)).map((t) => t['Test ID']);
    const relatedBugs = bugs.filter((b) => b['Risk ID'] === id).map((b) => b['Bug ID']);
    // The detail table repeats area, L, S and P with their reasons; only add what it lacks.
    const summaryLine = [
      !fields.Area && `*Area:* ${area}`,
      !fields.Likelihood && !fields['L / S / P'] && `*Likelihood:* ${likelihood} | *Severity:* ${severity} | *Priority:* ${priority.replace(/\*/g, '')}`,
    ].filter(Boolean);
    const description = [
      `*Risk (short):* ${short}`,
      ...summaryLine,
      '',
      ...Object.entries(fields).map(([name, value]) => `*${name}:* ${value}`),
      '',
      `*Stories:* ${storiesCell} | *Functional area:* ${fa}`,
      `*Covered by scenarios:* ${coveredBy.join(', ') || 'none'}`,
      `*Related bugs:* ${relatedBugs.join(', ') || 'none'}`,
      '',
      'Source: docs/test-strategy/risk-register.md §2.1, §3',
    ].join('\n');
    return issue({
      id, kind: 'product-risk', area, title, likelihood, severity, priority, description,
      stories: storyIds(storiesCell),
      epics: [...fa.matchAll(/FA-\d{2}/g)].map((m) => m[0]),
    });
  });

  const projectIssues = projectDetail.map(([id, risk, cause, impact, evidence, likelihood, severity, priority, mitigation, affected]) => {
    const area = project[id]?.[1] ?? 'Test project';
    const description = [
      `*Risk:* ${risk}`,
      `*Area:* ${area} | *Likelihood:* ${likelihood} | *Severity:* ${severity} | *Priority:* ${priority.replace(/\*/g, '')}`,
      '',
      `*Cause:* ${cause}`,
      `*Impact on testing:* ${impact}`,
      `*Evidence:* ${evidence}`,
      `*Mitigation:* ${mitigation}`,
      `*Affected:* ${affected || '-'}`,
      '',
      'Source: docs/test-strategy/risk-register.md §2.2, §4',
    ].join('\n');
    return issue({
      id, kind: 'project-risk', area, title: project[id]?.[2] ?? risk, likelihood, severity, priority, description,
      stories: [], epics: [],
    });
  });

  return [...productIssues, ...projectIssues];
}

// ---------- write ----------

const epics = parseEpics();
const stories = parseStories(epics);
const tests = parseScenarios();
const bugs = parseBugs(tests);
const risks = parseRiskIssues(tests, bugs);

/** Columns of the first row, without the internal `_` fields. Key columns appear only with keys.json. */
const columnsOf = (rows) => Object.keys(rows[0]).filter((column) => !column.startsWith('_'));

fs.mkdirSync(outDir, { recursive: true });
for (const [file, rows] of Object.entries({ epics, stories, risks, tests, bugs })) {
  fs.writeFileSync(path.join(outDir, `${file}.csv`), csv(rows, columnsOf(rows)));
}

const kinds = (label) => risks.filter((r) => r.Labels.includes(label)).length;
console.log(`epics.csv:   ${epics.length} functional areas`);
console.log(`stories.csv: ${stories.length} stories (${stories.filter((s) => !s['Epic ID']).length} without epic)`);
console.log(`risks.csv:   ${risks.length} risks (${kinds('product-risk')} product, ${kinds('project-risk')} project)`);
console.log(`tests.csv:   ${tests.length} tests`);
console.log(`bugs.csv:    ${bugs.length} bugs (${bugs.filter((b) => b.Labels.includes('needs-triage')).length} need triage)`);
