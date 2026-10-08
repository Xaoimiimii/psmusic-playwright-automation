# PSMusic - Runtime Business Behavior and Findings (Browser Exploration)

**Observed behavior is not a requirement.** Each row records what the running app did on 2026-09-30. Whether it is intended is only known where documentation says so (see `../documentation/`). Confidence: **High** = reproduced or directly visible in both UI and network; **Medium** = single observation; **Low** = inferred.

## 1. Observed business behavior

| ID | Action / input | Observed result | Expected-looking? | Evidence | Confidence |
|---|---|---|---|---|---|
| BR-A1 | Login with empty username/password | "Please fill in all information", no request | Yes | UI | High |
| BR-A2 | Login/Register with password < 8 chars | "Password must be at least 8 characters", no request | Yes | UI | High |
| BR-A3 | Login with unknown username | 400 "Tài khoản không tồn tại", shown inline | Mostly (Vietnamese in EN UI) | UI + network | High |
| BR-A4 | Register with duplicate username / email (API) | 400 "Tài khoản đã tồn tại" / "Email đã tồn tại" | Yes | network | High |
| BR-A5 | UI register with an email the external validator says does not exist | "Email không tồn tại hoặc không thể gửi được", no register call | Plausible | UI + network | High |
| BR-A6 | API register with a non-Gmail email | Accepted (200) | Unknown: the UI implies a Gmail-only rule, the API doesn't enforce it | network | High |
| BR-A7 | Register success | No auto-login (no token/cookie) | Plausible | network | Medium |
| BR-F1 | Favorite toggle (player heart) | Toggles on/off, returns new state + Vietnamese message | Yes | UI + network | High |
| BR-F2 | Song favorite counter after favoriting | Unchanged on the page until reload, then +1 | Unknown | UI | High |
| BR-F3 | Favorites page after un-favoriting | Refetches and shows the empty state immediately | Yes | UI + network | High |
| BR-R1 | Rating modal submit without a star | Submit disabled | Yes | UI | High |
| BR-R2 | Comment | Optional (placeholder says "Không bắt buộc") | Yes | UI | Medium |
| BR-R3 | After reviewing a song | UI hides the rating form for that song; rate button gets `_rated` state; `isReviewed:true` from `/player` | Plausible one-review-per-user rule (UI-level). Server-side enforcement NOT TESTED | UI + network | High |
| BR-R4 | Review list order | Newest first | Plausible | network | Medium |
| BR-P1 | Logged-in playback reaching ~20 s | Exactly one `POST /api/song/stream/{id}` | Plausible "counted play" rule | network | High (single run) |
| BR-P2 | Player Next | Plays a song from the random `next-batch` queue (song 1444 after 1) | Unknown | network | Medium |
| BR-P3 | Player state after full reload | Gone (not persisted) | Unknown | UI | High |
| BR-C1 | Genres/Charts categories | Exactly 4 categories (ids 10, 2, 1, 26) returned by `category/popular` | Depends on data | network | High |
| BR-C2 | Charts section order | Vietnamese (10), Western (26), Youth (2), Pop (1) - differs from API order (10, 2, 1, 26) | Unknown (matches the repository note that ids 10/26 are special-cased) | UI | High |
| BR-C3 | Chart rows | 10 per chart, ranked 1-10 | Plausible | UI | High |
| BR-C4 | Category page paging | Songs 12/page, featured artists 10/page; Previous disabled on page 1 | Plausible | UI + network | High |
| BR-S1 | **Search any keyword** (`hoang dung`, `Hoàng Dũng`, `Starboy`, `starbo`, nonsense) | Always `total:0` -> "No results found for "…"." | **Suspicious**: "Starboy" exists in Charts | UI + network | High |
| BR-L1 | Language switch | All UI labels and `<html lang>` change; server messages and the rating modal stay Vietnamese | Partly | UI | High |
| BR-N1 | Unknown song id | "Song not found" | Yes | UI + 404 | High |
| BR-N2 | Unknown artist / category id | API 204; page mostly blank, no error message | Unknown | UI + network | High |
| BR-N3 | Unknown route | Empty main area, no 404 page | Unknown | UI + console | High |

## 2. Runtime findings and anomalies

Format: title / flow / steps / observed / expected (if known) / evidence / severity / further investigation.

**F-1 Search always returns nothing** - OBSERVATION - RESOLVED AS ENVIRONMENT ISSUE (outdated Elasticsearch key, stakeholder 2026-10-01; key renewed 2026-10-08)
- Flow: UF-06. Steps: type any term in the header search, press Enter.
- Observed: `GET /api/song/search` -> 200 `{"topResult":null,"results":[],"total":0,"totalPages":0}` for every term, including exact catalog titles.
- Expected: README lists search as a feature, so results for existing titles would be expected. Intended behavior per environment is UNKNOWN.
- Evidence: network bodies. Severity: high functional impact (the feature is unusable here). Further investigation: done through the API on 2026-10-08, search returns real results (`search.md`); browser re-run pending. See `browser-unknowns.md` U-1.1.

**F-2 Third-party recommendation popup blocks UI interaction** - OBSERVATION
- Flow: UF-03/UF-04/UF-13. Steps: open `/song/:id`, wait a few seconds.
- Observed: a "Recommendations just for you" popup (shadow DOM, fixed bottom-right) appears and **intercepts pointer events** on the auth modal buttons and player controls. Clicks time out until `button.recsys-close` is pressed. It reappears on each song page visit.
- Evidence: Playwright "intercepts pointer events" errors; `evidence/psmusic-recsys-popup.png`. Severity: medium for users, high for automation. Further investigation: yes (whether it can be disabled in test builds).

**F-3 Player controls rendered 2-3 times** - OBSERVATION - EXPECTATION UNKNOWN
- Observed: while playing, `[class*=player-controls-new]` exists 2x on `/` and 3x on `/song/:id`, all `position: fixed` in the same box; one sits inside the song page container.
- Impact: duplicate controls may double-handle events (not observed); automation locators become ambiguous. Further investigation: yes.

**F-4 Duplicate API calls on every page load** - OBSERVATION
- Most GETs and `auth/refresh` fire twice. RUNTIME-INFERRED to be React StrictMode in the dev server; may not occur in a production build. Further investigation: compare against a production build.

**F-5 Song detail user flags wrong after hard reload** - OBSERVATION - EXPECTATION UNKNOWN
- Steps: log in, favorite + review song 1, reload `/song/1`.
- Observed: `detail` is sent before `refresh` completes, without a token -> `isFavorited:false, isReviewed:false`, while `/player` -> `true/true`. Correct after in-app navigation.
- Severity: low (flags not visibly used on the detail page), but a race to note for automation.

**F-6 Counters not updated after favorite** - OBSERVATION - EXPECTATION UNKNOWN
- The song page favorite counter stays stale until reload.

**F-7 Inconsistent review date format** - OBSERVATION
- A newly submitted review shows "30/9/2026" (client-side), older and reloaded reviews show "2026-09-30" (server).
- Cause (REPOSITORY-CONFIRMED 2026-09-30): `RatingModal.jsx` builds the new review locally with `new Date().toLocaleDateString("vi-VN")`, while `RatingRepository` formats `yyyy-MM-dd`. Whether the difference is intended: UNKNOWN.

**F-8 Localization gaps** - OBSERVATION
- Server messages always Vietnamese; the rating modal and the `/recent` title are hard-coded Vietnamese; missing i18n key `genre_category` on category pages (console); `/locales/en-US/translation.json` returns non-JSON (200). Severity: low.

**F-9 Login reveals username existence** - OBSERVATION - EXPECTATION UNKNOWN
- "Tài khoản không tồn tại" for unknown usernames. The wrong-password message for existing users was not tested, so an enumeration comparison is incomplete.

**F-10 Third-party tracking continues after "Decline"; username stored by the tracker** - OBSERVATION - EXPECTATION UNKNOWN
- `POST /recommendation` continued after Decline; `recsys_cached_user_info` holds the username and survives logout.
- Confirmed in the second session: after logout, `/recommendation` requests still send `"UserId":"psmusicqa_browser01"` (see `recommendations.md` F-R1 to F-R5 for the recommendation-specific findings).

**F-11 No feedback for unknown artist/category or unknown route** - OBSERVATION
- Blank pages instead of an error/404 state.

**F-12 Search API size semantics** - OBSERVATION
- Header suggestions request `size=5`, the results page `size=12` (twice). No results, so paging behavior UNKNOWN.

## 3. Rules explicitly NOT verified at runtime
Server-side one-review-per-user enforcement; rating value bounds (only 3 submitted); stream de-duplication (repeated plays, replays, seeking past 20 s); guest stream recording at 20 s; favorite behavior on songs without lyrics; popularity window (7 days); pagination bounds (`page=0`, huge `size`).
