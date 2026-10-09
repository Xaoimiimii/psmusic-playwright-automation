---
description: Build the persistent Jira/Xray sync plan (Epics, Stories, Risks, Bugs, Tests, Test Sets, Test Plans) from the repo; no Jira writes
argument-hint: [area filter, e.g. AUTH] [--full]
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(node scripts/jira-export.mjs:*), Write(test-management/state/plan.json), Write(test-management/reports/*)
---

# Plan Jira/Xray entities (local only)

Arguments: `$ARGUMENTS` — optional area filter (e.g. `AUTH` keeps `FA-02`, `US-002…US-004`, `TS-AUTH-*` and their
risks); `--full` (default) plans everything.

Reference: `test-management/README.md` (local ID rules), `test-management/state/plan.schema.json`,
`docs/integrations/capability-matrix.md`. Apply `.claude/rules/traceability-rules.md` (coverage, risk, Xray
organization rules) throughout.

**Status:** operational (local analysis only).

## Prerequisites

- `test-management/config/project-map.json` exists (from `/discover-jira-xray`); without it plan anyway but mark
  every relationship `relationshipKey: null` and say so.

## Inputs (source of truth, in this order)

1. `docs/requirements/user-stories.md` → Stories `US-nnn`, Requirement `TECH`.
2. `docs/test-strategy/test-strategy.md` §3 → Epics `FA-nn` and which stories belong to each.
3. `docs/test-strategy/risk-register.md` §2–4 → Risks `PR-nn`, `TR-nn`, their stories and areas.
4. `docs/test-strategy/test-scenarios.md` → Tests `TS-<AREA>-nn` (objective, flow → steps, expected, story/AC, risk).
5. `docs/test-strategy/automation-analysis.md` §3 and `docs/test-case-implementation-progress.md` → automation
   classification and which `tests/**/*.spec.ts` implements each scenario.
6. `docs/exploration/exploration-validation.md` §2, `docs/exploration/browser/authentication.md` → Bugs.
7. Application source only when a document is ambiguous (CLAUDE.md §2); never edit it.

`scripts/jira-export.mjs` already parses these documents. Reuse its parsing rules (run it with
`JIRA_EXPORT_OUT=test-management/tmp/export` to compare) rather than inventing different ones.

## Allowed

Reading repo files; running the export script into `test-management/tmp/`; writing `test-management/state/plan.json`
and the report.

## Prohibited

Any MCP or Xray call that writes. Inventing requirements, acceptance criteria, risks or link semantics not present in
the documents. Assigning Jira keys (they belong in `issue-map.json`). Marking entities `approved: true` — only the
reviewing person does that.

## Steps

1. Read the inputs; record each file's path and SHA-256 in `sources`, plus `git rev-parse HEAD`.
2. Create entities with deterministic local IDs (see `test-management/README.md`). Same input → same IDs and order.
3. Tests: one per scenario. `xray.testType` = the project's manual type for manual scenarios; for scenarios with an
   implemented spec set `automatedSpec` (`tests/...spec.ts > <title>`) and the automated type from
   `project-map.json` (`xray.automatedTestType`), or null if unknown. Steps come from the scenario's Flow/Data/Expected.
4. Test Sets: one `SET-<AREA>` per scenario area; Test Plans: `PLAN-REGRESSION` (all `AUTOMATE` scenarios) and
   `PLAN-SMOKE` (tests tagged `@smoke` in `tests/`) unless the user asks otherwise.
5. Relationships: Story→Epic `parent`; Test→Story `testCoversRequirement`; Risk→Story/Epic `riskRelatesToStory/Epic`;
   Bug→Story `bugAffectsStory`; Test→Bug `bugFoundByTest`; set/plan memberships. Only from explicit references in
   the documents.
6. Ambiguities: e.g. scenario referencing a non-existent story, story in two epics, AC with no scenario, defect with no
   risk, provisional or blocked items. Mark `blocking: true` when the entity cannot be synced correctly.
7. Coverage gaps: in-scope stories without tests, high-priority (P1) risks without a mitigation test or documented
   exception, P1 scenarios not automated. A gap is recorded, never hidden by attaching an unrelated test.
8. If `test-management/state/plan.json` exists, diff against it and list added / removed / changed local IDs. Never
   silently drop an entity: removed ones are listed for the reviewer (sync never deletes them in Jira).
9. Validate `plan.json` against `plan.schema.json` (by reading the schema; a validator script is a follow-up task).

## Output

- `test-management/state/plan.json` (all entities `approved: false` on first creation; keep existing approvals for
  unchanged entities when regenerating).
- `test-management/reports/plan-<YYYYMMDD-HHmmss>.md`: counts per type, relationship counts, diff, ambiguities,
  coverage gaps, and the instruction to review and approve before `/sync-jira-xray`.

## Failure handling

A source file missing or unparseable → stop and name it. Conflicting facts between documents → record an ambiguity;
do not pick one silently.
