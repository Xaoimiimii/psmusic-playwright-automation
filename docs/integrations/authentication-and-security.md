# Authentication and security

Research date 2026-10-09. Sources are linked per section. No credential, token, Cloud ID or account ID is written
in this repository; the files below hold **names** of variables only.

## 1. Atlassian Rovo MCP

Source: https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/ and `…/supported-tools/`.

- Endpoint: `https://mcp.atlassian.com/v2/mcp` (configured in [`.mcp.json`](../../.mcp.json) as `atlassian-rovo`,
  enabled in `.claude/settings.local.json`). Gateways that need the full paginated tool list can use `…/v2/mcp?tools=all`.
- **OAuth 2.1** (recommended): the user signs in through the browser on first use (`/mcp` in Claude Code); the MCP acts
  with that user's Jira permissions. Nothing is stored in the repo.
- **API token** auth for non-interactive use is available only if an **organization admin enables it**.
- Tool groups are tied to scopes: `read:jira:agent-interface`, `write:jira:agent-interface`,
  `search:jira:agent-interface`; `delete:jira:agent-interface` and `manage:jira:agent-interface` are **disabled by
  default** and need admin enablement. This repo needs only read, search and write.
- Sandboxed agents need `api.media.atlassian.com` and `*.frontend.public.atl-paas.net` allowlisted for attachment
  and whiteboard tools only (`network.allowedDomains` in Claude Code). Not needed for this workflow.
- MCP calls may consume Rovo credits for Teamwork Graph / Rovo Search tools (up to 10 credits per call); the Jira
  tools used here are not in those groups.

Observed on 2026-10-09: two Atlassian MCP servers are visible in this session (`atlassian-rovo` from `.mcp.json` and
`atlassian` from the user's own Claude Code configuration), both pointing at the same site. Commands in this repo name
**`atlassian-rovo`** tools (`mcp__atlassian-rovo__…`); either works if they reach the same site.

## 2. Jira Cloud REST API

Sources: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/,
https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/

| Option | When | Base URL | Header |
|---|---|---|---|
| Classic API token | Local scripts as yourself | `https://<site>.atlassian.net` | `Authorization: Basic base64(email:token)` |
| Scoped API token (granular scopes) | CI / least privilege; **service accounts can only use scoped tokens** | `https://api.atlassian.com/ex/jira/{cloudId}` | Same Basic header |
| OAuth 2.0 (3LO) app | Multi-user apps | `https://api.atlassian.com/ex/jira/{cloudId}` | `Authorization: Bearer …` |

- Tokens are created at https://id.atlassian.com/manage/api-tokens and have an expiry date chosen at creation
  (exact maximum: see the Atlassian token page; UNVERIFIED here). Renew before expiry and rotate after any exposure.
- Smoke test without side effects: `GET {base}/rest/api/3/myself`.
- Minimum scopes for sync (classic): `read:jira-work`, `write:jira-work`, `read:jira-user`. Granular equivalents
  per operation are listed in the OpenAPI spec (`x-atlassian-oauth2-scopes`), e.g. create issue →
  `write:issue:jira`, link → `write:issue-link:jira`. No `delete:*` or `manage:*` scope is needed.
- The Cloud ID is **not** the Organization ID; using the Org ID gives `404`. The MCP tool
  `getAccessibleAtlassianResources` returns the Cloud ID.

## 3. Xray Cloud

Sources: https://docs.getxray.app/display/XRAYCLOUD/REST+API,
https://docs.getxray.app/space/XRAYCLOUD/44577089/Authentication%20-%20REST%20v2

- A Jira admin creates an **API key for a specific user** in Xray Global Settings → API Keys → Client ID + Client
  Secret. Calls run with that user's permissions: pick a user with access to the target project only.
- `POST /api/v2/authenticate` exchanges the pair for a bearer token valid **24 hours**. Request a new token per run
  (or on `401`); never persist it.
- Revoke the key in Xray Global Settings when a person leaves or a secret is exposed.

## 4. Environment variables

Defined in [`.env.example`](../../.env.example) with empty values; real values go in `.env` (git-ignored) locally
and in GitHub Actions **secrets** (secrets) or **variables** (non-secret) in CI.

| Variable | Secret? | Used by | Notes |
|---|---|---|---|
| `ATLASSIAN_SITE_URL` | No | REST fallback | `https://<site>.atlassian.net` |
| `ATLASSIAN_CLOUD_ID` | No (identifier) | REST fallback with scoped token, MCP `cloudId` | From `getAccessibleAtlassianResources` |
| `JIRA_PROJECT_KEY` | No | All commands | Must match `project-map.json` |
| `JIRA_USER_EMAIL` | Personal data | REST fallback | |
| `JIRA_API_TOKEN` | **Yes** | REST fallback | Classic or scoped |
| `XRAY_BASE_URL` | No | Xray adapter | Default `https://xray.cloud.getxray.app` |
| `XRAY_CLIENT_ID` | **Yes** | Xray adapter | |
| `XRAY_CLIENT_SECRET` | **Yes** | Xray adapter | |

The existing `src/config/env.ts` reads only the `PSMUSIC_*` variables and throws on missing ones; the new variables
must **not** be added there (tests would then require Jira credentials to run). The Xray adapter reads them itself.

## 5. Least privilege

- Use a dedicated Atlassian account (or service account with a scoped token) with *Browse*, *Create*, *Edit*, *Link
  issues* on the target project only — no *Delete issues*, no *Administer projects*.
- Keep the MCP `delete_jira` and `manage_jira` groups disabled.
- The Xray API key's user should be that same restricted account.
- `/discover-jira-xray` and `/verify-jira-xray` need only read access; run them with read-only credentials where
  possible.

## 6. Redaction in logs and reports

Repository precedent: `scripts/ci/write-ci-summary.mjs` masks JWTs (`eyJ…` → `<redacted-jwt>`), and CI disables
Playwright traces because they record headers (test-strategy §11.5). Apply the same to this integration:

- Never print `Authorization` headers, the authenticate request body, or the token.
- Mask before writing any report: JWT pattern `eyJ[\w-]+\.[\w-]+\.[\w-]+`, `Basic [A-Za-z0-9+/=]{16,}`,
  `Bearer \S+`, and the literal values of `JIRA_API_TOKEN`, `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET` if set.
- Reports under `test-management/reports/` contain issue keys, summaries and statuses — not raw API responses.
  Raw responses, if kept for debugging, go to `test-management/tmp/` (git-ignored).
- Do not include user email addresses or account IDs in committed reports; refer to "the configured account".
- JUnit evidence (`testrun_evidence`) can contain screenshots of signed-in pages; review before enabling in CI.

## 7. `.gitignore`

Already ignored: `.env`, `.env.*` (except `.env.example`). Added for this integration:

```
/test-management/tmp/
```

`test-management/config/project-map.json`, `test-management/state/*.json` and `test-management/reports/*.md` hold
no secrets and **are meant to be committed**, so an interrupted run can resume from any clone. If the team prefers
not to commit reports, add `/test-management/reports/` to `.gitignore`.
