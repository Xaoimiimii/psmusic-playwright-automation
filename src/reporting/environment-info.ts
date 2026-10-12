import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Version of an installed package, read from its package.json; "unknown" when it cannot be read.
 * Walks up from the entry point, because some packages (allure-playwright) do not export package.json.
 */
function packageVersion(name: string): string {
  try {
    let dir = path.dirname(require.resolve(name));
    while (dir !== path.dirname(dir)) {
      const file = path.join(dir, 'package.json');
      if (fs.existsSync(file)) {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: string; version: string };
        if (pkg.name === name) return pkg.version;
      }
      dir = path.dirname(dir);
    }
  } catch {
    // fall through
  }
  return 'unknown';
}

/** Chromium version Playwright installs and runs (no `channel` is configured, so the bundled build is used). */
function bundledChromiumVersion(): string {
  try {
    const file = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'browsers.json');
    const browsers = (JSON.parse(fs.readFileSync(file, 'utf8')) as { browsers: { name: string; browserVersion?: string }[] }).browsers;
    return browsers.find((browser) => browser.name === 'chromium')?.browserVersion ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function git(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Origin only: a configured URL never carries a path, query or credentials into the report. */
function origin(url: string | undefined): string {
  if (!url) return 'not set';
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid URL';
  }
}

/**
 * Run facts for Allure's environment widget (`environment.properties`), read at
 * run time rather than hard-coded. Contains no secrets: no service key, no
 * tokens, URL origins only.
 */
export function allureEnvironmentInfo(): Record<string, string> {
  const {
    CI, GITHUB_ACTIONS, GITHUB_SHA, GITHUB_REF_NAME, GITHUB_HEAD_REF, GITHUB_WORKFLOW, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID,
    GITHUB_RUN_ATTEMPT, PSMUSIC_ENVIRONMENT,
  } = process.env;
  const commit = GITHUB_SHA?.slice(0, 12) ?? git('rev-parse --short=12 HEAD') ?? 'unknown';
  const branch = GITHUB_HEAD_REF || GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD') || 'unknown';
  const dirty = !GITHUB_ACTIONS && git('status --porcelain') ? ' (with uncommitted changes)' : '';

  const info: Record<string, string> = {
    // Optional name (e.g. "qa"), set by the workflows; the origins below identify the environment either way.
    'Test environment': PSMUSIC_ENVIRONMENT || 'not named',
    'PSMusic UI': origin(process.env.PSMUSIC_UI_URL),
    'PSMusic API': origin(process.env.PSMUSIC_API_URL),
    Execution: GITHUB_ACTIONS ? `GitHub Actions: ${GITHUB_WORKFLOW ?? 'workflow'}` : CI ? 'CI' : 'Local',
    'Test command': ['playwright', ...process.argv.slice(2)].join(' '),
    'Git branch': branch,
    'Git commit': `${commit}${dirty}`,
    Browser: `Chromium ${bundledChromiumVersion()} (Playwright bundled)`,
    Playwright: packageVersion('@playwright/test'),
    'allure-playwright': packageVersion('allure-playwright'),
    'Node.js': process.version,
    OS: `${os.type()} ${os.release()} (${os.arch()})`,
  };
  // Attempt URL: a re-run keeps the run ID, so the ID alone does not say which attempt produced this report.
  // The Xray Test Execution key is added after the run by scripts/ci/xray-execution.mjs.
  if (GITHUB_RUN_ID) info['CI run'] = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT ?? '1'}`;
  return info;
}
