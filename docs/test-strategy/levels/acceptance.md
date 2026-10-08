# PSMusic - Acceptance Test Strategy

| Item | Value |
|---|---|
| Level | Acceptance (ISTQB): the product against stakeholder expectations |
| Parent | `../test-strategy.md` |
| Related levels | `system.md`, `system-integration.md` (results reviewed here) |
| Status | Draft 1, 2026-10-01 |

---

## 1. Test object and purpose

PSMusic as delivered, judged by the product owner/stakeholder. This level does **not** re-run automated checks by hand. It:
1. reviews system and system-integration results per story,
2. takes the decisions that tests cannot take (privacy approvals, open expected behaviors, known-defect acceptance),
3. runs the manual checks that have no automated oracle.

## 2. Test basis

`user-stories.md`, stakeholder decisions SD-1 to SD-10, privacy approvals (§4), and the open questions of every level.

## 3. Activities

| Activity | Who | Input | Output |
|---|---|---|---|
| Story review | Product owner, QA | Latest system and SIT results per story (Allure, grouped by story) | Story accepted / not accepted / accepted with known defects |
| Known-defect decision | Product owner | `exploration-validation.md` §2 list + current status | For each defect: must fix before release, or accepted for now |
| Privacy approval | Product owner (+ legal review if the owner decides it is needed) | Candidate allowlist and observed payloads (`system-integration.md` §3.9) | Approved per-endpoint allowlist, with approver and date |
| Manual checks | QA with product owner | Checklist below | Findings logged as defects or accepted |
| Open-decision closure | Product owner / SUT team / recsys team | §5 | Updated stories; tests updated to the new oracle |

### 3.1 Manual checklist

| Check | Story | Why manual |
|---|---|---|
| Translation completeness and wording in `vi`, `en`, `ja`, `ru`, `de` (a missing `genre_category` key was seen) | US-018-AC-04 | No oracle for "reads well" |
| Theme colors look correct for all six themes | US-019 | Visual |
| Audio quality, lyric sync looks right | US-013, US-011-AC-04 | Subjective |
| Recommendation banner wording, popup layout, popup overlap with the player (F-2) | US-022 | Visual; expected behavior open |
| Download of songs with unusual titles; playlist download timing | US-012, US-016-AC-06 | Rare, low repeat value |
| First look at new tracker features or routes (`/search` and logged-in `/favorites` popups, configured but never observed) | US-022 | Exploratory |
| Production build vs dev build (duplicate requests, duplicate player controls) | F-3, F-4 | One-off comparison |

## 4. Privacy approvals

The automated privacy checks (`system-integration.md` §3.9) detect **what** is sent. Whether it is **allowed** is decided here. Until approved, an observed field is reported as `UNAPPROVED FIELD`.

| To approve | Current status |
|---|---|
| Fields per endpoint: `/recommendation`, `/event` (`Timestamp`, `EventTypeId`, `ActionType`, `TrackingRuleId`, `DomainKey`, `AnonymousId`, `UserId`, `ItemId`), `/evaluation`, `push-keyword` | Candidate baseline only |
| Username as `UserId`, including after logout | Accepted by the stakeholder (F-R1). Formal privacy assessment not done |
| Review comment text sent by rule 166 | Open |
| Search keyword sent after consent | Accepted (US-022-AC-12) |

This strategy records technical facts and stakeholder decisions. It does not make legal judgements.

## 5. Open decisions

Owners: PO = product owner, SUT = PSMusic team, RS = recsys team, QA = QA lead.

| # | Decision needed | Owner | Blocks |
|---|---|---|---|
| A-Q1 | Does "nothing is sent" before a choice and after Decline still allow an anonymous `/recommendation` request? | PO | Consent oracle (`system-integration.md` §3.9) |
| A-Q2 | Approved allowlist per recsys endpoint | PO + RS | Privacy suite oracle |
| A-Q3 | May review comment text and any typed search keyword be sent? | PO | Privacy suite oracle |
| A-Q4 | Username vs pseudonymous `UserId` | PO | Privacy assessment |
| A-Q5 | Expected behavior for tracker timeout, 4xx, malformed response, partial items, config failure, empty popup | PO + RS | Rows marked "Confirm" in `system-integration.md` §3.8 |
| A-Q6 | Is the popup intercepting clicks on core controls (F-2) acceptable? | PO | Resilience matrix |
| A-Q7 | Download sends two events per click: intended? | RS | Telemetry matrix |
| A-Q8 | Test domain key for real-mode recsys traffic | RS | Real-mode volume |
| A-Q9 | Notice of recsys rule and `loader.js` changes; loader versioning | RS | Drift handling |
| A-Q10 | Banner and popup off in test builds? | SUT | Simpler system-level setup |
| A-Q11 | App repo → this repo trigger; who receives SIT notifications | SUT + QA | CI |
| A-Q12 | Does a new privacy defect block a release? | PO | Release decision |
| A-Q13 | Song-specific recommendations on song pages (accepted as is by SD-10) | PO | Closed unless reopened |
| A-Q14 | Tracker clock offset (F-R4): report to recsys? | RS | Telemetry `Timestamp` check |
| A-Q15 | Review comment length limit and rejection status code | PO | US-017-AC-10 |
| A-Q16 | Profile endpoint and UI | PO + SUT | US-023 |
| A-Q17 | UI sign-up approach: real mailbox or approved mock | PO | US-001-AC-03 |
| A-Q18 | MP3 failure behavior in the player | PO | `system-integration.md` §5 |

Environment questions (CI environment, write environment, test account, browsers, known indexed search titles, short token lifetime, test ids) are listed in `../test-strategy.md` §13.3.

## 6. Entry criteria

- System-level critical regression results available for the build.
- Latest nightly SIT results classified.
- Known-defect list up to date.

## 7. Exit criteria (release acceptance)

- Every story is accepted, or accepted with named known defects.
- No privacy defect open without a decision (A-Q12).
- Manual checklist run for the release, with findings logged.

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Created from `../test-strategy.md` §4 (acceptance row), §9 and the open questions of the former recommendation strategy |
