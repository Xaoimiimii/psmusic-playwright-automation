# PSMusic - Automation Analysis

| Item | Value |
|---|---|
| Inputs | `test-scenarios.md` (117 scenarios), `risk-register.md`, `test-strategy.md`, `levels/*.md`, `docs/requirements/user-stories.md`, `docs/exploration/` |
| Stack (fixed by `CLAUDE.md`) | Playwright Test + TypeScript; `APIRequestContext` for API; Allure; GitHub Actions |
| Status | Draft 1, 2026-10-01. Updated 2026-10-08: TS-SRCH-07 and TS-SRCH-08 moved from DEFER to AUTOMATE (Elasticsearch key renewed) |
| Feeds | Automated Test Design, Manual Test Design, Automation Implementation |

This document decides **how** each scenario should be validated: which layer, whether to automate, and what it needs. It contains no code. Nothing here requires a change to the SUT.

---

## 1. Automation strategy summary

1. **API first for rules, UI for what only the browser can show.** Server rules (review uniqueness, rating range, authorization, status codes, contracts) are automated through `APIRequestContext`. The UI is used for client validation, rendering, navigation, gating, the player and browser storage. A scenario is not given UI automation just because a user sees it.
2. **Control our own API in the browser to avoid permanent writes and blocked dependencies.** Several scenarios test client behavior that is triggered by an API response. Fulfilling or intercepting that response in the browser (`page.route`) tests the client logic without writing to the shared database or waiting for an environment:
   - review submit, review date and empty comment;
   - stream request after 20 s;
   - 401 → refresh → retry;
   - empty states;
   - search UI.

   The **server** half of those scenarios stays deferred until the write environment or short-token environment exists (the Elasticsearch key, the third blocker, was renewed on 2026-10-08). This split is the main lever. Without it, TS-AUTH-07, TS-AUTH-08, TS-REV-02, TS-REV-04 and TS-STRM-01 would wait for an environment. It also lets TS-REV-03, TS-REV-05 and TS-REV-06 run without writing permanent reviews.
3. **Third parties never in the app gate.** The recsys tracker is blocked in every non-SIT test. Recommendation scenarios are automated as system integration, Mode A (controlled) or Mode B (real, capture only), in their own jobs.
4. **Few journeys.** Two E2E journeys plus one real-service recommendation journey. Edge cases stay in focused tests.
5. **Manual and exploratory where judgement or an unknown oracle is involved.** Four scenarios are manual and five are exploratory. A further 7 are deferred, mostly blocked by the environment or a pending decision rather than by low value.

### 1.1 Classification totals

Computed from the tables in section 3.

| Classification | Count |
|---|---|
| AUTOMATE — API | 13 |
| AUTOMATE — UI | 57 |
| AUTOMATE — INTEGRATION | 17 |
| AUTOMATE — E2E | 3 |
| AUTOMATE — MULTI-LAYER | 11 |
| MANUAL | 4 |
| EXPLORATORY | 5 |
| DEFER | 7 |
| **Total** | **117** |

**101 automation candidates** (86%): 85 full and 16 partial. In a partial scenario one part is automated now and the rest waits for a dependency (section 10.2). 16 scenarios are not automated for now.

The UI count is high because most user stories describe client behavior: gating, player, rendering, client validation, controlled search. It does not mean server rules are tested through the UI. Every server rule is classified API or MULTI-LAYER.

### 1.2 By risk priority

| Priority | Scenarios | Automated (full or partial) | Manual / exploratory | Deferred |
|---|---|---|---|---|
| P1 | 32 | 29 | 0 | 3: TS-PLAY-10, TS-REV-07, TS-REV-08 |
| P2 | 36 | 34 | 1: TS-STRM-03 | 1: TS-DISC-02 |
| P3 | 49 | 38 | 8 | 3: TS-REG-04, TS-REG-08, TS-DISC-06 |
| **Total** | **117** | **101** | **9** | **7** |

All three deferred P1 scenarios are blocked by an environment or a decision, not by automation cost.

---

## 2. Code legend for the scenario tables

To keep 117 rows readable, dependencies, data, reliability and maintenance are given as codes.

### Dependencies

| Code | Dependency |
|---|---|
| D-API | PSMusic API reachable + `X-App-Service-Key` |
| D-UI | PSMusic UI + API reachable (implies D-API) |
| D-S3 | Real media from S3 (audio, lyrics, download) |
| D-T0 | Tracker blocking fixture (every UI test unless stated) |
| D-TA | Recsys Mode A fixtures (needs the Mode A spike, TR-11) |
| D-TB | Real recsys service with preflight |
| D-RC | Browser response control for PSMusic API or S3 (fulfil, abort, delay) |
| D-WR | Approved write environment (TR-01) |
| D-TOK | Short token lifetime environment (TR-09) |
| D-ES | Real Elasticsearch index (key renewed 2026-10-08; indices refilled at API startup) + known titles (`B:search.md` §5) (TR-05) |
| D-EM | Approval to mock the email check (A-Q17) |
| D-DEC(x) | Pending decision x (A-Q numbers in `levels/acceptance.md`) |

### Test data

| Code | Data |
|---|---|
| T-0 | None |
| T-U | Fresh user created through the API (run-unique) |
| T-U2 | Two fresh users |
| T-CAT | Read-only catalog ids (songs 1, 2179, 581; categories 1, 2, 10, 26; artist 1) |
| T-UNK | Unknown id `99999999` |
| T-FAV | Favorites set up through the API (reversible) |
| T-REV | Fresh user + unreviewed song; review is permanent |
| T-FIX | Recorded / controlled response fixtures |
| T-CAN | Canary user (unique password and email) |
| T-SEED | Seeded streams with known counts |
| T-GAP | Catalog item not identified yet (song without lyrics, title of 25/26 chars, song without reviews, artist without main genre) |

### Reliability concerns

| Code | Concern |
|---|---|
| R-SYNC | Async session restore, route content swap, debounce |
| R-AUD | Audio buffering and real playback time |
| R-RAND | Random queue / shuffle |
| R-SHR | Shared counters changed by other users |
| R-DUP | Duplicated player controls, duplicated dev-build requests |
| R-3P | Third-party availability |
| R-TIME | Time windows and caches (7-day popularity, 15/10 min caches) |
| R-LOC | Fragile locators, language-dependent names |
| R-STATE | Storage or identity leakage between tests |
| R-SLOW | Long test (≥ 20 s) |
| — | No notable concern |

### Maintenance considerations

| Code | Consideration |
|---|---|
| M-LOW | Stable contract, low maintenance |
| M-LOC | Hashed classes / icon controls; locator upkeep |
| M-FIX | Fixtures must follow contract or config changes |
| M-KD | Known-defect annotation must be removed when fixed |
| M-DEC | Expected result may change after a decision |
| M-TXT | Literal (Vietnamese) messages asserted |

Type codes: **F** functional, **N** negative, **B** boundary, **V** validation, **EH** error handling, **ST** state transition, **DI** data integrity, **SEC** security, **PRIV** privacy, **ROB** robustness, **CON** contract.

---

## 3. Scenario-by-scenario classification

Candidate: **Y** yes, **P** partial, **N** no. Layers: API, UI, INT (integration with an external system or controlled responses of one), DATA (re-read through the API), E2E, MAN.

### 3.1 Registration

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-REG-01 | P3 | PR-22 | Empty fields blocked client-side | SYS | V, N | Y | UI | AUTOMATE — UI | "No request sent" is only observable in the browser | D-UI | T-0 | R-LOC (both forms in DOM) | M-LOC |
| TS-REG-02 | P3 | PR-22 | Password length boundary 7/8 | SYS | B, V | Y | UI | AUTOMATE — UI | Client rule; the 8-char case only needs to reach the email check, which is aborted | D-UI, D-RC | T-0 | — | M-LOC |
| TS-REG-03 | P3 | PR-22 | API registration creates an account | CI | F, CON | Y | API, DATA | AUTOMATE — API | Server behavior; the UI path is blocked anyway | D-API | T-U | — | M-LOW |
| TS-REG-04 | P3 | PR-22, TR-06 | UI sign-up success | SYS+SIT | F | N | UI, INT | DEFER | Needs a real mailbox or an approved mock | D-EM | T-U | R-3P | M-DEC |
| TS-REG-05 | P3 | PR-22 | Duplicate username / email | CI | N, DI | P | API (UI later) | AUTOMATE — API | Messages and status come from the server; the UI only reaches register after the email check (deferred with D-EM) | D-API | T-U | — | M-TXT |
| TS-REG-06 | P2 | PR-11 | Password never returned | CI | SEC | Y | API | AUTOMATE — API | Sweep across all auth/user responses; cheap and high value | D-API | T-CAN | — | M-LOW |
| TS-REG-07 | P3 | PR-22 | Username > 30 chars | CI | B | N | API | EXPLORATORY | Expected result unknown; probe once, record, then decide | D-API | T-0 | — | M-DEC |
| TS-REG-08 | P3 | PR-22 | External check rejects the email | SIT | N | N | UI, INT | DEFER | Needs approval to mock the email check; the real check costs quota | D-EM | T-FIX | — | M-FIX |

### 3.2 Authentication and session

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-AUTH-01 | P1 | PR-07 | Valid login creates a session | CI+SYS | F, CON | Y | API, UI | AUTOMATE — MULTI-LAYER | API proves token, user and cookie flags; UI proves message, redirect and signed-in header. Neither layer alone covers both | D-UI | T-U | R-SYNC | M-TXT |
| TS-AUTH-02 | P3 | - | Login client validation | SYS | V, B | Y | UI | AUTOMATE — UI | Client-only rule | D-UI | T-0 | — | M-LOC |
| TS-AUTH-03 | P1 | PR-07 | Unknown user / wrong password | CI+SYS | N | Y | API, UI | AUTOMATE — MULTI-LAYER | Both cases at API; one UI check that the server message is displayed | D-UI | T-U | — | M-TXT |
| TS-AUTH-04 | P3 | - | Eye toggle and panel switch | SYS | F | Y | UI | AUTOMATE — UI | Cheap, deterministic | D-UI | T-0 | R-LOC | M-LOC |
| TS-AUTH-05 | P1 | PR-07 | Reload restores the session | SYS | ST | Y | UI | AUTOMATE — UI | Session restore is a browser + cookie behavior | D-UI | T-U | R-SYNC (wait for refresh) | M-LOW |
| TS-AUTH-06 | P1 | PR-07 | No cookie → guest | CI+SYS | ST, N | Y | API, UI | AUTOMATE — MULTI-LAYER | API: 200 + `isSuccess:false` contract; UI: guest header. Redirect part moved to TS-AUTHZ-06 (section 6) | D-UI | T-0 | R-SYNC | M-LOW |
| TS-AUTH-07 | P1 | PR-07, TR-09 | 401 → one refresh → retry | SYS | ST, EH | P | UI (+INT controlled) | AUTOMATE — UI | **Client** retry logic testable now by answering the first protected call with 401; **server** expiry deferred to D-TOK | D-UI, D-RC; later D-TOK | T-U | R-SYNC | M-FIX |
| TS-AUTH-08 | P1 | PR-07, TR-09 | Failed refresh → clean logout | SYS | ST, EH | P | UI (+INT controlled) | AUTOMATE — UI | As above: 401 followed by a failing refresh response, controlled in the browser; real expiry deferred | D-UI, D-RC; later D-TOK | T-U | R-SYNC | M-FIX |
| TS-AUTH-09 | P1 | PR-07 | Refresh re-issues the token | CI | ST, SEC | P | API | AUTOMATE — API | Re-issue (same user, renewed 7-day expiry) automatable now; reuse of an old token waits for a decision (U-2.4). Rule clarified 2026-10-05: a different value per call is not required (A-9) | D-API | T-U | — | M-DEC |
| TS-AUTH-10 | P2 | PR-09 | Logout lands on `/` | SYS | ST | Y | UI | AUTOMATE — UI | Navigation is the requirement; known defect | D-UI | T-U | R-SYNC (guard redirect race) | M-KD |
| TS-AUTH-11 | P2 | PR-09 | Logout clears the session | CI+SYS | ST, SEC | Y | API, UI | AUTOMATE — MULTI-LAYER | API: cookie deletion + message; UI: guest after reload | D-UI | T-U | — | M-TXT |

### 3.3 Authorization and gating

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-AUTHZ-01 | P2 | PR-10 | Service key enforced | CI | SEC, N | Y | API | AUTOMATE — API | Data-driven over endpoints; fast | D-API | T-0 | — | M-LOW |
| TS-AUTHZ-02 | P2 | PR-10 | Bearer enforcement | CI | SEC, N | Y | API | AUTOMATE — API | Many endpoint × token combinations; API only | D-API | T-0 | — | M-LOW |
| TS-AUTHZ-03 | P2 | PR-10 | Guest sidebar Favorites → modal | SYS | F, SEC | Y | UI | AUTOMATE — UI | Client gating | D-UI | T-0 | — | M-LOC |
| TS-AUTHZ-04 | P2 | PR-10 | Guest heart / rate → modal, no call | SYS | SEC, N | Y | UI | AUTOMATE — UI | Client gating + absence of API call; needs the player bar | D-UI, D-S3 | T-CAT | R-AUD, R-DUP | M-LOC |
| TS-AUTHZ-05 | P2 | PR-10 | Modal close options, scroll lock | SYS | F | Y | UI | AUTOMATE — UI | Deterministic UI behavior | D-UI | T-0 | — | M-LOC |
| TS-AUTHZ-06 | P2 | PR-10 | Protected routes | SYS | SEC, ST | Y | UI | AUTOMATE — UI | Routing guard is client-side | D-UI | T-U | R-SYNC (redirect after refresh) | M-LOW |
| TS-PROF-01 | P1 | PR-01 | Own profile readable | CI | F, SEC | Y | API | AUTOMATE — API | No UI exists; endpoint assumed `auth/me` (A-Q16). The 401 case is covered by TS-AUTHZ-02 (section 6) | D-API | T-U | — | M-DEC |
| TS-PROF-02 | P1 | PR-01 | No cross-user read | SYS | SEC | Y | API | AUTOMATE — API | Pure authorization rule; known defect | D-API | T-U2 | — | M-KD, M-DEC (status) |

### 3.4 Discovery

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-DISC-01 | P3 | PR-21 | Home sections, limits, links | SYS | F, B | Y | UI | AUTOMATE — UI | Rendering and navigation; limits checked as "at most" | D-UI | T-CAT | R-TIME (popular data may be empty: guard and skip) | M-LOC |
| TS-DISC-02 | P2 | PR-21, PR-15 | 7-day popularity order | SYS | DI | N | API, DATA | DEFER | No oracle without seeded streams; stream counts are not exposed by the API | D-WR | T-SEED | R-TIME, R-SHR | M-FIX |
| TS-DISC-03 | P3 | PR-21 | Empty states | SYS | EH | Y | UI (+controlled API) | AUTOMATE — UI | Empty data can only be produced deterministically by answering the popular endpoints with empty or failing responses | D-UI, D-RC | T-FIX | — | M-FIX |
| TS-DISC-04 | P3 | PR-21 | Genres sections | SYS | F, B | Y | UI | AUTOMATE — UI | Rendering | D-UI | T-CAT | R-TIME | M-LOC |
| TS-DISC-05 | P3 | PR-21 | Category content and paging | SYS | F, B | Y | UI | AUTOMATE — UI | Paging UX (URL unchanged, disabled Previous); page request observed as a network signal | D-UI | T-CAT | R-SYNC | M-LOC |
| TS-DISC-06 | P3 | PR-21 | Ordering by streams, artist placement | SYS | DI | N | API, DATA | DEFER | No oracle without stream totals or database access | D-WR | T-SEED | R-TIME | M-FIX |
| TS-DISC-07 | P2 | PR-14 | Unknown category | CI+SYS | N, EH | Y | API, UI | AUTOMATE — MULTI-LAYER | Status is an API contract; visible message is UI. Part of the shared not-found test (section 6) | D-UI | T-UNK | — | M-KD |
| TS-DISC-08 | P3 | PR-21 | Charts structure | SYS | F | Y | UI | AUTOMATE — UI | Merged with TS-DISC-09 into one page test (section 6) | D-UI | T-CAT | R-SYNC (content swap after URL change) | M-LOC |
| TS-DISC-09 | P3 | - | Chart links | SYS | F | Y | UI | AUTOMATE — UI | Merged with TS-DISC-08 | D-UI | T-CAT | R-SYNC | M-LOC |
| TS-DISC-10 | P3 | - | Artist page and Play | SYS | F | P | UI | AUTOMATE — UI | Content, paging and Play automatable; "no main genre" case waits for data | D-UI, D-S3 | T-CAT, T-GAP | R-AUD | M-LOC |
| TS-DISC-11 | P3 | - | Favorite state on artist lists | SYS | F | Y | UI | AUTOMATE — UI | User-specific rendering; API only for setup | D-UI | T-U, T-FAV | R-SYNC (reload race like F-5) | M-LOC |
| TS-DISC-12 | P2 | PR-14 | Unknown artist | CI+SYS | N, EH | Y | API, UI | AUTOMATE — MULTI-LAYER | As TS-DISC-07 | D-UI | T-UNK | — | M-KD |

### 3.5 Search

Search UI scenarios run against **controlled** search responses. Server-side and real-result scenarios (TS-SRCH-07, TS-SRCH-08) run against the real index, available since the key renewal on 2026-10-08 (TR-05).

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-SRCH-01 | P2 | PR-16 | Threshold and debounce | SYS | B, F | Y | UI | AUTOMATE — UI | Request timing is a client behavior | D-UI, D-RC | T-FIX | R-SYNC (assert request count after the input settles) | M-LOW |
| TS-SRCH-02 | P2 | PR-16 | Suggestion states | SYS | F, EH | Y | UI | AUTOMATE — UI | Loading, results and empty states need controlled responses | D-UI, D-RC | T-FIX | R-SYNC (150 ms blur close) | M-FIX |
| TS-SRCH-03 | P2 | PR-16 | Navigation from search | SYS | F | Y | UI | AUTOMATE — UI | Navigation is the requirement | D-UI, D-RC | T-FIX | — | M-LOC |
| TS-SRCH-04 | P2 | PR-16 | Results tabs and limits | SYS | F, B | Y | UI | AUTOMATE — UI | Rendering of grouped results | D-UI, D-RC | T-FIX | — | M-FIX |
| TS-SRCH-05 | P2 | PR-16 | No results message | SYS | N | Y | UI | AUTOMATE — UI | Can run today; controlled empty response so it stays deterministic after the key renewal | D-UI, D-RC | T-FIX | — | M-LOW |
| TS-SRCH-06 | P2 | PR-16 | Clear button | SYS | F | Y | UI | AUTOMATE — UI | Cheap | D-UI, D-RC | T-FIX | — | M-LOC |
| TS-SRCH-07 | P2 | PR-16 | Size raised to 10 | CI | B, CON | Y | API | AUTOMATE — API | Server clamp; needs a keyword with more than 10 real matches | D-API, D-ES | Known titles | R-3P (index state) | M-LOW |
| TS-SRCH-08 | P2 | PR-16, TR-05 | Real search results | SIT | F, CON | Y | API, UI, INT | AUTOMATE — INTEGRATION | Nightly integration against the real index; preflight search for a known title, failure classified as environment | D-UI, D-ES | Known titles | R-3P | M-FIX |
| TS-SRCH-09 | P3 | PR-26 | Missing keyword | CI | ROB | N | API | EXPLORATORY | Expected result not agreed; probe and record | D-API | T-0 | — | M-DEC |

**Contract for controlled search responses:** the real item shape was observed on 2026-10-08 (`B:search.md` §2). Build fixtures from those responses, not only from the repository DTOs, and keep TS-SRCH-08 as the check that they still match. Note that `total` is the number of items in the response, not the number of hits. A wrong fixture would make the UI tests pass against a contract that does not exist.

### 3.6 Song details, download and player

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-SONG-01 | P1 | PR-08 | Song page content | SYS | F, DI | Y | UI, API | AUTOMATE — MULTI-LAYER | UI content compared with the detail response (UI/API consistency); absence of a favorite request on the page heart | D-UI | T-CAT | R-SYNC | M-LOC |
| TS-SONG-02 | P2 | PR-14 | Unknown song | CI+SYS | N, EH | Y | API, UI | AUTOMATE — MULTI-LAYER | Part of the shared not-found test | D-UI | T-UNK | — | M-LOW |
| TS-SONG-03 | P3 | - | Lyrics display | SYS | F | P | UI | AUTOMATE — UI | Lyrics with Show More now; "no lyrics" waits for a song without lyrics | D-UI, D-S3 | T-CAT, T-GAP | — | M-LOC |
| TS-SONG-04 | P3 | - | Lyric highlight follows playback | SYS | F | N | MAN | MANUAL | Tied to the real audio clock; high flake risk and maintenance for a low-risk visual behavior. Checked during acceptance | D-S3 | T-CAT | R-AUD | - |
| TS-SONG-05 | P3 | - | Other songs list | SYS | F, B | Y | UI | AUTOMATE — UI | Rendering limits | D-UI | T-CAT | — | M-LOC |
| TS-SONG-06 | P2 | PR-12 | Heart/star after reload | SYS | ST, DI | P | UI, API | AUTOMATE — MULTI-LAYER | Favorite half now (reversible); review half needs D-WR. `/player` is the oracle | D-UI; D-WR for review | T-U, T-FAV, T-REV | R-SYNC (the defect itself is a race) | M-KD |
| TS-SONG-07 | P3 | PR-23 | Lyric fetch failure | SIT | EH, ROB | Y | UI, INT | AUTOMATE — INTEGRATION | Abort the LRC request; only way to produce the failure | D-UI, D-RC | T-CAT | — | M-DEC (message open) |
| TS-DL-01 | P3 | - | Download file name | SYS | F | Y | UI | AUTOMATE — UI | Browser download event gives the suggested file name | D-UI, D-S3 | T-CAT | R-3P (S3) | M-LOW |
| TS-DL-02 | P3 | PR-23 | Download failure toast | SIT | EH | Y | UI, INT | AUTOMATE — INTEGRATION | Fail the MP3 fetch in the browser | D-UI, D-RC | T-CAT | — | M-TXT |
| TS-PLAY-01 | P1 | PR-08 | Start playback | SYS | F | Y | UI | AUTOMATE — UI | Core user interaction; audio position polled | D-UI, D-S3 | T-CAT, T-U | R-AUD | M-LOC |
| TS-PLAY-02 | P1 | PR-08 | Pause / resume | SYS | ST | Y | UI | AUTOMATE — UI | Player state | D-UI, D-S3 | T-CAT | R-AUD, R-DUP | M-LOC |
| TS-PLAY-03 | P1 | PR-08 | Next / previous / refill | SYS | ST, B | Y | UI (+API signal) | AUTOMATE — UI | Song change asserted by the player request; refill by the `next-batch` request | D-UI, D-S3 | T-CAT | R-RAND, R-DUP | M-LOC |
| TS-PLAY-04 | P1 | PR-08 | Repeat modes | SYS | ST | P | UI | AUTOMATE — UI | State cycle now; end-of-song behavior needs the position moved near the end through the audio element (seek UI is open, AC-10) | D-UI, D-S3 | T-CAT | R-AUD | M-LOC |
| TS-PLAY-05 | P1 | PR-08 | Shuffle | SYS | ST | Y | UI | AUTOMATE — UI | Queue order; use a known queue (favorites playlist) | D-UI, D-S3 | T-U, T-FAV | R-RAND (use a long queue) | M-LOC |
| TS-PLAY-06 | P1 | PR-08 | Volume and mute | SYS | F, ST | Y | UI | AUTOMATE — UI | Deterministic; read volume from the audio element | D-UI, D-S3 | T-CAT | — | M-LOC |
| TS-PLAY-07 | P1 | PR-08 | Auto-advance | SYS | ST | Y | UI | AUTOMATE — UI | Shares the near-end helper with TS-PLAY-04 | D-UI, D-S3 | T-CAT | R-AUD | M-LOC |
| TS-PLAY-08 | P1 | PR-08, TR-03 | One click = one action | SYS | ROB | Y | UI (+API signal) | AUTOMATE — UI | Count of player / toggle requests per click. Also an exploratory comparison on a production build | D-UI, D-S3 | T-U | R-DUP (StrictMode doubles GETs: count only POSTs and distinct song changes) | M-LOC |
| TS-PLAY-09 | P3 | - | Title shortening and link | SYS | B | Y | UI | AUTOMATE — UI | Boundary; titles at 25/26 chars to be found through the API | D-UI, D-S3 | T-GAP | — | M-LOC |
| TS-PLAY-10 | P1 | PR-08 | MP3 failure | SIT | EH, ROB | N | UI, INT | DEFER | Expected behavior not agreed (A-Q18); automation is easy once decided | D-DEC(A-Q18) | T-CAT | — | M-DEC |

### 3.7 Favorites

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-FAV-01 | P2 | PR-13 | Toggle updates state and counts | SYS | ST, DI | Y | UI, API, DATA | AUTOMATE — MULTI-LAYER | UI heart and counters vs API response vs `/player` read-back: the risk is inconsistency between them | D-UI, D-S3 | T-U | R-SHR (delta), R-DUP | M-KD |
| TS-FAV-02 | P3 | PR-19 | Rapid clicks in flight | SYS | ROB, ST | Y | UI | AUTOMATE — UI | Delay the toggle response to make the in-flight window deterministic | D-UI, D-RC, D-S3 | T-U | R-DUP | M-LOC |
| TS-FAV-03 | P3 | PR-19 | Cache cleared on change | SYS | ST | Y | UI | AUTOMATE — UI | Cache is client-side; only visible in the UI | D-UI, D-S3 | T-U | R-TIME | M-LOW |
| TS-FAV-04 | P3 | PR-19 | Re-toggle reuses the record | CI | DI | Y | API, DATA | AUTOMATE — API | Repeated toggles and counts; no UI value | D-API | T-U | R-SHR (delta) | M-LOW |
| TS-FAV-05 | P3 | - | Favorite only in the player bar | SYS | F | N | MAN | MANUAL | "No control anywhere" is a weak automated oracle (absence of an unknown element); a short visual check is more reliable | - | - | - | - |
| TS-FAV-06 | P3 | PR-19 | Unknown song favorite | CI | N | Y | API | AUTOMATE — API | Assert error status family and no favorite; exact code pending | D-API | T-U, T-UNK | — | M-DEC |
| TS-FAV-07 | P3 | PR-19 | Favorites list and featured-artist line | SYS | F, DI | Y | UI | AUTOMATE — UI | Calculated text depends on data combos set up cheaply through the API | D-UI | T-U, T-FAV | — | M-LOC |
| TS-FAV-08 | P3 | - | Empty favorites | SYS | F | Y | UI | AUTOMATE — UI | Cheap | D-UI | T-U | — | M-LOW |
| TS-FAV-09 | P3 | - | Play All | SYS | F, ST | Y | UI | AUTOMATE — UI | Player integration with the playlist | D-UI, D-S3 | T-U, T-FAV | R-AUD | M-LOC |
| TS-FAV-10 | P3 | - | Drag reorder is client-only | SYS | F | N | MAN | MANUAL | Drag-and-drop library simulation is flaky and expensive for a P3, intended-as-is behavior | - | T-U, T-FAV | - | - |
| TS-FAV-11 | P3 | - | Show more, playlist download | SYS | F | P | UI, MAN | AUTOMATE — UI | Show more automated; multi-file download timing checked manually | D-UI | T-U, T-FAV | — | M-LOC |

### 3.8 Rating and review

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-REV-01 | P1 | PR-03 | Form before rating | SYS | V, B | Y | UI | AUTOMATE — UI | Client rule; no submit, no write | D-UI, D-S3 | T-U | R-LOC (unlabeled stars, Vietnamese modal) | M-LOC, M-TXT |
| TS-REV-02 | P1 | PR-02 | Submit a review | SYS | F, DI | P | UI, API, DATA | AUTOMATE — MULTI-LAYER | **UI half now:** submit answered in the browser (message, prepend, count). **Persistence half** (review in the API list) deferred to D-WR | D-UI, D-RC; later D-WR | T-U; later T-REV | — | M-TXT |
| TS-REV-03 | P3 | - | Empty comment placeholder | SYS | F | Y | UI | AUTOMATE — UI | The placeholder is set by the client: assert the request body, answer it in the browser, no write | D-UI, D-RC | T-U | — | M-TXT |
| TS-REV-04 | P1 | PR-02 | Rated state | SYS | ST | P | UI | AUTOMATE — UI | Rendering from `isReviewed:true` testable with a controlled `/player` response; the real flag after a real review deferred to D-WR | D-UI, D-RC; later D-WR | T-U | — | M-FIX |
| TS-REV-05 | P3 | PR-24 | List format and order | SYS | F | Y | UI | AUTOMATE — UI | New-review date is client-built (controlled submit); order from existing reviews of song 1 (read-only) | D-UI, D-RC | T-CAT | — | M-KD |
| TS-REV-06 | P3 | PR-23 | Submit failure message | SYS | EH | Y | UI | AUTOMATE — UI | Failure produced in the browser | D-UI, D-RC | T-U | — | M-TXT |
| TS-REV-07 | P1 | PR-02 | Server refuses second review | SYS | DI, N | N | API, DATA | DEFER | Writes permanent reviews; automation is simple once D-WR exists | D-WR, D-DEC(A-Q15) | T-REV | — | M-KD, M-DEC |
| TS-REV-08 | P1 | PR-03 | Server rating range | SYS | B, DI | N | API, DATA | DEFER | Five permanent reviews per run; D-WR | D-WR, D-DEC(A-Q15) | T-REV ×5 | — | M-KD, M-DEC |
| TS-REV-09 | P3 | - | Empty list and closing | SYS | F | N | UI | EXPLORATORY | Expected behavior open (AC-08) | D-UI | T-GAP | — | M-DEC |

### 3.9 Listening statistics

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-STRM-01 | P2 | PR-15 | One stream after ≥ 20 s | SYS | B, DI | P | UI (+API signal) | AUTOMATE — UI | The 20-second trigger is client-side: capture the stream request and answer it in the browser (no permanent row). Server recording deferred to D-WR | D-UI, D-S3, D-RC; later D-WR | T-U | R-SLOW, R-AUD | M-LOW |
| TS-STRM-02 | P2 | PR-15 | Guest records no stream | SYS | N, SEC | Y | UI | AUTOMATE — UI | Absence of the request after 20 s of guest playback | D-UI, D-S3 | T-CAT | R-SLOW, R-AUD | M-LOW |
| TS-STRM-03 | P2 | PR-15 | Replay, repeat, seek | SYS | ST | N | UI | EXPLORATORY | Expected result unknown (U-1.7); explore with the request intercepted (safe), then automate | D-UI, D-S3, D-RC | T-U | R-SLOW | M-DEC |
| TS-STRM-04 | P3 | - | Active-user heartbeat | CI | F | Y | API | AUTOMATE — API | API only; no UI exists | D-API | T-U | R-SHR (assert "at least one") | M-LOW |

### 3.10 Language, theme, navigation

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-L10N-01 | P3 | PR-25 | Switch language | SYS | F | Y | UI | AUTOMATE — UI | `<html lang>` and a few anchor labels per language; Vietnamese server message check | D-UI | T-0 | R-LOC (this test deliberately changes language) | M-TXT |
| TS-L10N-02 | P3 | PR-25 | Detection, fallback, persistence | SYS | F, ST | Y | UI | AUTOMATE — UI | Browser locale is a context option; persistence through reload | D-UI | T-0 | R-STATE | M-LOW |
| TS-L10N-03 | P3 | PR-25 | Translation completeness | ACC | F | N | MAN | MANUAL | Needs human reviewers per language | - | - | - | - |
| TS-THEME-01 | P3 | PR-25 | Theme switch and persistence | SYS | F, ST | Y | UI (+MAN colors) | AUTOMATE — UI | Stored theme and CSS variables automatable; color correctness manual | D-UI | T-0 | — | M-LOW |
| TS-NAV-01 | P3 | - | Layout, highlight, user menu | SYS | F | Y | UI | AUTOMATE — UI | Cheap structural check | D-UI | T-U | R-LOC | M-LOC |
| TS-NAV-02 | P2 | PR-14 | Unknown route | SYS | N, EH | Y | UI | AUTOMATE — UI | Part of the shared not-found test (UI only; no API involved) | D-UI | T-0 | — | M-KD |

### 3.11 Recommendations

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-REC-01 | P2 | PR-17 | App works with the tracker blocked | SYS | ROB | Y | UI | AUTOMATE — UI | System level; explicit check of no page errors and empty sections | D-UI, D-T0 | T-0 | — | M-LOW |
| TS-REC-02 | P2 | PR-18 | Where recommendations appear | SIT | F | Y | UI, INT | AUTOMATE — INTEGRATION | Mode A: deterministic placement per route | D-TA | T-FIX | R-STATE | M-FIX |
| TS-REC-03 | P2 | PR-18 | Card = item n | SIT | F, CON | Y | UI, INT | AUTOMATE — INTEGRATION | Fixture vs rendered shadow DOM | D-TA | T-FIX | — | M-FIX, M-LOC (3rd-party classes) |
| TS-REC-04 | P2 | PR-18 | Card click → song + Rank | SIT | F, INT | Y | UI, INT | AUTOMATE — INTEGRATION | Navigation + evaluation request; parameterized first/middle/last × inline/popup | D-TA | T-FIX (real catalog ids) | — | M-FIX |
| TS-REC-05 | P2 | PR-17 | Popup close, persistence | SIT | F | Y | UI, INT | AUTOMATE — INTEGRATION | Mode A | D-TA | T-FIX | — | M-LOC |
| TS-REC-06 | P2 | PR-17 | Failed / empty response | SIT | EH, ROB | Y | UI, INT | AUTOMATE — INTEGRATION | Fault injection; clear the per-tab cache first | D-TA | T-FIX | R-STATE (session cache) | M-FIX |
| TS-REC-07 | P2 | PR-17 | Unconfirmed failure classes | SIT | ROB | P | UI, INT | AUTOMATE — INTEGRATION | Minimum ("page usable") now; detailed expectations after A-Q5 | D-TA, D-DEC(A-Q5) | T-FIX | — | M-DEC |
| TS-REC-08 | P2 | PR-17 | Core features usable | SIT | ROB | P | UI, INT | AUTOMATE — INTEGRATION | Failure cases now; popup-open case after A-Q6 | D-TA, D-S3, D-DEC(A-Q6) | T-U, T-FIX | R-AUD | M-DEC |
| TS-REC-09 | P1 | PR-04 | Nothing before consent | SIT | PRIV | P | INT | AUTOMATE — INTEGRATION | Identity and behavior assertions now; "anonymous request allowed?" after A-Q1. Known defect | D-TB, D-DEC(A-Q1) | T-U | R-3P | M-KD, M-DEC |
| TS-REC-10 | P1 | PR-05 | Decline respected | SIT | PRIV | Y | UI, INT | AUTOMATE — INTEGRATION | Real tracker and real banner required (consent logic is third-party code). Known defect | D-TB | T-U | R-3P, R-STATE | M-KD |
| TS-REC-11 | P3 | PR-20 | Event per card type | SIT | INT, CON | Y | INT | AUTOMATE — INTEGRATION | Mode A for app-side wiring (cheap, frequent); Mode B variant shares the capture session of TS-REC-14 (section 6) | D-TA; D-TB | T-U, T-CAT | R-3P (Mode B) | M-FIX, M-LOC (rule selectors) |
| TS-REC-12 | P1 | PR-06 | No behavior without interaction | SIT | PRIV | Y | INT | AUTOMATE — INTEGRATION | Absence of events over a scripted browse | D-TB | T-0 | R-3P | M-LOW |
| TS-REC-13 | P1 | PR-06 | Rating, review, search tracking | SIT | PRIV | P | INT | AUTOMATE — INTEGRATION | Keyword part now; rating/review events need D-WR and A-Q3 | D-TB; later D-WR, D-DEC(A-Q3) | T-U, T-CAN; later T-REV | R-3P | M-DEC |
| TS-REC-14 | P1 | PR-06 | Only approved data sent | SIT+ACC | PRIV, SEC | Y | INT (+MAN approval) | AUTOMATE — INTEGRATION | Canary and allowlist detection is automated; approving fields is manual (`levels/acceptance.md` §4) | D-TB, D-DEC(A-Q2) | T-CAN | R-3P | M-FIX (allowlist) |
| TS-REC-15 | P1 | PR-06, TR-11 | Config drift | SIT | CON | Y | API (tracker), INT | AUTOMATE — INTEGRATION | Direct requests to the tracker configuration; no browser needed | D-TB | Snapshot | R-3P | M-FIX |
| TS-REC-16 | P2 | PR-18, TR-11 | Real service end to end | SIT | INT, CON | Y | API, UI, E2E | AUTOMATE — E2E | One real journey + contract check; nightly only | D-TB | T-0 | R-3P (preflight) | M-FIX |

### 3.12 Cross-cutting and journeys

| ID | P | Risk | Objective | Level | Type | Cand. | Layers | Classification | Reason | Deps | Data | Rel. | Maint. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TS-API-01 | P3 | - | Paged list shape | CI | CON | Y | API | AUTOMATE — API | Schema check over paged endpoints | D-API | T-CAT | — | M-LOW |
| TS-API-02 | P3 | PR-26 | Invalid paging values | CI | ROB | N | API | EXPLORATORY | Expected result not agreed | D-API | T-0 | — | M-DEC |
| TS-E2E-01 | P1 | PR-08 | Guest discovers and plays | SYS | F | Y | E2E | AUTOMATE — E2E | Critical guest journey; smoke candidate | D-UI, D-S3 | T-CAT | R-AUD, R-SYNC | M-LOC |
| TS-E2E-02 | P1 | PR-07, PR-08, PR-09 | Member listens, favorites, logs out | SYS | F, ST | Y | E2E | AUTOMATE — E2E | Critical member journey. Landing page after logout is asserted only in TS-AUTH-10 (section 6) | D-UI, D-S3 | T-U | R-AUD, R-SYNC, R-SHR | M-LOC |

---

## 4. UI vs API analysis

### 4.1 Decided for API (no UI automation)

| Scenarios | Why the UI adds little |
|---|---|
| TS-AUTHZ-01, TS-AUTHZ-02 | Access control is enforced by the server; many endpoint × credential combinations |
| TS-PROF-01, TS-PROF-02 | No profile UI exists; the risk is server authorization |
| TS-REG-03, TS-REG-05, TS-REG-06 | Server rules and response content; the UI path is blocked by the email check |
| TS-AUTH-09 | Cookie re-issue is invisible in the UI |
| TS-FAV-04, TS-FAV-06 | Record reuse and invalid ids are server behavior; repeated toggles are cheaper through the API |
| TS-STRM-04 | No UI exists |
| TS-API-01 | Contract shape |
| TS-REV-07, TS-REV-08 (deferred), TS-SRCH-07 | Server rules; the UI cannot even reach a second review, and the page-size clamp is invisible in the UI |

### 4.2 Decided for UI although an API exists

| Scenarios | Why the UI is needed |
|---|---|
| TS-AUTH-05, TS-AUTH-07, TS-AUTH-08 | Session restore and retry are SPA logic (in-memory token, axios interceptor) |
| TS-AUTHZ-03 to 06 | Gating and redirects are client-side guards |
| TS-SRCH-01 to 06 | Debounce, thresholds and rendering are client logic; responses are controlled |
| TS-REV-03, TS-REV-05 | Placeholder comment and new-review date are produced by the client |
| TS-STRM-01, TS-STRM-02 | The 20-second rule and guest check are triggered by the player in the browser |
| TS-FAV-03 | The favorites cache lives in the client |

### 4.3 Multi-layer because the risk is the consistency between layers

TS-AUTH-01, TS-AUTH-03, TS-AUTH-06, TS-AUTH-11, TS-DISC-07, TS-DISC-12, TS-SONG-01, TS-SONG-02, TS-SONG-06, TS-FAV-01, TS-REV-02. For each, the API assertion and the UI assertion check different things: the contract or state on one side, the display or navigation on the other. They are one test with two assertion sets, not two tests.

### 4.4 Integration because the external interaction is the risk

All recommendation scenarios except TS-REC-01, plus TS-SONG-07, TS-DL-02 (S3 failures) TS-SRCH-08 and, later, TS-REG-04, TS-REG-08 and TS-PLAY-10.

---

## 5. Manual and exploratory candidates

### 5.1 Manual

| Scenario | Reason | When |
|---|---|---|
| TS-SONG-04 | Visual sync with the audio clock; low risk; flaky to automate | Acceptance checklist, per release |
| TS-FAV-05 | Absence of a control is better judged visually | Per release |
| TS-FAV-10 | Drag-and-drop simulation flaky; intended behavior; P3 | Per release |
| TS-L10N-03 | Human language review | When translations change |
| TS-FAV-11 (download part), TS-THEME-01 (colors) | Multi-file download timing; color correctness | Per release |

### 5.2 Exploratory

| Scenario / charter | Goal | Next step |
|---|---|---|
| TS-REG-07 | Username > 30 behavior | Record → decision → API test |
| TS-SRCH-09, TS-API-02 | Invalid parameters | Record → decision → API tests |
| TS-REV-09 | Empty review list text, close options | Record → decision → UI test |
| TS-STRM-03 | Replay / repeat / seek stream rules (safe with the stream request intercepted) | Record → decision → UI test |
| Charter: other endpoints exposing another user's data | PR-01 follow-up | Add cases to TS-PROF-02 |
| Charter: multiple tabs, concurrent refresh, token reuse | PR-07 | Feed TS-AUTH-09 |
| Charter: production build vs dev build (duplicate requests, duplicate controls) | TR-13, TS-PLAY-08 | Adjust locators and call assumptions |
| Charter: recsys on `/search` and logged-in `/favorites`; sign-up and logout privacy capture | PR-04 to PR-06 | Extend TS-REC-02, TS-REC-14 |
| Charter: real search after the key renewal | Contract of search items | Validate search fixtures (section 3.5 warning) |

---

## 6. Duplicate and overlapping coverage

| # | Overlap | Unique confidence per level? | Recommendation |
|---|---|---|---|
| 1 | Not-found: TS-DISC-07, TS-DISC-12, TS-SONG-02 (API status + UI message), TS-NAV-02 (UI) | Yes: status is a contract, the message is UX | **Merge into one data-driven API test** (category, artist, song) **and one data-driven UI test** (category, artist, song, route). Keep the four scenario ids as data rows for traceability |
| 2 | Guest redirect: TS-AUTH-06 (UI part) and TS-AUTHZ-06 | No: same guard, same assertion | **Reduce**: TS-AUTH-06 keeps the refresh contract and guest header; the redirect lives in TS-AUTHZ-06 |
| 3 | 401 for `auth/me`: TS-PROF-01 and TS-AUTHZ-02 | No | **Reduce**: TS-AUTHZ-02 owns all 401 cases; TS-PROF-01 keeps the own-profile read |
| 4 | Logout landing: TS-AUTH-10 and TS-E2E-02 | Partly: E2E proves the journey, not the landing rule | **Keep both, split assertions**: E2E-02 asserts "signed out"; only TS-AUTH-10 asserts `/` (and carries the known-defect annotation), so the journey does not fail permanently on a known defect |
| 5 | Password never returned: TS-REG-06 and the auth contract tests | Yes as a sweep | **Keep** TS-REG-06 as the dedicated sweep; other tests reuse the same assertion helper, no separate scenarios |
| 6 | Favorite toggle: TS-FAV-01 (UI + API), TS-FAV-04 (API repeat), TS-PLAY-08 (single toggle per click), TS-E2E-02 (step) | Yes: consistency / record reuse / duplicated controls / journey | **Keep**; E2E-02 asserts only the playlist outcome |
| 7 | Review uniqueness: TS-REV-04 (UI rated state) and TS-REV-07 (server) | Yes: UI prevention vs server enforcement are different risks | **Keep** |
| 8 | Start playback: TS-PLAY-01, TS-E2E-01, setup of many player tests | Partly | **Keep**: E2E-01 in smoke (guest journey); PLAY-01 in critical regression for the member variant and the player bar details |
| 9 | Charts: TS-DISC-08 and TS-DISC-09 | Same page and setup | **Merge** into one test with two assertion groups |
| 10 | Card click: TS-REC-04 (Mode A, all positions) and TS-REC-16 (Mode B, one card) | Yes: determinism vs real contract | **Keep**; REC-16 clicks one card only |
| 11 | Mode B captures: TS-REC-11 (Mode B variant), TS-REC-12, TS-REC-14 | Same interactions, different assertions | **Merge execution**: one capture session per consent state, several assertion sets (events, absence, allowlist, canaries). Keep separate result entries per scenario id |
| 12 | Tracker absence: TS-REC-01 and every system test running with the tracker blocked | Partly: other tests do not assert page errors or the empty heading | **Keep** TS-REC-01 small |
| 13 | Session after login: TS-AUTH-01 (UI) and TS-AUTH-05 | Different transitions (login vs reload) | **Keep** |

No overlap was removed only to reduce the count. Merges 1, 9 and 11 reduce execution cost while every scenario id keeps its own result.

---

## 7. Automation value

H = high, M = medium, L = low. Groups contain the automated scenarios of section 3.

| Group | Scenarios | Frequency | Criticality | Repeatability | Stability | Maintenance cost | Speed | Data setup cost | Env dependency | Diagnosability | Regression value |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API contracts and security | AUTHZ-01/02, PROF-01/02, REG-03/05/06, AUTH-09, FAV-04/06, STRM-04, API-01 | Every PR | H | H | H | L | H | L | API only | H | H |
| Auth UI and session | AUTH-01 to 08, 10, 11 | Every PR (subset) | H | H | M (async restore) | M | M | L | UI | M | H |
| Gating | AUTHZ-03 to 06 | Every PR | H | H | H | M (locators) | H | L | UI | H | H |
| Not-found (merged) | DISC-07/12, SONG-02, NAV-02 | Every merge | M | H | H | L | H | L | UI | H | M |
| Player | PLAY-01 to 09, E2E-01 | Smoke (01) / merge | H | M | M (audio, duplicated controls) | H (no labels) | L | L | UI + S3 | M | H |
| Favorites | FAV-01/02/03/07/08/09/11 | Merge | M | H | M (shared counters) | M | M | L (API setup) | UI + S3 | M | M |
| Review UI (controlled) | REV-01/02(UI)/03/04/05/06 | Merge | H (P1 for 01/02/04) | H | H | M (Vietnamese modal) | M | L | UI | H | M |
| Stream UI (controlled) | STRM-01/02 | Nightly | M | H | M | L | **L** (≥ 20 s each) | L | UI + S3 | H | M |
| Discovery | DISC-01/03/04/05/08/09/10/11 | Nightly | L-M | M (data dependent) | M (popular data) | M | M | L | UI | M | M |
| Search UI (controlled) | SRCH-01 to 06 | Nightly; every PR touching search | M | H | H | M (fixtures not validated) | H | L | UI | H | M |
| Song / lyrics / download | SONG-01/03/05/06/07, DL-01/02 | Merge / nightly | M | H | H | M | M | L | UI + S3 | H | M |
| Language / theme / nav | L10N-01/02, THEME-01, NAV-01 | Nightly | L | H | H | L | H | L | UI | H | L |
| Recsys Mode A | REC-02 to 08, REC-11 (A) | Own job on app change, nightly | M | H | M (spike pending) | M (fixtures, 3rd-party classes) | M | M (fixtures) | UI + fixtures | H | M |
| Recsys Mode B privacy / contract | REC-09/10/12/13/14/15, REC-11 (B) | Nightly | **H** (Critical) | M | L-M (free-tier host) | M | L | M (canary user) | Real 3rd party | M (preflight helps) | H |
| Journeys | E2E-01/02, REC-16 | Smoke / nightly | H | M | M | M | L | L | UI + S3 (+ 3rd party for REC-16) | M | H |

Low-value candidates kept automated because they are cheap and stable: TS-AUTH-04, TS-FAV-08, TS-NAV-01, TS-THEME-01. They can be dropped first if the nightly run grows too long.

---

## 8. Reliability analysis

| Risk | Affected scenarios | Mitigation (high level) |
|---|---|---|
| **Async session restore** (refresh fires twice; user-specific flags wrong on hard reload) | AUTH-01/05/06/10, AUTHZ-06, SONG-06, DISC-11, E2E-02 | Wait for the signed-in signal or the refresh response; never a fixed delay; prefer in-app navigation except where the reload is the subject |
| **Route content swap** (old page content for 1-2 s) | DISC-05/08/09, E2E-01 | Wait on a page-specific heading or the page's API response, not on the URL |
| **Duplicate requests in the dev build** | All request-capture assertions | Assert "at least one" for GETs; count only POSTs or distinct effects; re-check on a production build |
| **Duplicated player controls** | PLAY-*, AUTHZ-04, FAV-01/02, REV-01 | Scope every player locator to the player wrapper; count actions by effect (requests, song change) |
| **Audio buffering, real time** | PLAY-*, STRM-01/02, FAV-09, E2E-* | Poll the audio position; near-end helper instead of waiting for whole songs; long tests nightly only |
| **Randomness** | PLAY-03/05 | Assert invariants (song changed, refill request, current song first); known queues from favorites |
| **Shared counters** | FAV-01/04, STRM-04 | Delta assertions; no parallel tests on the same song counter; use different songs per worker |
| **Popular data / caches** | DISC-01/04/08 | Data-presence guard that skips with "environment has no popular data"; fresh context per test |
| **Third-party availability** | REC Mode B, REC-16, SRCH-08, DL-01, all S3 playback | Tracker blocked outside SIT; preflight + classification for Mode B; S3 failures classified as availability |
| **Third-party DOM** (shadow DOM, popup) | REC-02 to 08 | One component object for all `recsys-*` locators; close or block the popup |
| **State leakage** (recsys identity, consent, language, theme, cache) | REC-*, L10N-*, THEME-01 | Fresh context per test; clear `localStorage`, `sessionStorage`, IndexedDB; pin language unless it is the subject |
| **Test data collisions** | Every test creating users | Run-unique names with worker id; no shared accounts except one read-only smoke account |
| **Order dependence** | REV-04 (needs a prior review) | Create the precondition inside the test (controlled response now, API setup later); no test relies on another test |
| **Environment instability** (shared remote DB, no CI environment) | All | Reachability check before the suite; skip with reason; nothing writes permanent data outside `@write-permanent` |
| **Controlled responses drift from the real contract** | SRCH-01 to 06, DISC-03, REV-02 to 06, AUTH-07/08, REC Mode A | Build fixtures from observed responses; one contract test per fixture source (TS-API-01, TS-REC-15, the first real search) keeps them honest |
| **Language-dependent locators** | All UI | Language pinned to English; Vietnamese server strings asserted literally |

---

## 9. Automation architecture implications

To be designed in Automated Test Design. Nothing is implemented here.

| Component | Purpose | Needed by |
|---|---|---|
| **Environment configuration** | UI and API base URLs, service key, credentials, recsys settings, HTTPS handling; `.env` locally, secrets in CI | All |
| **Playwright projects / tags** | API-only project (no browser), UI Chromium project, SIT controlled, SIT live; tags from `test-strategy.md` §11.2 plus `@write-permanent`, `@known-defect` | All |
| **API clients** | Auth, Song (detail, player, favorites, toggle, stream, search), Catalog (category, artist, popular), Rating, Stats, User; all add the service key | All API and setup |
| **Recsys client** | Tracker configuration and health requests for preflight and drift | REC-15, REC-16 |
| **Auth helpers** | Create user through the API; sign the browser in without the UI. Option to validate: API login, then put the `RefreshToken` cookie into the browser context so the SPA restores the session. Feasibility not yet verified (HttpOnly, Secure, SameSite=None on `localhost`) | All member UI tests |
| **Test data factories** | Unique user, canary user, favorites set, review payloads, fixture builders (recommendations, search results, popular lists) | Most |
| **Page objects / components** | Auth page, Header (search, language, theme, user menu), Sidebar, Home, Genres, Category, Charts, Artist, Song, Favorites, Not-found, Player bar (scoped to its wrapper), Sign-in modal, Rating modal, Recsys widgets (third-party) | UI |
| **Network utilities** | Tracker blocker (Mode 0); recsys fixture router (Mode A); response control for PSMusic API and S3 (fulfil, abort, delay); request recorder; `sendBeacon` capture | UI, SIT |
| **Privacy assertion utilities** | Allowlist per endpoint, canary search across URL/header/body/beacon, identity check | REC Mode B |
| **Audio utilities** | Poll playback position, move near the end, read volume | Player, streams |
| **Download helper** | Capture the suggested file name | DL-01 |
| **Schema / contract validation** | Paged shape, auth responses, recsys response, snapshot diff | CI tests, REC-15/16 |
| **Guards** | Environment reachable, popular data present, preflight result → skip with reason | All suites |
| **Known-defect mechanism** | Mark tests linked to a defect id; report separately; flag unexpected passes | 13 known-defect scenarios |
| **Reporting** | Allure categories by failure class (`test-strategy.md` §11.3, `levels/system-integration.md` §2.3); redacted network attachments | All |
| **Database helpers** | **Not applicable**: no database access. The API is the data oracle | - |

---

## 10. Deferred automation

### 10.1 Deferred scenarios (no automation now)

| Scenario | P | Blocked by | Target classification once unblocked |
|---|---|---|---|
| TS-REV-07 | P1 | D-WR, A-Q15 | AUTOMATE — API |
| TS-REV-08 | P1 | D-WR, A-Q15 | AUTOMATE — API |
| TS-PLAY-10 | P1 | A-Q18 | AUTOMATE — INTEGRATION |
| TS-DISC-02 | P2 | D-WR (seeded streams) | AUTOMATE — API |
| TS-DISC-06 | P3 | D-WR, no oracle for placement | AUTOMATE — API (partly) |
| TS-REG-04 | P3 | D-EM | AUTOMATE — INTEGRATION |
| TS-REG-08 | P3 | D-EM | AUTOMATE — INTEGRATION |

Exploratory scenarios (section 5.2) become automation candidates once their expected result is decided.

### 10.2 Deferred parts of partial scenarios

| Scenario | Automated now | Deferred part | Blocked by |
|---|---|---|---|
| TS-AUTH-07, TS-AUTH-08 | Client retry / logout with controlled responses | Real token expiry | D-TOK |
| TS-AUTH-09 | Re-issue with renewed expiry | Reuse of old token | Decision (U-2.4) |
| TS-REG-05 | API | UI message display | D-EM |
| TS-REV-02 | UI behavior | Persistence in the review list | D-WR |
| TS-REV-04 | Rendering of the rated state | Real flag after a real review | D-WR |
| TS-STRM-01 | Client trigger at 20 s | Server stream row | D-WR |
| TS-SONG-06 | Favorite icon | Review icon | D-WR |
| TS-SONG-03, TS-DISC-10, TS-PLAY-09 | Main behavior | Cases needing T-GAP data | Catalog search |
| TS-PLAY-04 | State cycle | End-of-song behavior if the near-end helper proves unreliable | Spike |
| TS-REC-07, TS-REC-08 | Minimum assertions | Agreed detailed behavior | A-Q5, A-Q6 |
| TS-REC-09 | Identity and behavior | Anonymous request rule | A-Q1 |
| TS-REC-13 | Search keyword | Rating / review events | D-WR, A-Q3 |
| TS-REC-02 to 08, REC-11 (Mode A) | - | All, until the Mode A spike confirms feasibility | TR-11 |
| TS-FAV-11 | Show more | Playlist download | Manual |

---

## 11. Recommended automation scope

### 11.1 Phases

| Phase | Entry condition | Scope |
|---|---|---|
| **1. Foundation** | SUT reachable locally; config and secrets | Environment config, API clients, user factory, auth helper spike, tracker blocker, storage reset |
| **2. Gate and critical (no blocked dependency)** | Phase 1 | API contracts and security (15 API scenarios); auth and session UI including controlled retry; gating; merged not-found tests; player core; favorites; controlled review UI; journeys |
| **3. Broader regression** | Phase 2 stable | Discovery, search UI (controlled), search against the real index (TS-SRCH-07, TS-SRCH-08), song/lyrics/download, stream client checks (nightly, slow), language, theme, navigation |
| **4. Recommendations** | Mode A spike done; canary user; allowlist draft | Mode A suite, then Mode B privacy and live suites |
| **5. Unblocked items** | D-WR, D-TOK, D-EM, decisions | Section 10 |

### 11.2 Suite placement (proposal for Automated Test Design)

| Suite | Scenarios |
|---|---|
| `@smoke` (app gate, every PR) | TS-AUTHZ-01 (one endpoint), TS-AUTH-01, TS-AUTH-05, TS-AUTHZ-06 (guest part), TS-E2E-01 |
| `@critical` (merge to main) | All P1 and P2 scenarios classified AUTOMATE that use D-UI/D-API only (not D-TA/D-TB), plus known-defect tests |
| `@regression` (nightly) | Remaining AUTOMATE scenarios; slow stream tests |
| `sit-controlled` | TS-SONG-07, TS-DL-02, TS-REC-02 to 08, TS-REC-11 (Mode A) |
| `sit-privacy` / `sit-live` (nightly) | TS-REC-09, 10, 12, 13, 14, 15, 11 (Mode B); TS-REC-16; TS-SRCH-08 (real Elasticsearch) |
| Manual checklist (release) | Section 5.1 |

---

## 12. Traceability

| Scenario | Story / AC | Risk | Classification |
|---|---|---|---|
| TS-REG-01 | US-001-AC-01 | PR-22 | AUTOMATE — UI |
| TS-REG-02 | US-001-AC-02 | PR-22 | AUTOMATE — UI |
| TS-REG-03 | US-001-AC-03, AC-07 | PR-22 | AUTOMATE — API |
| TS-REG-04 | US-001-AC-03, AC-07 | PR-22, TR-06 | DEFER |
| TS-REG-05 | US-001-AC-04, AC-05 | PR-22 | AUTOMATE — API |
| TS-REG-06 | US-001-AC-06, US-023-AC-01 | PR-11 | AUTOMATE — API |
| TS-REG-07 | US-001 rules | PR-22 | EXPLORATORY |
| TS-REG-08 | US-001 rules | PR-22 | DEFER |
| TS-AUTH-01 | US-002-AC-03 | PR-07 | AUTOMATE — MULTI-LAYER |
| TS-AUTH-02 | US-002-AC-01, AC-02 | - | AUTOMATE — UI |
| TS-AUTH-03 | US-002-AC-04, AC-05 | PR-07 | AUTOMATE — MULTI-LAYER |
| TS-AUTH-04 | US-002-AC-06, AC-07 | - | AUTOMATE — UI |
| TS-AUTH-05 | US-003-AC-01 | PR-07 | AUTOMATE — UI |
| TS-AUTH-06 | US-003-AC-02, AC-03 | PR-07 | AUTOMATE — MULTI-LAYER |
| TS-AUTH-07 | US-003-AC-04 | PR-07, TR-09 | AUTOMATE — UI |
| TS-AUTH-08 | US-003-AC-05 | PR-07, TR-09 | AUTOMATE — UI |
| TS-AUTH-09 | US-003 rules | PR-07 | AUTOMATE — API |
| TS-AUTH-10 | US-004-AC-01 | PR-09 | AUTOMATE — UI |
| TS-AUTH-11 | US-004-AC-02, AC-03 | PR-09 | AUTOMATE — MULTI-LAYER |
| TS-AUTHZ-01 | Technical behaviors | PR-10 | AUTOMATE — API |
| TS-AUTHZ-02 | Technical behaviors, US-014, US-023-AC-02 | PR-10 | AUTOMATE — API |
| TS-AUTHZ-03 | US-014-AC-01 | PR-10 | AUTOMATE — UI |
| TS-AUTHZ-04 | US-014-AC-02, AC-03, US-017-AC-07 | PR-10 | AUTOMATE — UI |
| TS-AUTHZ-05 | US-014-AC-04, AC-05 | PR-10 | AUTOMATE — UI |
| TS-AUTHZ-06 | US-016-AC-07, US-020-AC-04 | PR-10 | AUTOMATE — UI |
| TS-PROF-01 | US-023-AC-01, AC-02 | PR-01 | AUTOMATE — API |
| TS-PROF-02 | US-023-AC-03 | PR-01 | AUTOMATE — API |
| TS-DISC-01 | US-005-AC-01, AC-02, AC-04 | PR-21 | AUTOMATE — UI |
| TS-DISC-02 | US-005-AC-05, US-021-AC-03 | PR-21, PR-15 | DEFER |
| TS-DISC-03 | US-005-AC-03, US-006-AC-02, US-008-AC-02 | PR-21 | AUTOMATE — UI |
| TS-DISC-04 | US-006-AC-01, AC-04 | PR-21 | AUTOMATE — UI |
| TS-DISC-05 | US-007-AC-01, AC-02 | PR-21 | AUTOMATE — UI |
| TS-DISC-06 | US-007-AC-03, AC-04 | PR-21 | DEFER |
| TS-DISC-07 | US-007-AC-05 | PR-14 | AUTOMATE — MULTI-LAYER |
| TS-DISC-08 | US-008-AC-01 | PR-21 | AUTOMATE — UI |
| TS-DISC-09 | US-008-AC-03 | - | AUTOMATE — UI |
| TS-DISC-10 | US-009-AC-01, AC-02, AC-04 | - | AUTOMATE — UI |
| TS-DISC-11 | US-009-AC-03 | - | AUTOMATE — UI |
| TS-DISC-12 | US-009-AC-05 | PR-14 | AUTOMATE — MULTI-LAYER |
| TS-SRCH-01 | US-010-AC-01, AC-02 | PR-16 | AUTOMATE — UI |
| TS-SRCH-02 | US-010-AC-02 | PR-16 | AUTOMATE — UI |
| TS-SRCH-03 | US-010-AC-03, AC-04 | PR-16 | AUTOMATE — UI |
| TS-SRCH-04 | US-010-AC-05, AC-08 | PR-16 | AUTOMATE — UI |
| TS-SRCH-05 | US-010-AC-06 | PR-16 | AUTOMATE — UI |
| TS-SRCH-06 | US-010-AC-07 | PR-16 | AUTOMATE — UI |
| TS-SRCH-07 | US-010-AC-09 | PR-16 | AUTOMATE — API |
| TS-SRCH-08 | US-010, SD-1 | PR-16, TR-05 | AUTOMATE — INTEGRATION |
| TS-SRCH-09 | Technical behaviors | PR-26 | EXPLORATORY |
| TS-SONG-01 | US-011-AC-01, AC-07 | PR-08 | AUTOMATE — MULTI-LAYER |
| TS-SONG-02 | US-011-AC-02 | PR-14 | AUTOMATE — MULTI-LAYER |
| TS-SONG-03 | US-011-AC-03 | - | AUTOMATE — UI |
| TS-SONG-04 | US-011-AC-04 | - | MANUAL |
| TS-SONG-05 | US-011-AC-05 | - | AUTOMATE — UI |
| TS-SONG-06 | US-011-AC-06 | PR-12 | AUTOMATE — MULTI-LAYER |
| TS-SONG-07 | US-011-AC-08 | PR-23 | AUTOMATE — INTEGRATION |
| TS-DL-01 | US-012-AC-01, AC-03 | - | AUTOMATE — UI |
| TS-DL-02 | US-012-AC-02 | PR-23 | AUTOMATE — INTEGRATION |
| TS-PLAY-01 | US-013-AC-01, AC-09 | PR-08 | AUTOMATE — UI |
| TS-PLAY-02 | US-013-AC-02 | PR-08 | AUTOMATE — UI |
| TS-PLAY-03 | US-013-AC-03 | PR-08 | AUTOMATE — UI |
| TS-PLAY-04 | US-013-AC-04 | PR-08 | AUTOMATE — UI |
| TS-PLAY-05 | US-013-AC-05 | PR-08 | AUTOMATE — UI |
| TS-PLAY-06 | US-013-AC-06 | PR-08 | AUTOMATE — UI |
| TS-PLAY-07 | US-013-AC-07 | PR-08 | AUTOMATE — UI |
| TS-PLAY-08 | US-013-AC-03 | PR-08, TR-03 | AUTOMATE — UI |
| TS-PLAY-09 | US-013-AC-08 | - | AUTOMATE — UI |
| TS-PLAY-10 | US-013 | PR-08 | DEFER |
| TS-FAV-01 | US-015-AC-01, AC-02 | PR-13 | AUTOMATE — MULTI-LAYER |
| TS-FAV-02 | US-015-AC-03 | PR-19 | AUTOMATE — UI |
| TS-FAV-03 | US-015-AC-04, US-016-AC-01 | PR-19 | AUTOMATE — UI |
| TS-FAV-04 | US-015-AC-05 | PR-19 | AUTOMATE — API |
| TS-FAV-05 | US-015-AC-06 | - | MANUAL |
| TS-FAV-06 | US-015-AC-07 | PR-19 | AUTOMATE — API |
| TS-FAV-07 | US-016-AC-01 | PR-19 | AUTOMATE — UI |
| TS-FAV-08 | US-016-AC-02 | - | AUTOMATE — UI |
| TS-FAV-09 | US-016-AC-03 | - | AUTOMATE — UI |
| TS-FAV-10 | US-016-AC-04 | - | MANUAL |
| TS-FAV-11 | US-016-AC-05, AC-06 | - | AUTOMATE — UI |
| TS-REV-01 | US-017-AC-01 | PR-03 | AUTOMATE — UI |
| TS-REV-02 | US-017-AC-02 | PR-02 | AUTOMATE — MULTI-LAYER |
| TS-REV-03 | US-017-AC-03 | - | AUTOMATE — UI |
| TS-REV-04 | US-017-AC-04 | PR-02 | AUTOMATE — UI |
| TS-REV-05 | US-017-AC-05 | PR-24 | AUTOMATE — UI |
| TS-REV-06 | US-017-AC-06 | PR-23 | AUTOMATE — UI |
| TS-REV-07 | US-017-AC-09 | PR-02 | DEFER |
| TS-REV-08 | US-017-AC-10 | PR-03 | DEFER |
| TS-REV-09 | US-017-AC-08 | - | EXPLORATORY |
| TS-STRM-01 | US-021-AC-01 | PR-15 | AUTOMATE — UI |
| TS-STRM-02 | US-021-AC-02 | PR-15 | AUTOMATE — UI |
| TS-STRM-03 | US-021-AC-01 | PR-15 | EXPLORATORY |
| TS-STRM-04 | US-021-AC-05 | - | AUTOMATE — API |
| TS-L10N-01 | US-018-AC-01, AC-02 | PR-25 | AUTOMATE — UI |
| TS-L10N-02 | US-018-AC-03, AC-04 | PR-25 | AUTOMATE — UI |
| TS-L10N-03 | US-018-AC-04, US-006-AC-03 | PR-25 | MANUAL |
| TS-THEME-01 | US-019-AC-01 to AC-03 | PR-25 | AUTOMATE — UI |
| TS-NAV-01 | US-020-AC-01 to AC-03 | - | AUTOMATE — UI |
| TS-NAV-02 | US-020-AC-05 | PR-14 | AUTOMATE — UI |
| TS-REC-01 | US-022-AC-04 | PR-17 | AUTOMATE — UI |
| TS-REC-02 | US-022 placement, AC-02 | PR-18 | AUTOMATE — INTEGRATION |
| TS-REC-03 | US-022-AC-01, AC-07 | PR-18 | AUTOMATE — INTEGRATION |
| TS-REC-04 | US-022-AC-08, AC-09 | PR-18 | AUTOMATE — INTEGRATION |
| TS-REC-05 | US-022-AC-02, AC-03 | PR-17 | AUTOMATE — INTEGRATION |
| TS-REC-06 | US-022-AC-04 | PR-17 | AUTOMATE — INTEGRATION |
| TS-REC-07 | US-022-AC-04 | PR-17 | AUTOMATE — INTEGRATION |
| TS-REC-08 | US-022-AC-04 | PR-17 | AUTOMATE — INTEGRATION |
| TS-REC-09 | US-022-AC-17 | PR-04 | AUTOMATE — INTEGRATION |
| TS-REC-10 | US-022-AC-14, AC-15 | PR-05 | AUTOMATE — INTEGRATION |
| TS-REC-11 | US-022-AC-13, AC-16 | PR-20 | AUTOMATE — INTEGRATION |
| TS-REC-12 | US-022-AC-16 | PR-06 | AUTOMATE — INTEGRATION |
| TS-REC-13 | US-022-AC-12, AC-16 | PR-06 | AUTOMATE — INTEGRATION |
| TS-REC-14 | US-022-AC-10, AC-11 | PR-06 | AUTOMATE — INTEGRATION |
| TS-REC-15 | US-022-AC-13 | PR-06, TR-11 | AUTOMATE — INTEGRATION |
| TS-REC-16 | US-022-AC-01, AC-07, AC-08 | PR-18, TR-11 | AUTOMATE — E2E |
| TS-API-01 | Technical behaviors | - | AUTOMATE — API |
| TS-API-02 | Technical behaviors | PR-26 | EXPLORATORY |
| TS-E2E-01 | US-005, US-006, US-011, US-013 | PR-08 | AUTOMATE — E2E |
| TS-E2E-02 | US-002, US-004, US-013, US-015, US-016 | PR-07, PR-08, PR-09 | AUTOMATE — E2E |

---

## 13. Verification of this document

The totals in section 1 were computed from the section 3 tables. A cross-check confirmed:
- every one of the 117 scenario ids in `test-scenarios.md` has exactly one row in section 3;
- every priority equals the scenario's priority;
- every classification in section 12 equals section 3.

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Draft 1 |
| 2026-10-08 | Elasticsearch key renewed: TS-SRCH-07 → AUTOMATE — API, TS-SRCH-08 → AUTOMATE — INTEGRATION; totals recomputed from section 3 (DEFER 9 → 7, candidates 99 → 101) |
