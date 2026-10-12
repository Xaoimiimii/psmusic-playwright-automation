# test-management

Local state for syncing this repository's testware with Jira and Xray. How it is used:
[`docs/integrations/README.md`](../docs/integrations/README.md).

| Path | Written by | Committed | Contents |
|---|---|---|---|
| `config/project-map.example.json` | People | Yes | Template |
| `config/project-map.json` | People, from `/discover-jira-xray` output | Yes | Verified project configuration (no secrets) |
| `state/plan.schema.json`, `state/issue-map.schema.json` | People | Yes | JSON Schemas |
| `state/plan.json` | `/plan-jira-xray` | Yes | Planned entities and relationships with local IDs |
| `state/issue-map.json` | `/sync-jira-xray` | Yes | Local ID → Jira key / id, Xray data, creation and verification status |
| `reports/<command>-<YYYYMMDD-HHmmss>.md` | Every command | Yes (redacted) | Run reports |
| `state/triage-map.json` | `/triage-jira` (`triage-jira.mjs apply`) | Yes | Failure fingerprint → Bug linked or created by an approved triage write, and the runs it was linked for ([`docs/failure-triage.md`](../docs/failure-triage.md) §7) |
| `reports/triage-audit.jsonl` | `/triage-jira` | Yes | Append-only audit of every triage write: intent, outcome, read-back |
| `reports/triage-plan-<YYYYMMDD-HHmmss>.json` | `/triage-jira` (`plan`) | Yes | Proposals as checked at plan time; the input of `apply` |
| `tmp/` | Debugging only | **No** (git-ignored) | Raw API responses |

## Local IDs

Stable and derived from the source documents, never from Jira:

| Entity | Local ID | Source |
|---|---|---|
| Epic | `FA-01` … | `docs/test-strategy/test-strategy.md` §3 |
| Story | `US-001` … | `docs/requirements/user-stories.md` |
| Requirement (cross-cutting) | `TECH` | `docs/requirements/user-stories.md` "Technical behaviors" |
| Risk | `PR-01` …, `TR-01` … | `docs/test-strategy/risk-register.md` |
| Test | `TS-<AREA>-<NN>` | `docs/test-strategy/test-scenarios.md` |
| Bug | `BUG-<AC id>` or `BUG-<finding>` (e.g. `BUG-US-004-AC-01`, `BUG-A-11`) | `docs/exploration/exploration-validation.md` §2, `browser/authentication.md` |
| Test Set | `SET-<AREA>` (e.g. `SET-AUTH`) | Derived from the test ID area |
| Test Plan | `PLAN-<NAME>` (e.g. `PLAN-REGRESSION`) | Declared in the plan |
| Test Execution | `EXEC-<NAME>-<YYYYMMDD>` | Created by imports |

These match the IDs `scripts/test-management/jira-export.mjs` already uses, except that Bug IDs gain a `BUG-` prefix so they cannot
be confused with acceptance-criterion IDs.
