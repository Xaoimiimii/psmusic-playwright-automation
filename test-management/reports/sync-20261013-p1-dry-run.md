# Sync report — SYNC-20261013-p1 (dry run)

| Item | Value |
|---|---|
| Mode | **dry run** (no Jira or Xray write) |
| Target | project **MSC** (id 10005) |
| Plan | [`plans/plan-20261013-p1-core-coverage.md`](../plans/plan-20261013-p1-core-coverage.md), `state/plan.json` generatedAt `2026-10-13T05:38:48.943Z` |
| Discovery | [`discover-20261013-090000.md`](discover-20261013-090000.md): OK, no CRITICAL item |
| Approval | The 13 changed Tests and the PLAN-SMOKE membership were approved by the user on 2026-10-13 |

## Counts

| Type | Planned | Matched (exists) | Would create | Would update | Skipped | Failed |
|---|---|---|---|---|---|---|
| Test | 117 | 117 | 0 | 13 | 0 | 0 |
| Test Plan membership | 105 | 105 | 1 (TS-E2E-01 → PLAN-SMOKE) | 0 | 0 | 0 |
| Other types / links | unchanged | — | 0 | 0 | 0 | 0 |

## Would update (`editJiraIssue`; Xray type and steps untouched)

| Local ID | Key | Labels | Other fields |
|---|---|---|---|
| TS-E2E-01 | MSC-208 | +automated, +smoke / -not-automated | description: implemented: Yes |
| TS-E2E-02 | MSC-209 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-01 | MSC-150 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-02 | MSC-151 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-03 | MSC-152 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-04 | MSC-153 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-05 | MSC-154 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-07 | MSC-156 | +automated / -not-automated | description: implemented: Yes |
| TS-PLAY-08 | MSC-157 | +automated / -not-automated | description: implemented: Yes |
| TS-REC-12 | MSC-201 | +automated / -not-automated | description: implemented: Yes |
| TS-REV-01 | MSC-171 | +automated / -not-automated | description: implemented: Yes |
| TS-REV-02 | MSC-172 | +partially-automated / -not-automated | description: implemented: Partial |
| TS-REV-04 | MSC-174 | +partially-automated / -not-automated | description: implemented: Partial |

Conflict check: `listJiraIssueChangelogs` on all 13 issues shows only the coverage links written by the 2026-10-09 sync;
nobody edited summary, description, labels or priority. Labels people may add are kept (`update-payload`).

## Would add (Xray `add-tests-to-plan`)

TS-E2E-01 (MSC-208) to PLAN-SMOKE (MSC-229). `sync-xray.mjs members --dry-run`: PLAN-SMOKE planned 5, members 4,
no unexpected member; every other container already matches.

## Duplicates

None (one issue per local ID, JQL on `lid_` labels).
