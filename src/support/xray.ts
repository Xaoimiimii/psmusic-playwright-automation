import { xrayTestKeys } from '../data/xray-test-keys';

/** Scenario IDs as written at the start of test and describe titles, e.g. "TS-AUTH-01 valid login ...". */
const SCENARIO_ID = /\bTS-[A-Z0-9]+-\d+\b/;

/**
 * Xray Test key for a Playwright test: the first scenario ID in its title path (test title first, then the
 * enclosing describe titles), looked up in the generated `xrayTestKeys` map. Undefined when the title names no
 * scenario or the scenario has no Test in Xray yet.
 */
export function xrayTestKeyFor(titlePath: readonly string[]): string | undefined {
  for (const title of [...titlePath].reverse()) {
    const id = title.match(SCENARIO_ID)?.[0];
    if (id) return xrayTestKeys[id];
  }
  return undefined;
}
