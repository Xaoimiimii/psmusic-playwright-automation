import type { TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { env } from '../config/env';
import { recordedBugs, scenarioMetadata, type RecordedBugId, type ScenarioMetadata, type TraceRef } from '../data/test-metadata';
import { scenarioFor, xrayTestKeyFor } from '../support/xray';
import { failureSignals, observedLayers } from './test-observations';

/**
 * Allure severity from the scenario's risk-based priority (docs/test-strategy/test-scenarios.md,
 * derived from risk-register.md). `blocker` and `trivial` are not used: the strategy has three levels.
 */
const SEVERITY_BY_PRIORITY: Record<NonNullable<ScenarioMetadata['priority']>, allure.Severity> = {
  High: allure.Severity.CRITICAL,
  Medium: allure.Severity.NORMAL,
  Low: allure.Severity.MINOR,
};

const MAX_STORY_LABEL_LENGTH = 90;

/**
 * Gives the result its business metadata from the scenario its title names
 * (`TS-AREA-nn`), read from the generated plan extract in `src/data/test-metadata.ts`:
 *
 * - Epic = functional area, Feature = user story, Story = acceptance criterion, so
 *   Allure's Behaviors tree mirrors the Jira hierarchy;
 * - severity from the scenario priority;
 * - description with objective, preconditions, expected rule, criteria and risks;
 * - Jira links (Xray Test, stories, risks) when `ATLASSIAN_SITE_URL` is set.
 *
 * Tests whose title names no known scenario keep only their tags.
 */
export async function applyScenarioMetadata(testInfo: TestInfo): Promise<void> {
  const scenario = scenarioFor(testInfo.titlePath);
  const metadata = scenario && scenarioMetadata[scenario.id];
  if (!scenario || !metadata) return;

  await allure.label('scenario', scenario.id);
  for (const epic of metadata.epics) await allure.epic(`${epic.id} ${epic.name}`);
  // TECH has no functional area and is its own Epic; repeating it as the Feature adds nothing.
  const epicIds = new Set(metadata.epics.map((epic) => epic.id));
  for (const story of metadata.stories.filter((s) => !epicIds.has(s.id))) await allure.feature(`${story.id} ${story.name}`);
  for (const criterion of metadata.acceptanceCriteria) {
    await allure.story(shorten(criterion.text ? `${criterion.id} ${criterion.text}` : criterion.id, MAX_STORY_LABEL_LENGTH));
  }
  if (metadata.priority) await allure.severity(SEVERITY_BY_PRIORITY[metadata.priority]);
  await allure.descriptionHtml(descriptionHtml(scenario.id, metadata));

  // A scenario split into one test per case (e.g. one per endpoint) names the scenario in its describe block;
  // the display name then carries both, so the result reads on its own outside the suite tree.
  if (scenario.title !== testInfo.title) await allure.displayName(`${scenario.title} › ${testInfo.title}`);

  if (env.jiraSiteUrl) {
    const testKey = xrayTestKeyFor(testInfo.titlePath);
    if (testKey) await allure.tms(jiraUrl(testKey), `${testKey} Xray Test ${scenario.id}`);
    for (const ref of [...metadata.stories, ...metadata.risks]) {
      if (ref.jiraKey) await allure.link(jiraUrl(ref.jiraKey), `${ref.jiraKey} ${ref.id} ${ref.name}`, ref.id.startsWith('PR-') ? 'risk' : 'requirement');
    }
  }
}

/**
 * Labels that are only known once the test has run: the layers it exercised,
 * the recorded defect it reproduces (`knownDefect()`), and, when it failed, the
 * failure signals observed during the run (test-observations.ts).
 */
export async function applyOutcomeMetadata(testInfo: TestInfo): Promise<void> {
  const layers = [...observedLayers()].sort((a, b) => (a === 'UI' ? -1 : b === 'UI' ? 1 : 0));
  if (layers.length > 0) await allure.layer(layers.join(' + '));

  for (const annotation of testInfo.annotations.filter((a) => a.type === 'known-defect')) {
    // knownDefect() writes "<Bug local ID>: <observed>".
    const reference = annotation.description?.split(':')[0].trim() ?? '';
    await allure.label('known_defect', reference);
    await allure.tag('known-defect');
    const bug: TraceRef | undefined = recordedBugs[reference as RecordedBugId];
    if (bug?.jiraKey && env.jiraSiteUrl) await allure.issue(jiraUrl(bug.jiraKey), `${bug.jiraKey} ${bug.name}`);
  }

  if (testInfo.status !== testInfo.expectedStatus) {
    for (const signal of failureSignals().keys()) await allure.label('failure_signal', signal);
  }
}

function descriptionHtml(id: string, metadata: ScenarioMetadata): string {
  const rows: [string, string | undefined][] = [
    ['Objective', metadata.objective],
    ['Preconditions', metadata.preconditions],
    ['Expected rule', metadata.rule],
    ['Acceptance criteria', metadata.acceptanceCriteria.map((c) => (c.text ? `${c.id}: ${c.text}` : c.id)).join('\n') || undefined],
    ['Risks covered', metadata.risks.map((r) => `${r.id} ${r.name}${r.priority ? ` (priority ${r.priority})` : ''}`).join('\n') || undefined],
    ['Priority', metadata.priority ?? undefined],
    ['Source', metadata.source],
  ];
  const body = rows
    .filter(([, value]) => value)
    .map(([name, value]) => `<p><b>${name}:</b><br>${inlineHtml(value!).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<p><b>${id} ${inlineHtml(metadata.title)}</b></p>\n${body}`;
}

/** Escapes text from the plan and turns its `code` spans into <code>. */
function inlineHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function jiraUrl(key: string): string {
  return `${env.jiraSiteUrl}/browse/${key}`;
}
