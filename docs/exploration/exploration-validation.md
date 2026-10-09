# Exploration Validation

Result of reconciling the three exploration sources (repository, browser/runtime, documentation) with `docs/requirements/user-stories.md`. Done 2026-09-30, updated with stakeholder answers on 2026-10-01. The SUT, its configuration and its data were not changed.

## 1. Summary

- **Status: PARTIALLY VERIFIED.** All 23 user stories have exploration evidence, but none is fully verified. The stories now hold the agreed expectation. Evidence per story is in `docs/exploration/browser/`, `repository/` and `documentation/`.
- **Only two requirement sources exist.** The README (thin: 5 features, 3 endpoints) and the stakeholder's answers. Everything else describes current behavior, not a requirement.
- **Browser limits.** One dev build, one role, a single observation for many flows, one writing session. A new browser pass was not possible in this reconciliation (the browser profile was locked).
- **Readiness.** Test strategy and scenario design can start. Search design can start from the repository; it can run since the Elasticsearch key was renewed on 2026-10-08. UI sign-up, session expiry (US-003 AC-04/05) and the source-only defects need the open items in section 6.

## 2. Defects against the agreed stories

| Story / AC | Expected | Observed | Evidence |
|---|---|---|---|
| US-004-AC-01 | Logout lands on `/` | Lands on `/auth` when logging out from `/favorites` | Runtime, one run |
| US-007-AC-05 | Unknown category: visible not-found, API 404 | API 204, blank page | Runtime + source |
| US-009-AC-05 | Unknown artist: visible not-found, API 404 | API 204, only a Play button | Runtime + source |
| US-020-AC-05 | Unknown route: visible not-found page | Blank main area, console warning | Runtime + source |
| US-011-AC-06 | Heart/star filled for a favorited/reviewed song | False after a hard reload (detail request runs before session restore) | Runtime + source |
| US-015-AC-01 | Like count increases after favoriting | Song-page counter stale until reload | Runtime |
| US-017-AC-05 | New review shows `yyyy-MM-dd` | Shows `30/9/2026` (client `vi-VN` format) | Runtime + source |
| US-017-AC-09 | Server rejects a second review by the same user | Server accepts | Source only |
| US-017-AC-10 | Server rejects rating outside 1 to 5 | Server accepts | Source only |
| US-022-AC-14 | After Decline nothing is sent | `/evaluation` and `push-keyword` still sent | Runtime |
| US-022-AC-15 | After Decline no identity is sent | `AnonymousId` and `UserId` still sent | Runtime |
| US-022-AC-17 | Before any choice nothing is sent | `/recommendation` with identity sent while the banner is shown | Runtime |
| US-023-AC-03 | A user cannot read another user's profile | `GET /api/user/{id}` returns any user, with email | Runtime + source (runtime 2026-10-08, `browser/authorization.md` Z-5) |
| US-010 (was blocked, not a defect) | Search returns results | Empty for every keyword until 2026-10-08 | Outdated Elasticsearch key (stakeholder); key renewed 2026-10-08; search confirmed through the API (`browser/search.md`) |

US-022 defects belong to the third-party service or its integration. Report them to the owning team and keep the tests in the recommendation suite.

## 3. Decisions taken (stakeholder, 2026-10-01)

See the decisions table in `user-stories.md`. In short:

- Search follows the repository; the empty results are an environment issue.
- Charts show no popular artists and no favorite control.
- Logout lands on `/`; unknown category, artist and route show a not-found state, with 404 from the category and artist APIs.
- `/recent` requires login. Genre title wording does not matter.
- The server enforces review uniqueness and the 1 to 5 range. A "view my profile" story is required. Nothing is sent to the recommendation service before the user chooses.
- Intended as is: Gmail-only sign-up UI, favorites order not persisted, distinct login errors, guest download, no responsive requirement, same recommendation list on every song page.

## 4. Source conflicts that remain

| Topic | Documentation | Repository | Runtime | Note |
|---|---|---|---|---|
| Profile endpoint | `GET /api/user/profile` | Only `GET /api/auth/me` and `GET /api/user/{id}` (no UI caller) | `auth/me` returns 401 without a token; profile path not probed | Needs a decision (US-023) |
| Swagger location | `https://localhost:7120/swagger` | Ports 7215 / 5006, Development only | 200 at `https://localhost:7215/swagger` | Documentation is outdated |
| API key header | Not mentioned | `X-App-Service-Key` required | 401 without it | Documentation gap |
| Recommendations | Not mentioned | "Not implemented" (empty containers only) | Working third-party feature | Scope: delivered by another team |
| Gmail rule | Not mentioned | UI only; server accepts any valid email | Only the "mailbox does not exist" branch seen | Intended (UI rule) |
| Lyrics filter | - | Applied in some queries, not in category lists, detail, player | Not compared | Open question for the SUT team |

## 5. Corrections made to the exploration documents

Each correction keeps the original text and adds a dated note.

- Charts `artist/popular` is fetched but never rendered (`browser/api-inventory.md`, `repository/api-inventory.md`, `repository/pages-and-locators.md`).
- The rating request body is `{rating, comment, user}`; the server ignores `user` (`browser/api-inventory.md`, `repository/user-flows.md`, `repository/api-inventory.md`).
- Sign-up shows the email checker's own message first, and the translation keys only as a fallback (`repository/authentication.md`).
- Recommendations are "not implemented" only in this repository; at runtime a third-party tracker provides them (`repository/user-flows.md`).
- Theme options are buttons named Ruby to Aquamarine, not position-based (`repository/pages-and-locators.md`).
- The review date difference is caused by the client's `vi-VN` formatting (`browser/business-rules.md`).
- A pointer to this document and a logout source check were added (`browser/browser-unknowns.md`).

## 6. Missing information and next steps

| Item | Why it matters | Source |
|---|---|---|
| Content of the `songs` and `artists` indices (key renewed 2026-10-08; both filled from PostgreSQL at API startup by `ElasticSeeder` (SUT commit `d1a3c44`, 2026-10-08)) | Search (US-010) and search-result cards (US-022-AC-16) | Browser / API search |
| Suggestion dropdown: an empty result should show "No suitable suggestions" but nothing was seen | US-010-AC-02 | Browser (key renewed 2026-10-08) |
| Test environment, accounts and a plan for permanent writes (reviews, streams) | All write tests; no usable password exists for the existing QA accounts | SUT team |
| UI sign-up: external email check needs a real mailbox | US-001-AC-03 | Product/SUT team: real mailbox or approved mock |
| Token expiry, 401 retry, refresh reuse, token after logout | US-003, US-004 | API, with a short token lifetime |
| Review rules: comment length, rejection status code | US-017-AC-09/10 | Product; API check in an approved environment |
| Profile endpoint and UI | US-023 | Product |
| Wrong-password message | US-002-AC-05 | Browser, with a known-password account |
| Logout from a public page; guest heart/rate gating; remaining player controls; favorites drag, show more, playlist download; theme and language persistence; empty and error states | Criteria still source only | Browser (guest-only checks need no writes) |
| Production-build behavior (duplicate GETs and duplicate player controls were seen on the dev server) | Call-count and locator assumptions | Browser on a production build |
| US-022 gaps: logged-in `/favorites` and `/search` popups, card comparison on Song, Category and popup, rating/review events, sign-up and logout privacy capture | US-022-AC-07, 09, 10, 16 | Browser + stakeholder |
| Environment URLs, CI certificate and API-key provisioning | CI design | SUT team |

## 7. Locator guidance for automation

- **Stable:** `href` links (`a[href="/song/{id}"]`, `/artist/{id}`, `/category/{id}`), sidebar `a[href]`, page headings, language option names (native names), theme option names, login/logout role names, `audio` element, auth form scoped by heading, privacy banner ids (`#recsys-decline`, `#recsys-accept`).
- **Language-dependent:** every role/name locator. Pin `localStorage.i18nextLng = 'en'` before navigation. Server messages and the rating modal stay Vietnamese.
- **Fragile:** player controls (hashed classes, no names, rendered 2 to 3 times; scope to the player wrapper), the player heart (a `div`, state in `svg[fill]`), header icon buttons, chart rows, rating stars, song-page counters.
- **Third-party and controlled by another team:** `.recsys-item`, `[id^="recsys-popup-host"]`, `button.recsys-close`. The popup intercepts clicks; close it or block the tracker outside the recommendation suite.
- No replacement locators are recommended without DOM evidence. A request to the SUT team for test ids and labels stays open.

## 8. API notes

- All main endpoints are confirmed by repository and runtime. The runtime inventory covers only what the explored flows triggered.
- Confirmed by source only: `GET /api/song` and `/api/song/popular` (no UI caller), `GET /api/user/{id}`, the 401-refresh-retry path.
- Behavior to check later: `page=0` or `size=0` on popular endpoints (possible 500), a missing search keyword, favorite and stream calls for unknown song ids.
- Status codes seen: 204 for unknown artist/category, 404 for unknown song, 200 with `isSuccess:false` for refresh failure, 401 for a missing key or token.

## 9. Overall status

- Exploration: partially verified, with a clear defect list (section 2) and a short list of open items (section 6).
- Stories: `user-stories.md` is the single reference for expected behavior. Where a story is marked DEFECT, tests should assert the story, not the current behavior.
- Everything not covered by a story note or a stakeholder decision is a characterization of current behavior, not a confirmed requirement.
