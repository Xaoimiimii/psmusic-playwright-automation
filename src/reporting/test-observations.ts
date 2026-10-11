/**
 * What the running test was observed doing, recorded by the API and browser
 * evidence collectors and read by the reporting fixture when the test ends.
 *
 * A worker runs one test at a time and parallel workers are separate processes,
 * so module-level state never mixes tests. The reporting fixture resets it per test.
 */

/**
 * Facts that point at a failure cause outside the test script. Turned into
 * `failure_signal` labels only when the test fails, so Allure categories can
 * group failures by what was observed instead of by error text alone (allurerc.mjs).
 */
export type FailureSignal = 'backend-5xx' | 'network-error' | 'page-error';

/** Layers the test actually exercised: a browser page, and/or direct API calls. */
export type TestLayer = 'UI' | 'API';

const signals = new Map<FailureSignal, string[]>();
const layers = new Set<TestLayer>();

export function resetTestObservations(): void {
  signals.clear();
  layers.clear();
}

/** Records one observation, e.g. `recordFailureSignal('backend-5xx', 'GET /api/song/1/detail -> 500')`. */
export function recordFailureSignal(signal: FailureSignal, detail: string): void {
  const details = signals.get(signal) ?? [];
  details.push(detail);
  signals.set(signal, details);
}

export function failureSignals(): ReadonlyMap<FailureSignal, readonly string[]> {
  return signals;
}

export function recordLayer(layer: TestLayer): void {
  layers.add(layer);
}

export function observedLayers(): ReadonlySet<TestLayer> {
  return layers;
}
