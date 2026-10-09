// Reads and updates test-management/state/issue-map.json (schema: issue-map.schema.json) for /sync-jira-xray.
// Jira writes go through Atlassian MCP; this helper only prepares payloads and records outcomes, one at a time, so an
// interrupted run resumes from the file.
//
// Usage: node scripts/test-management/issue-map.mjs <command> [args]
//   init <runId>                               Add plan entities/relationships missing from the map (status planned/skipped)
//   pending <type> [limit]                     Approved entities of <type> not yet created/matched, as MCP payloads
//   set <localId> <status> [key] [id] [error]  Record a creation outcome (saved immediately)
//   verify <localId> <PASS|FAIL|UNVERIFIED> [error]
//   links <relationshipKey> [limit]            Planned issue links whose both ends exist, with resolved keys
//   link-set <relationshipKey> <from> <to> <status> [verification] [error]
//   summary                                    Counts per type / status
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const planFile = path.join(root, 'test-management/state/plan.json');
const mapFile = path.join(root, 'test-management/state/issue-map.json');
const projectMap = JSON.parse(fs.readFileSync(path.join(root, 'test-management/config/project-map.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const now = () => new Date().toISOString();

export const planHash = (e) => crypto.createHash('sha256').update(JSON.stringify({ ...e, approved: undefined })).digest('hex').slice(0, 16);

export function loadMap() {
  if (fs.existsSync(mapFile)) return JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  return { schemaVersion: 1, projectKey: projectMap.jira.projectKey, updatedAt: now(), lastRunId: null, entities: {}, relationships: [] };
}

export function saveMap(map) {
  map.updatedAt = now();
  const text = `${JSON.stringify(map, null, 2)}\n`;
  const tmp = `${mapFile}.tmp`;
  fs.writeFileSync(tmp, text);
  // On Windows an editor holding the file open makes rename fail with EPERM/EBUSY for a moment: retry, then fall
  // back to writing in place (the content is already safe in the .tmp file).
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.renameSync(tmp, mapFile);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200 * attempt);
    }
  }
  fs.writeFileSync(mapFile, text);
  fs.rmSync(tmp, { force: true });
}

export const DONE = new Set(['created', 'matched', 'updated']);

/** Why a planned relationship cannot be created with the verified configuration, or null if it can. */
export function relationshipBlocker(rel) {
  if (rel.kind !== 'issueLink') return null;
  const config = projectMap.relationships[rel.relationshipKey];
  if (!config) return `relationship key ${rel.relationshipKey} not in project-map.json`;
  if (!config.semanticsVerified || !config.linkType) return `semantics not verified in project-map.json (${config.evidence ?? 'no evidence'})`;
  return null;
}

const relId = (r) => `${r.relationshipKey ?? r.kind}|${r.from}|${r.to}`;

const commands = {
  init(runId) {
    const map = loadMap();
    map.lastRunId = runId ?? map.lastRunId;
    for (const e of plan.entities) {
      const existing = map.entities[e.localId];
      if (existing) {
        existing.planHash = planHash(e);
        if (!DONE.has(existing.creationStatus)) existing.summary = e.summary;
        if (e.approved && existing.creationStatus === 'skipped' && existing.lastError === 'not approved in plan.json') {
          Object.assign(existing, { creationStatus: 'planned', lastError: null });
        }
        continue;
      }
      map.entities[e.localId] = {
        localId: e.localId,
        type: e.type,
        summary: e.summary,
        planHash: planHash(e),
        jiraKey: null,
        jiraId: null,
        xray: e.type === 'test' ? { testType: e.xray?.testType ?? null, definitionStatus: 'pending', stepsCount: null, genericDefinition: null, automatedSpec: e.xray?.automatedSpec ?? null } : null,
        creationStatus: e.approved ? 'planned' : 'skipped',
        verificationStatus: 'NOT_RUN',
        createdAt: null,
        verifiedAt: null,
        lastRunId: null,
        lastError: e.approved ? null : 'not approved in plan.json',
        duplicates: [],
      };
    }
    // Re-evaluate links skipped only because their configuration was unverified at the time.
    for (const r of map.relationships) {
      if (r.creationStatus !== 'skipped' || r.kind !== 'issueLink') continue;
      const blocker = relationshipBlocker(r);
      if (!blocker) Object.assign(r, { creationStatus: 'planned', verificationStatus: 'NOT_RUN', linkType: projectMap.relationships[r.relationshipKey].linkType, lastError: null });
      else r.lastError = blocker;
    }
    const known = new Set(map.relationships.map(relId));
    for (const r of plan.relationships) {
      if (known.has(relId(r))) continue;
      const blocker = relationshipBlocker(r);
      const config = r.kind === 'issueLink' ? projectMap.relationships[r.relationshipKey] : null;
      map.relationships.push({
        kind: r.kind,
        from: r.from,
        to: r.to,
        linkType: config?.linkType ?? null,
        relationshipKey: r.relationshipKey,
        creationStatus: blocker ? 'skipped' : 'planned',
        verificationStatus: blocker ? 'UNVERIFIED' : 'NOT_RUN',
        verifiedAt: null,
        lastError: blocker,
      });
    }
    saveMap(map);
    return commands.summary();
  },

  pending(type, limit = '1000') {
    const map = loadMap();
    const parentOf = Object.fromEntries(plan.relationships.filter((r) => r.kind === 'parent').map((r) => [r.from, r.to]));
    return plan.entities
      .filter((e) => e.type === type && e.approved && !DONE.has(map.entities[e.localId]?.creationStatus))
      .slice(0, Number(limit))
      .map((e) => {
        const parent = parentOf[e.localId];
        return {
          localId: e.localId,
          status: map.entities[e.localId]?.creationStatus,
          issueType: projectMap.issueTypes[type].name,
          summary: e.summary,
          labels: e.labels,
          priority: e.priority,
          parent: parent ? map.entities[parent]?.jiraKey ?? `UNRESOLVED:${parent}` : null,
          description: e.description,
        };
      });
  },

  set(localId, status, key, id, ...error) {
    const map = loadMap();
    const entity = map.entities[localId];
    if (!entity) throw new Error(`unknown local ID ${localId}`);
    entity.creationStatus = status;
    if (key && key !== '-') entity.jiraKey = key;
    if (id && id !== '-') entity.jiraId = id;
    if (status === 'created' || status === 'matched') entity.createdAt ??= now();
    entity.lastRunId = map.lastRunId;
    entity.lastError = error.length ? error.join(' ') : null;
    saveMap(map);
    return { localId, status, key: entity.jiraKey, id: entity.jiraId };
  },

  verify(localId, result, ...error) {
    const map = loadMap();
    const entity = map.entities[localId];
    entity.verificationStatus = result;
    entity.verifiedAt = now();
    if (error.length) entity.lastError = error.join(' ');
    saveMap(map);
    return { localId, result };
  },

  links(relationshipKey, limit = '1000') {
    const map = loadMap();
    return map.relationships
      .filter((r) => r.relationshipKey === relationshipKey && !DONE.has(r.creationStatus) && r.creationStatus !== 'skipped')
      .map((r) => ({ from: r.from, to: r.to, status: r.creationStatus, fromKey: map.entities[r.from]?.jiraKey, toKey: map.entities[r.to]?.jiraKey, linkType: r.linkType }))
      .filter((r) => r.fromKey && r.toKey)
      .slice(0, Number(limit));
  },

  'link-set'(relationshipKey, from, to, status, verification, ...error) {
    const map = loadMap();
    const rel = map.relationships.find((r) => r.relationshipKey === relationshipKey && r.from === from && r.to === to);
    if (!rel) throw new Error(`unknown relationship ${relationshipKey} ${from} -> ${to}`);
    rel.creationStatus = status;
    if (verification && verification !== '-') {
      rel.verificationStatus = verification;
      rel.verifiedAt = now();
    }
    rel.lastError = error.length ? error.join(' ') : null;
    saveMap(map);
    return { relationshipKey, from, to, status, verification: rel.verificationStatus };
  },

  summary() {
    const map = loadMap();
    const out = { entities: {}, relationships: {} };
    for (const e of Object.values(map.entities)) {
      const t = (out.entities[e.type] ??= {});
      t[`${e.creationStatus}/${e.verificationStatus}`] = (t[`${e.creationStatus}/${e.verificationStatus}`] ?? 0) + 1;
    }
    for (const r of map.relationships) {
      const t = (out.relationships[r.relationshipKey ?? r.kind] ??= {});
      t[`${r.creationStatus}/${r.verificationStatus}`] = (t[`${r.creationStatus}/${r.verificationStatus}`] ?? 0) + 1;
    }
    return out;
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (!commands[command]) {
    console.error(`Unknown command: ${command ?? '(none)'}. Commands: ${Object.keys(commands).join(', ')}`);
    process.exit(2);
  }
  console.log(JSON.stringify(commands[command](...args), null, 2));
}
