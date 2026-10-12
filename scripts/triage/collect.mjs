// Turns one run's reports into triage outcomes: one record per test that needs a look, with every attempt and the
// evidence the framework recorded. Pure functions over parsed JSON, so unit tests feed them fixtures
// (docs/failure-triage.md). Never edits a report: the raw outcome is copied, not changed.
//
// Sources: Playwright's JSON report (status per attempt, errors, steps, annotations, the Failure context
// attachment) and Allure results (the failure_signal labels the API wrapper and the browser collector set).

const SCENARIO_ID = /\bTS-[A-Z0-9]+-\d+\b/;
const MAX_TEXT = 1_500;

/**
 * Masks what can leak through an error message or a stack: JWTs, bearer values, cookie and password pairs, and
 * the configured secrets. Error text is the most likely place for a token to slip into a report.
 */
export function redact(text, secrets = []) {
  let out = String(text ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<redacted>')
    .replace(/(Bearer|Basic)\s+[\w.~+/=-]+/gi, '$1 <redacted>')
    .replace(/\b(password|passwd|token|secret|cookie|refreshtoken|x-app-service-key)(["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, '$1$2<redacted>');
  for (const secret of secrets.filter((s) => s && s.length >= 6)) out = out.split(secret).join('<redacted>');
  return out;
}

const truncate = (text, max = MAX_TEXT) => (text.length <= max ? text : `${text.slice(0, max)}\n… (${text.length - max} more characters)`);

/** Path relative to the repository, with forward slashes, whatever machine wrote the report. */
function repoPath(file, rootDir) {
  if (!file) return undefined;
  const normalized = file.replace(/\\/g, '/');
  const root = rootDir?.replace(/\\/g, '/').replace(/\/+$/, '');
  return root && normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

/** Where a stack frame points: our test code, our support code, Playwright, or elsewhere. */
export function frameOrigin(frame) {
  const path = frame.replace(/\\/g, '/');
  if (/node_modules\//.test(path)) return 'library';
  if (/(^|\/)tests\//.test(path)) return 'test-code';
  if (/(^|\/)(src|scripts)\//.test(path)) return 'framework-code';
  return 'other';
}

/** The deepest step that carries the error: the action the test was doing when it failed. */
function failedStep(steps = [], path = []) {
  for (const step of steps) {
    const inner = failedStep(step.steps, [...path, step.title]);
    if (inner) return inner;
    if (step.error) return [...path, step.title].join(' › ');
  }
  return undefined;
}

/**
 * What kind of failure the error text and the matcher describe. These are facts about the error, used together
 * with other evidence; none of them decides a category on its own (classify.mjs).
 */
export function errorShape(message) {
  const text = message ?? '';
  if (!text) return 'none';
  if (/^\s*Test setup:/m.test(text) || /\bTest setup:/.test(text.split('\n')[0])) return 'setup-failed';
  if (/strict mode violation/.test(text)) return 'locator-ambiguous';
  if (/\b(TypeError|ReferenceError|SyntaxError|RangeError)\b|is not a function|Cannot read propert/.test(text.split('\n').slice(0, 3).join('\n'))) return 'script-exception';
  // Nothing to compare: the element never appeared, or the test ran out of time.
  if (/element\(s\) not found|Test timeout of \d+ms exceeded/.test(text)) return 'wait-expired';
  // A value was observed and differed. A web-first or polled assertion also reports its timeout here, but the
  // "Received" line shows the application did answer, with something else.
  if (/^\s*Received( string| value| array| object)?:/m.test(text)) return 'assertion-mismatch';
  if (/waiting for (locator|getBy|selector)|Timeout \d+ms exceeded/.test(text)) return 'wait-expired';
  if (/expect\(.*\)\.\w+\(.*\) failed/.test(text)) return 'assertion-mismatch';
  return 'other';
}

/** Error text reduced to what stays the same between attempts: no numbers, quoted values, URLs or durations. */
export function errorSignature(message) {
  return (message ?? '')
    .split('\n')
    .filter((line) => line.trim() && !/^\s+at /.test(line) && !/^\s*\d+ \|/.test(line) && !/^\s*>/.test(line))
    .slice(0, 4)
    .join(' ')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/(["'`]).*?\1/g, '<value>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Signal details from the Failure context attachment ("Failure signals (n)" section), keyed by signal. */
function signalDetails(attachments = []) {
  const context = attachments.find((a) => a.name === 'Failure context' && a.body);
  if (!context) return {};
  const text = Buffer.from(context.body, 'base64').toString('utf8');
  const section = text.split(/\n\s*\n/).find((block) => block.startsWith('Failure signals'));
  const details = {};
  for (const line of section?.split('\n').slice(1) ?? []) {
    const match = line.match(/^\s+([a-z0-9-]+): (.+)$/);
    if (match) (details[match[1]] ??= []).push(match[2]);
  }
  return details;
}

/** Allure result key: its fullName ("file › describe › test") plus the retry index Allure records as a parameter. */
const allureKey = (fullName, retry) => `${fullName}#${retry}`;

/** failure_signal labels per attempt, from Allure results (API-only tests attach no Failure context). */
export function allureSignals(allureResults = []) {
  const byAttempt = new Map();
  for (const result of allureResults) {
    const retry = Number(result.parameters?.find((p) => p.name === 'Retry')?.value ?? 0);
    const signals = (result.labels ?? []).filter((l) => l.name === 'failure_signal').map((l) => l.value);
    byAttempt.set(allureKey(result.fullName?.replace(/\\/g, '/'), retry), signals);
  }
  return byAttempt;
}

function* walk(suites, titles = []) {
  for (const suite of suites ?? []) {
    // Top-level suites are files; their title is the file, not a describe block.
    const path = titles === null ? [] : [...titles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) yield { spec, test, describe: path };
    }
    yield* walk(suite.suites, path);
  }
}

/**
 * One record per test that triage looks at: failed (unexpected), flaky, or reached knownDefect() (whatever its
 * outcome, because Xray shows those as FAILED or asks for review). Passing tests without a known defect are left out.
 *
 * @param {any} report Playwright JSON report
 * @param {any[]} [allureResults] parsed Allure *-result.json files
 * @param {{ rootDir?: string, secrets?: (string | undefined)[] }} [options] repository root (paths are shown relative to it); values to mask
 */
export function collectOutcomes(report, allureResults = [], { rootDir, secrets = [] } = {}) {
  const signalsByAttempt = allureSignals(allureResults);
  // spec.file is relative to the test directory; the location shown to a reviewer is relative to the repository.
  const testDir = repoPath(report?.config?.rootDir, rootDir) ?? 'tests';
  const outcomes = [];
  for (const { spec, test, describe } of walk(report?.suites, null)) {
    const annotations = [...(test.annotations ?? []), ...test.results.flatMap((r) => r.annotations ?? [])];
    const knownDefect = annotations.find((a) => a.type === 'known-defect')?.description?.split(':')[0].trim() ?? null;
    if (test.status === 'expected' && !knownDefect) continue;
    if (test.status === 'skipped') continue;

    const titlePath = [...describe, spec.title];
    const file = repoPath(spec.file, rootDir);
    const fullName = [file, ...titlePath].join(' › ');
    const scenarioId = [...titlePath].reverse().map((t) => t.match(SCENARIO_ID)?.[0]).find(Boolean) ?? null;

    const attempts = test.results.map((result) => {
      const message = result.error?.message ?? result.errors?.[0]?.message ?? '';
      const stack = (result.error?.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line)).map((line) => repoPath(line.trim().replace(/^at\s+/, ''), rootDir));
      const details = signalDetails(result.attachments);
      const fromAllure = signalsByAttempt.get(allureKey(fullName, result.retry));
      const signals = [...new Set([...(fromAllure ?? []), ...Object.keys(details)])].sort();
      return {
        retry: result.retry,
        status: result.status,
        durationMs: result.duration,
        failedStep: failedStep(result.steps) ?? null,
        error: message
          ? {
              message: truncate(redact(message, secrets)),
              shape: errorShape(redact(message, secrets)),
              signature: errorSignature(redact(message, secrets)),
              location: result.error?.location ? `${repoPath(result.error.location.file, rootDir)}:${result.error.location.line}` : null,
              topFrames: stack.slice(0, 3).map((frame) => redact(frame, secrets)),
              topFrameOrigin: stack[0] ? frameOrigin(stack[0]) : null,
            }
          : null,
        signals,
        signalDetails: Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.map((d) => redact(d, secrets))])),
        // Whether this attempt's signals were read at all: absent Allure results is missing evidence, not "no signal".
        signalsRead: fromAllure !== undefined || Object.keys(details).length > 0 || result.attachments?.some((a) => a.name === 'Failure context'),
      };
    });

    outcomes.push({
      id: fullName,
      location: `${testDir}/${file}:${spec.line}`,
      titlePath,
      scenarioId,
      xrayTestKey: annotations.find((a) => a.type === 'test_key')?.description ?? null,
      knownDefect,
      raw: { playwrightStatus: test.status, expectedStatus: test.expectedStatus, attempts: attempts.map((a) => a.status) },
      xrayStatus: xrayStatusOf(test.status, test.expectedStatus, knownDefect),
      attempts,
    });
  }
  return outcomes;
}

/**
 * The status Xray receives for this test, derived the way the import does (junit-for-xray.mjs): a reproduced known
 * defect is FAILED, a known defect that no longer reproduces is PASSED. Reported next to the raw outcome, never
 * instead of it.
 */
export function xrayStatusOf(playwrightStatus, expectedStatus, knownDefect) {
  if (knownDefect && expectedStatus === 'failed') return playwrightStatus === 'expected' ? 'FAILED' : 'PASSED';
  if (playwrightStatus === 'unexpected') return 'FAILED';
  if (playwrightStatus === 'skipped') return 'TODO';
  return 'PASSED';
}

/**
 * Errors outside any test (global set-up, configuration). The reachability messages are written by
 * src/global-setup.ts itself, so they are evidence about the environment, not a guess from free text.
 */
export function collectRunErrors(report, { secrets = [] } = {}) {
  if (!report) return [{ message: 'No Playwright report: the run stopped before the tests (install, browser or configuration step failed).', origin: 'no-report' }];
  return (report.errors ?? []).map((error) => {
    const message = truncate(redact(error.message ?? '', secrets));
    const origin = /PSMusic (UI|API) is not reachable at|PSMusic API health probe returned/.test(message)
      ? 'environment-unreachable'
      : /PSMusic API refused the service key/.test(message)
        ? 'configuration'
        : /Missing environment variable/.test(message)
          ? 'configuration'
          : 'unknown';
    return { message, origin };
  });
}
