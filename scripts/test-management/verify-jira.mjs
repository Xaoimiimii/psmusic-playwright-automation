// Compares Jira read-back data (exported from Atlassian MCP reads) with issue-map.json and plan.json, and records
// PASS / FAIL per entity and relationship. Read-only towards Jira: the reads happen through MCP, this script only
// compares and writes the map.
//
// Usage: node scripts/test-management/verify-jira.mjs <issues.tsv> [links.tsv]
//   issues.tsv: key, id, issue type name, local ID (summary prefix), parent key or "-"   (searchJiraIssuesUsingJql)
//   links.tsv:  hub key, link type name, linked key   (one row per link seen from the hub issue)
import fs from 'node:fs';
import path from 'node:path';
import { DONE, loadMap, saveMap } from './issue-map.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const projectMap = JSON.parse(fs.readFileSync(path.join(root, 'test-management/config/project-map.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(root, 'test-management/state/plan.json'), 'utf8'));
const [issuesFile, linksFile] = process.argv.slice(2);
const rows = (file) => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map((line) => line.split('\t'));
const now = new Date().toISOString();

const map = loadMap();
const byKey = Object.fromEntries(rows(issuesFile).map(([key, id, type, localId, parent]) => [key, { key, id, type, localId, parent }]));
const parentOf = Object.fromEntries(plan.relationships.filter((r) => r.kind === 'parent').map((r) => [r.from, r.to]));
const result = { entities: { PASS: 0, FAIL: [], UNVERIFIED: [] }, parents: { PASS: 0, FAIL: [] }, links: { PASS: 0, FAIL: [], notChecked: 0 }, duplicates: [], orphans: [] };

// Duplicates and orphans: more than one issue per local ID, or issues not in the map.
const seen = {};
for (const r of Object.values(byKey)) (seen[r.localId] ??= []).push(r.key);
for (const [localId, keys] of Object.entries(seen)) if (keys.length > 1) result.duplicates.push(`${localId}: ${keys.join(', ')}`);
const mappedKeys = new Set(Object.values(map.entities).map((e) => e.jiraKey).filter(Boolean));
for (const r of Object.values(byKey)) if (!mappedKeys.has(r.key)) result.orphans.push(`${r.key} ${r.localId}`);

for (const e of Object.values(map.entities).filter((x) => x.jiraKey)) {
  const r = byKey[e.jiraKey];
  const problems = [];
  if (!r) problems.push('not returned by the project search');
  else {
    if (r.id !== e.jiraId) problems.push(`id ${r.id} != mapped ${e.jiraId}`);
    if (r.localId !== e.localId) problems.push(`summary prefix ${r.localId} != ${e.localId}`);
    if (r.type !== projectMap.issueTypes[e.type].name) problems.push(`type ${r.type} != ${projectMap.issueTypes[e.type].name}`);
    const plannedParent = parentOf[e.localId];
    const expectedParent = plannedParent ? map.entities[plannedParent]?.jiraKey : '-';
    if ((r.parent ?? '-') !== (expectedParent ?? '-')) problems.push(`parent ${r.parent} != ${expectedParent}`);
  }
  // Xray-side data cannot be read on this site (see sync-xray.mjs); a Jira-side PASS is not a full PASS for a Test.
  if (!problems.length && e.type === 'test') {
    e.verificationStatus = 'UNVERIFIED';
    e.lastError = 'Jira fields verified; Xray test type/steps unreadable (Xray cannot access MSC issues)';
    result.entities.UNVERIFIED.push(e.localId);
  } else {
    e.verificationStatus = problems.length ? 'FAIL' : 'PASS';
    if (problems.length) e.lastError = problems.join('; ');
    problems.length ? result.entities.FAIL.push(`${e.localId}: ${problems.join('; ')}`) : result.entities.PASS++;
  }
  e.verifiedAt = now;
}

for (const rel of map.relationships.filter((r) => r.kind === 'parent' && DONE.has(r.creationStatus))) {
  const child = byKey[map.entities[rel.from].jiraKey];
  const ok = child?.parent === map.entities[rel.to].jiraKey;
  Object.assign(rel, { verificationStatus: ok ? 'PASS' : 'FAIL', verifiedAt: now, lastError: ok ? null : `parent is ${child?.parent}` });
  ok ? result.parents.PASS++ : result.parents.FAIL.push(`${rel.from} -> ${rel.to}`);
}

if (linksFile) {
  const links = new Set(rows(linksFile).flatMap(([hub, type, other]) => [`${type}|${hub}|${other}`, `${type}|${other}|${hub}`]));
  for (const rel of map.relationships.filter((r) => r.kind === 'issueLink' && DONE.has(r.creationStatus))) {
    const from = map.entities[rel.from].jiraKey;
    const to = map.entities[rel.to].jiraKey;
    const ok = links.has(`${rel.linkType}|${from}|${to}`);
    Object.assign(rel, { verificationStatus: ok ? 'PASS' : 'FAIL', verifiedAt: now, lastError: ok ? null : `no ${rel.linkType} link between ${from} and ${to} in read-back` });
    ok ? result.links.PASS++ : result.links.FAIL.push(`${rel.relationshipKey} ${rel.from}(${from}) -> ${rel.to}(${to})`);
  }
  // Links present in Jira but not planned (someone else's, or a duplicate create).
  const planned = new Set(map.relationships.filter((r) => r.kind === 'issueLink' && DONE.has(r.creationStatus)).flatMap((r) => {
    const a = map.entities[r.from].jiraKey;
    const b = map.entities[r.to].jiraKey;
    return [`${r.linkType}|${a}|${b}`, `${r.linkType}|${b}|${a}`];
  }));
  result.links.unexpected = [...new Set(rows(linksFile).filter(([hub, type, other]) => !planned.has(`${type}|${hub}|${other}`)).map((r) => r.join(' ')))];
  result.links.rowsRead = rows(linksFile).length;
}

saveMap(map);
console.log(JSON.stringify(result, null, 2));
