// Phase 2 of failure triage (docs/failure-triage.md §7): turns a report-only triage.json into proposed Jira/Xray
// changes. Pure functions; nothing here reads or writes Jira. The command (triage-jira.mjs) checks each proposal
// against live data and writes only what a person approved.
//
// Proposal types (the only two writes phase 2 knows):
//   link-defect  add a recorded Bug as a defect of the failed Xray test run
//   create-bug   create a reviewed Bug (labelled needs-confirmation), relate it to the story, add it to the test run
// Statuses: ready | needs-decision | skipped | blocked | already-done. Only `ready` can be approved.

/** Categories for which a Bug is never proposed without an explicit reviewer decision. */
const NO_BUG_CATEGORIES = new Set(['INFRASTRUCTURE_FAILURE', 'TEST_DEFECT', 'FLAKY_OR_INCONCLUSIVE']);

/**
 * "<fingerprint>=<target>:<reason>" -> { fingerprint, target, reason }. target is a Bug local ID (BUG-…), a Jira
 * key (MSC-…), "new" or "skip". A reason is required: it goes into the audit log.
 */
export function parseDecision(text) {
  const match = String(text).match(/^([0-9a-f]{16})=(BUG-[A-Z0-9-]+|[A-Z][A-Z0-9]+-\d+|new|skip):(.{3,})$/);
  if (!match) throw new Error(`Invalid decision "${text}": expected <fingerprint>=<BUG-…|KEY-n|new|skip>:<reason>`);
  return { fingerprint: match[1], target: match[2], reason: match[3].trim() };
}

/** Jira key of a decision target, from the failure's own Bug candidates when it is a local ID. */
function resolveTarget(target, failure) {
  if (/^BUG-/.test(target)) {
    const bug = failure.bugMatch.bugs.find((b) => b.id === target);
    return bug ? { bugKey: bug.jiraKey, bugId: bug.id, relation: bug.relation } : { bugKey: null, bugId: target, relation: 'not-a-candidate' };
  }
  const bug = failure.bugMatch.bugs.find((b) => b.jiraKey === target);
  return { bugKey: target, bugId: bug?.id ?? null, relation: bug?.relation ?? 'not-a-candidate' };
}

/**
 * One proposal per failure (notices are never acted on). `decisions` come from the reviewer; `triageMap` is the
 * persistent record of earlier triage writes (test-management/state/triage-map.json).
 *
 * @param {any} triage triage.json
 * @param {{ decisions?: { fingerprint: string, target: string, reason: string }[], triageMap?: { fingerprints?: Record<string, any> }, testExecution?: string }} [options]
 * @returns {any[]}
 */
export function buildProposals(triage, { decisions = [], triageMap = { fingerprints: {} }, testExecution } = {}) {
  const execution = testExecution ?? triage.run?.testExecution?.key ?? null;
  const byFingerprint = new Map(decisions.map((d) => [d.fingerprint, d]));
  const unknown = decisions.filter((d) => !triage.failures.some((f) => f.fingerprint === d.fingerprint));
  if (unknown.length) throw new Error(`Decision for unknown fingerprint(s): ${unknown.map((d) => d.fingerprint).join(', ')}`);

  return triage.failures.map((failure, i) => {
    const base = {
      id: `P${i + 1}`,
      fingerprint: failure.fingerprint,
      test: { key: failure.xrayTestKey, scenarioId: failure.scenarioId, title: failure.titlePath.join(' › '), location: failure.location },
      testExecution: execution,
      classification: { category: failure.classification.category, confidence: failure.classification.confidence },
      triageRecommendation: failure.recommendation.action,
    };
    const decision = byFingerprint.get(failure.fingerprint);
    const previous = triageMap.fingerprints?.[failure.fingerprint];
    const exact = failure.bugMatch.bugs.find((b) => b.relation === 'known-defect');

    if (!failure.xrayTestKey) return { ...base, type: null, status: 'blocked', reasons: ['the test has no Xray Test key'] };
    if (!execution) return { ...base, type: null, status: 'blocked', reasons: ['no Test Execution: pass --test-execution, or use triage.json from a run that imported to Xray'] };
    if (previous?.runs?.some((r) => r.testExecution === execution && r.testKey === failure.xrayTestKey)) {
      return { ...base, type: null, status: 'already-done', bugKey: previous.bug, reasons: [`already linked to ${previous.bug} for ${execution} (triage-map.json)`] };
    }

    if (decision?.target === 'skip') return { ...base, type: null, status: 'skipped', decision, reasons: [`reviewer: ${decision.reason}`] };
    if (decision?.target === 'new') {
      return {
        ...base,
        type: 'create-bug',
        status: 'ready',
        decision,
        reasons: [
          `reviewer decided a new Bug: ${decision.reason}`,
          ...(failure.classification.category !== 'PRODUCT_DEFECT' ? [`overrides triage category ${failure.classification.category} (recorded in the audit log)`] : []),
        ],
      };
    }
    if (decision) {
      const target = resolveTarget(decision.target, failure);
      if (!target.bugKey) return { ...base, type: 'link-defect', status: 'blocked', decision, reasons: [`${decision.target} has no Jira key`] };
      return { ...base, type: 'link-defect', status: 'ready', decision, ...target, reasons: [`reviewer chose ${target.bugKey} (${target.relation}): ${decision.reason}`] };
    }

    // No reviewer decision: only facts already recorded may lead to a write.
    if (exact && failure.classification.confidence === 'confirmed') {
      if (!exact.jiraKey) return { ...base, type: 'link-defect', status: 'blocked', reasons: [`${exact.id} is not in Jira yet`] };
      return { ...base, type: 'link-defect', status: 'ready', bugKey: exact.jiraKey, bugId: exact.id, relation: 'known-defect', reasons: [`known defect ${exact.id} reproduced`] };
    }
    if (previous?.bug && failure.classification.category === 'PRODUCT_DEFECT') {
      return { ...base, type: 'link-defect', status: 'ready', bugKey: previous.bug, bugId: previous.bugId ?? null, relation: 'previous-triage', reasons: [`same fingerprint was linked to ${previous.bug} by an earlier reviewed triage`] };
    }
    if (failure.classification.notice) return { ...base, type: null, status: 'skipped', reasons: ['notice only (known defect did not reproduce): verify the fix by hand'] };
    if (NO_BUG_CATEGORIES.has(failure.classification.category)) {
      return { ...base, type: null, status: 'skipped', reasons: [`${failure.classification.category}: no Bug unless a reviewer decides otherwise`] };
    }
    return {
      ...base,
      type: null,
      status: 'needs-decision',
      candidates: failure.bugMatch.bugs.map((b) => ({ id: b.id, jiraKey: b.jiraKey, relation: b.relation })),
      reasons: [`${failure.classification.category} (${failure.classification.confidence}): review, then decide with --decide ${failure.fingerprint}=<BUG-…|KEY|new|skip>:<reason>`],
    };
  });
}

const wiki = (text) => String(text ?? '').replace(/[{}|[\]]/g, (c) => `\\${c}`);

/**
 * Jira fields of a reviewed Bug, from the triage record only (no new facts). Wiki markup for REST v2.
 * `stories` are the Jira keys of the stories the Test covers; `projectMap` gives project and issue type.
 *
 * @param {any} failure one triage.json failure
 * @param {any} triage triage.json
 * @param {any} proposal the create-bug proposal
 * @param {{ projectMap: any, stories?: string[] }} options
 */
export function bugDraft(failure, triage, proposal, { projectMap, stories = [] }) {
  const attempt = failure.attempts.find((a) => a.error) ?? failure.attempts[0];
  const excerpt = (attempt?.error?.message ?? '').split('\n').filter((l) => l.trim()).slice(0, 8).join('\n');
  const step = attempt?.failedStep ? `: ${attempt.failedStep}` : '';
  const run = triage.run ?? {};
  const description = [
    'h3. Observed by automated test',
    `||Field||Value||`,
    `|Test|${wiki(failure.titlePath.join(' › '))} ({{${failure.location}}})|`,
    `|Xray Test|${failure.xrayTestKey}|`,
    `|Failing step|${wiki(attempt?.failedStep ?? 'not recorded')}|`,
    `|Attempts|${failure.attempts.map((a) => a.status).join(', ')}|`,
    `|Environment|${wiki(run.environment ?? 'unknown')}|`,
    `|Commit|${run.commit ? run.commit.slice(0, 7) : 'unknown'}|`,
    `|Test Execution|${proposal.testExecution}|`,
    `|CI run|${run.runUrl ? `[open|${run.runUrl}]` : 'local run'}|`,
    '',
    'h3. Assertion (masked excerpt)',
    `{noformat}\n${excerpt}\n{noformat}`,
    '',
    'h3. Triage',
    `* Automated classification: ${failure.classification.category} (${failure.classification.confidence}); ${wiki(failure.classification.reasons.join('; '))}`,
    `* Reviewer decision: ${wiki(proposal.decision?.reason ?? '')}`,
    `* Fingerprint: ${failure.fingerprint}. Screenshots and full logs stay in the CI artifacts (access-controlled, kept ${run.runUrl ? '14 days' : 'locally'}).`,
    '* Created by scripts/triage/triage-jira.mjs after review. Needs confirmation by the product team.',
  ].join('\n');
  return {
    fields: {
      project: { key: projectMap.jira.projectKey },
      issuetype: { id: projectMap.issueTypes.bug.id },
      summary: `[Automation] ${failure.scenarioId ?? failure.xrayTestKey} ${failure.titlePath.at(-1)}${step}`.slice(0, 250),
      description,
      labels: ['psmusic', 'found-by-automation', 'needs-confirmation', `triage-${failure.fingerprint}`],
    },
    stories,
  };
}
