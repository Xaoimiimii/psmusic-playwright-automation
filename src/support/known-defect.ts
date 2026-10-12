import { test } from '@playwright/test';
import type { RecordedBugId } from '../data/test-metadata';

/**
 * Marks the running test as expected to fail because of a recorded Bug, named by its local ID
 * (`BUG-…` in test-management/state/plan.json): the stable key that reporting and failure triage
 * use to reuse that Bug instead of proposing a new one (docs/failure-triage.md).
 * Call it immediately before the assertion the defect breaks: a failure in an
 * earlier step happens before the mark and is still reported as a real failure.
 * The assertion keeps the story's expected behavior; Playwright reports an
 * unexpected pass once the defect is fixed, which is the signal to remove the call.
 */
export function knownDefect(bug: RecordedBugId, observed: string): void {
  test.info().annotations.push({ type: 'known-defect', description: `${bug}: ${observed}` });
  test.fail();
}
