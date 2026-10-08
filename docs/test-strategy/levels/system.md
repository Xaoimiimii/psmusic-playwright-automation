# PSMusic - System Test Strategy

| Item | Value |
|---|---|
| Level | System (ISTQB): PSMusic as a whole (SPA + API + its database), with external systems controlled |
| Parent | `../test-strategy.md` |
| Related levels | `component-integration.md` (internal contracts), `system-integration.md` (real external systems), `acceptance.md` |
| Status | Draft 1, 2026-10-01 |

---

## 1. Test object

The complete PSMusic application, used the way users use it, with every external system **blocked or mocked**:

| External system | Condition at system level |
|---|---|
| Recsys tracker (loader + service) | **Blocked** (Mode 0, §4) |
| Abstract email check | Not called. UI sign-up success is not tested here |
| Elasticsearch | Real behind the API (key renewed 2026-10-08, SD-1). Search UI logic still uses fulfilled `GET /api/song/search` responses in the browser so it does not depend on index content; real results are checked at system integration |
| S3 media | **Real**. Playback is core product value and S3 is not known to be unstable. An S3 failure is classified as availability (`../test-strategy.md` §11.3) |

## 2. Test basis

`docs/requirements/user-stories.md` (US-001 to US-023) and the stakeholder decisions SD-1 to SD-10. Where a story is marked DEFECT, tests assert the story, not the current behavior (`exploration-validation.md` §9).

## 3. Scope

| Group | Content | Interface | Stories |
|---|---|---|---|
| Client validation | Messages and "no request sent" for login, sign-up, rating | UI + request capture | US-001-AC-01/02, US-002-AC-01/02/06/07, US-017-AC-01 |
| Session behavior | Login → home after ~1 s, restore on reload, guest after logout, logout lands on `/` from every page | UI | US-002-AC-03, US-003-AC-01/03, US-004-AC-01/03 |
| Gating | Sign-in modal for guests (sidebar, player heart and rate), `/favorites` and `/recent` redirects, modal close and scroll lock | UI | US-014, US-016-AC-07, US-020-AC-04 |
| Discovery pages | Section limits, links, paging, ordering by streams, empty states, not-found states | UI (+ API for ordering) | US-005 to US-009 |
| Search UI | Threshold, debounce, suggestions, tabs, empty message, clear button | UI with fulfilled search responses | US-010 (logic only; real results in `system-integration.md` §4) |
| Song page | Content, lyrics, show more, other songs, "Song not found", heart/star state after reload | UI | US-011 |
| Download | File name, guest allowed | UI | US-012-AC-01/03 |
| Player | Play/pause, next/previous, repeat, shuffle, volume, auto-advance, title link, guest play | UI | US-013 |
| Favorites | Toggle, count change, disabled while in flight, favorites page, play all, drag (client only), show more | UI + API read-back | US-015, US-016 |
| Rating and review | Modal states, submit, list order and date, rated state, error message | UI | US-017-AC-01 to AC-08 |
| Server-enforced rules | One review per user and song, rating 1-5, one stream per playback after 20 s, guest records no stream, cross-user profile read refused | API | US-017-AC-09/10, US-021-AC-01/02, US-023-AC-01/03 |
| Popularity | Ordering by streams in the last 7 days, caches | API (+ UI structure) | US-005-AC-05, US-007-AC-03, US-021-AC-03/04 |
| Language and theme | Switch, `<html lang>`, persistence, fallback | UI | US-018, US-019 |
| Navigation | Sidebar highlight, user menu, not-found page | UI | US-020 |
| User journeys | Guest: Home → Genre → Song → Play. Member: login → play → favorite → `/favorites` → logout lands on `/`. Member: rate an unreviewed song (approved write environment only) | UI | Several |
| Tracker absence | The app works with the tracker blocked: no page errors, recommendation headings present, sections empty | UI | US-022-AC-04 (failure side) |

| Out of scope at this level | Where it goes |
|---|---|
| Request/response shapes, status codes, auth headers | `component-integration.md` |
| Recommendation display, clicks, telemetry, privacy | `system-integration.md` §3 |
| Real search results, real media failures, real email check | `system-integration.md` |
| Visual quality, translation completeness, audio quality | `acceptance.md` |
| Responsive layout, performance, non-Chromium browsers | `../test-strategy.md` §2.2 |

## 4. Tracker-blocked rule (Mode 0)

Every system-level test aborts requests to the recsys loader (`tracking-sdk.s3-ap-southeast-2.amazonaws.com/dist/loader.js`) and to `recsys-tracker-module-*.onrender.com`. This follows the stakeholder rule (US-022 "Test placement") and removes:
- the privacy banner and the popup that intercept clicks (F-2),
- the cold-start latency of a free-tier host,
- the leak of a previous user's identity between tests (F-R1).

Recommendation behavior itself is **never** asserted here. Only the absence case is: the page works and the headings stay (US-022-AC-04). Everything else is in `system-integration.md` §3.

## 5. Approach

- **UI** for what the user sees: page objects, role/`href`/heading locators, language pinned to `en`, player locators scoped to the player wrapper (`exploration-validation.md` §7).
- **API** for server-enforced rules and for setup (users, favorites). UI tests are short: state is created through the API, then checked in the UI.
- **Duplication guard** (`../test-strategy.md` §4.3): a rule checked through the API is not re-checked through the UI. The UI only checks its visible effect.
- **Journeys** are few (about three). Edge cases stay in focused tests.
- **Known defects** (US-004-AC-01, US-007-AC-05, US-009-AC-05, US-011-AC-06, US-015-AC-01, US-017-AC-05/09/10, US-020-AC-05, US-023-AC-03) assert the story and carry `@known-defect`.

## 6. Entry criteria

- PSMusic UI and API reachable; configuration and secrets in place.
- Component integration smoke passed in the same pipeline.
- Tracker-blocking fixture active.
- For write tests that cannot be cleaned up (reviews, streams): approved write environment (`../test-strategy.md` §7.4).
- For blocked areas: their entry condition (`../test-strategy.md` §8.5).

## 7. Exit criteria

- Every in-scope AC has a result: pass, known defect, or blocked with a reason.
- No unexplained failure. Each one is classified (`../test-strategy.md` §11.3).
- Flaky tests are fixed or quarantined with an owner and date.
- Journeys pass.

## 8. Environment and data

Per `../test-strategy.md` §7 and §8: Chromium; per-test users created through the API; read-only catalog (songs 1, 2179, 581; categories 1, 2, 10, 26; unknown id `99999999`); storage reset per test; delta assertions on counters; popularity data checked for presence before ordering assertions.

## 9. Suites and CI role

| Tag | Content | CI |
|---|---|---|
| `@smoke` | App loads; guest opens Home, Genres, Charts, a song page; song plays; login + reload keeps the session; guest gated from `/favorites` | App gate (blocking) on every PR |
| `@critical` | Session, gating, favorites, not-found states, review server rules (approved environment), known defects | Merge to main (blocking) |
| `@regression` | Discovery details, player controls, download, language/theme, stream recording, search UI | Nightly |
| `@write-permanent` | Reviews and streams | Only where an approved write environment exists |
| `@known-defect` | Tests that assert stories marked DEFECT | Reported separately, not blocking |

## 10. Story coverage

All stories US-001 to US-023 have at least one system-level check, except where blocked: US-001-AC-03 (UI sign-up success), US-003-AC-04/05 (token expiry). US-010 real results are checked at system integration (`system-integration.md` §4). US-022 is covered here only for the absence of the tracker.

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Created from `../test-strategy.md` §4 (system row) and the Mode 0 rule of the former recommendation strategy |
| 2026-10-08 | Elasticsearch no longer blocked (key renewed) |
