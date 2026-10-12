// Recorded Bugs and how each Test relates to them, from the persistent plan and issue map (never from titles).
// Used by triage to reuse an existing Bug instead of proposing a duplicate (docs/failure-triage.md §4).

const AC_ID = /\bUS-\d{3}-AC-\d+\b/g;

/** "**Story / AC:** US-003-AC-05 (finding A-7)" -> ["US-003-AC-05"]. Plan descriptions carry this field for Tests and Bugs. */
function criteriaOf(description = '') {
  const line = description.split('\n').find((l) => /\*\*Story \/ AC:\*\*/.test(l)) ?? '';
  return [...new Set(line.match(AC_ID) ?? [])];
}

/**
 * Index of Bugs and Tests. `issueMap` supplies Jira keys; Bugs without one are kept (planned, not in Jira yet)
 * so a match is still reported, with jiraKey null.
 */
export function buildBugIndex(plan, issueMap, triageMap) {
  const entities = Array.isArray(plan.entities) ? plan.entities : Object.values(plan.entities ?? {});
  const mapped = issueMap?.entities ?? {};
  const relationships = plan.relationships ?? [];
  const related = (from, key) => relationships.filter((r) => r.from === from && r.relationshipKey === key).map((r) => r.to);

  const bugs = new Map();
  for (const bug of entities.filter((e) => e.type === 'bug')) {
    bugs.set(bug.localId, {
      id: bug.localId,
      jiraKey: mapped[bug.localId]?.jiraKey ?? null,
      summary: bug.summary,
      criteria: criteriaOf(bug.description),
      stories: related(bug.localId, 'bugAffectsStory'),
      detectedBy: relationships.filter((r) => r.to === bug.localId && r.relationshipKey === 'bugFoundByTest').map((r) => r.from),
      // Where the Bug came from (labels set by the plan, e.g. found-by-exploration): shown so triage never
      // presents an exploratory finding as something a CI run discovered.
      provenance: (bug.labels ?? []).filter((l) => /^found-by-|^needs-confirmation$/.test(l)),
    });
  }

  const tests = new Map();
  for (const test of entities.filter((e) => e.type === 'test')) {
    tests.set(test.localId, {
      id: test.localId,
      jiraKey: mapped[test.localId]?.jiraKey ?? null,
      criteria: criteriaOf(test.description),
      stories: related(test.localId, 'testCoversRequirement'),
    });
  }
  // Reviewed phase-2 decisions (test-management/state/triage-map.json): fingerprint -> Bug linked or created then.
  // A Bug created by triage is not in plan.json until someone adds it to the design documents; it is known here.
  const triaged = new Map();
  for (const [fingerprint, entry] of Object.entries(triageMap?.fingerprints ?? {})) {
    const known = [...bugs.values()].find((b) => b.jiraKey === entry.bug);
    triaged.set(fingerprint, known ?? { id: entry.bugId ?? entry.bug, jiraKey: entry.bug, summary: '(created by triage; not in plan.json)', criteria: [], stories: [], detectedBy: [], provenance: entry.createdByTriage ? ['found-by-automation'] : [] });
  }
  return { bugs, tests, triaged };
}

/** Strength of each relation, strongest first. Only `known-defect` is an exact match. */
export const RELATIONS = ['known-defect', 'previous-triage', 'detected-by-test', 'same-criterion', 'same-story'];

/**
 * Existing Bugs related to a failed test, strongest relation first.
 * - known-defect: the test called knownDefect(<Bug ID>) - the Bug this failure is recorded as. Exact.
 * - detected-by-test: the plan records this Test as the one that detects the Bug (bugFoundByTest).
 * - same-criterion: the Bug and the Test name the same acceptance criterion.
 * - same-story: the Bug affects a story the Test covers. Weakest; listed for the reviewer only.
 * Returns { match: 'exact' | 'candidates' | 'none', bugs: [...], missing: [...] }.
 */
export function matchBugs(outcome, index) {
  const missing = [];
  const found = new Map();
  const add = (bug, relation) => {
    if (bug && !found.has(bug.id)) found.set(bug.id, { ...bug, relation });
  };

  if (outcome.knownDefect) {
    const bug = index.bugs.get(outcome.knownDefect);
    if (bug) add(bug, 'known-defect');
    else missing.push(`knownDefect(${outcome.knownDefect}) names no Bug in plan.json`);
  }

  // The same failure (fingerprint) was tied to a Bug by an earlier reviewed triage: a strong candidate, not exact,
  // because the reviewer decided for that run.
  if (outcome.fingerprint && index.triaged?.has(outcome.fingerprint)) add(index.triaged.get(outcome.fingerprint), 'previous-triage');

  const test = outcome.scenarioId ? index.tests.get(outcome.scenarioId) : undefined;
  if (!outcome.scenarioId) missing.push('test title names no scenario (TS-…): related Bugs cannot be looked up');
  else if (!test) missing.push(`scenario ${outcome.scenarioId} is not in plan.json`);

  if (test) {
    for (const bug of index.bugs.values()) if (bug.detectedBy.includes(test.id)) add(bug, 'detected-by-test');
    for (const bug of index.bugs.values()) if (bug.criteria.some((c) => test.criteria.includes(c))) add(bug, 'same-criterion');
    for (const bug of index.bugs.values()) if (bug.stories.some((s) => test.stories.includes(s))) add(bug, 'same-story');
  }

  const bugs = [...found.values()].sort((a, b) => RELATIONS.indexOf(a.relation) - RELATIONS.indexOf(b.relation) || a.id.localeCompare(b.id));
  const match = bugs[0]?.relation === 'known-defect' ? 'exact' : bugs.length ? 'candidates' : 'none';
  return { match, bugs, missing };
}
