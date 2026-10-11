// Records which PSMusic deployment started a post-deployment run (docs/ci-cd.md section 8).
// Reads APP_REPO, APP_SHA, APP_RUN_URL and APP_ENVIRONMENT, sent by the application repository's
// "Deploy to QA" workflow. In GitHub Actions it is appended to the run page ($GITHUB_STEP_SUMMARY);
// locally it is printed. Usage: node scripts/ci/write-trigger-summary.mjs
// It never fails: a missing value is shown as "unknown" rather than stopping the tests.
import fs from 'node:fs';

/** Keeps a payload value only if it looks like what it should be, so the payload cannot inject Markdown. */
function safe(value, pattern) {
  const text = (value ?? '').trim();
  return pattern.test(text) ? text : '';
}

const repo = safe(process.env.APP_REPO, /^[\w.-]+\/[\w.-]+$/);
const sha = safe(process.env.APP_SHA, /^[0-9a-f]{7,40}$/i);
const runUrl = safe(process.env.APP_RUN_URL, /^https:\/\/github\.com\/[\w./-]+$/);
const environment = safe(process.env.APP_ENVIRONMENT, /^[\w-]{1,40}$/);

const commit = repo && sha ? `[\`${sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${sha})` : sha || 'unknown';
const lines = [
  '### Started by a PSMusic deployment',
  '',
  '| | |',
  '|---|---|',
  `| Environment | ${environment ? `\`${environment}\`` : 'unknown'} |`,
  `| Application repository | ${repo ? `\`${repo}\`` : 'unknown'} |`,
  `| Commit | ${commit} |`,
  `| Deployment run | ${runUrl ? `[open](${runUrl})` : 'unknown'} |`,
  '',
  'The deployment is simulated: the tests run against the environment in PSMUSIC_UI_URL and PSMUSIC_API_URL, ' +
    'which is not rebuilt from this commit (docs/ci-cd.md section 8).',
  '',
];
const markdown = lines.join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
} else {
  console.log(markdown);
}
