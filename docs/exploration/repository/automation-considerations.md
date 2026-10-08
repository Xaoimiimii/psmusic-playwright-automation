# PSMusic - Automation Considerations (Repository / Source-Code Based)

> Derived from reading the SUT source code; none of it is documented intent. Documentation-based counterpart: `../documentation/automation-considerations.md`.

Inputs: the other files in `docs/exploration/repository/`. This document is analysis only: **no test cases and no automation code**. Project stack constraints (Playwright/TypeScript, `APIRequestContext`, Allure, GitHub Actions) come from `psmusic-playwright-automation/CLAUDE.md`.

## 1. Environment prerequisites (all CONFIRMED from repo unless stated)
| Need | Detail |
|---|---|
| Running frontend | Docker: `http://localhost:5173`; or Vite dev server (HTTPS via mkcert, `https://localhost:5173` per CORS list); or Netlify hosts (only in CORS list) |
| Running API | Docker: `http://localhost:7215/api`; VS: `https://localhost:7215` / `http://localhost:5006`. Client is built against a fixed `VITE_API_BASE_URL` -> the UI and API pair must match |
| App key header | `X-App-Service-Key` with the environment's secret for any direct API call (obtain via team channel; do not commit) |
| PostgreSQL | with `unaccent` extension (used by unused-but-compiled queries; extension absence only matters if those queries run - they are not routed) |
| Elasticsearch | reachable cluster with a valid key (renewed 2026-10-08); indices are populated by `ElasticSeeder` at API startup. Without valid `Elasticsearch` config the API **fails to start** |
| Media hosts | mp3/lrc/image URLs reachable from the browser |
| External email API | needed for UI sign-up (see risk R-1) |
| Test browser | Chromium first (audio, cookies). Note existing template `playwright.config.ts` also lists Firefox/WebKit and has no `baseURL`/`webServer` yet |

## 2. Feature-by-feature implications

Test-level guide: **UI** (Playwright browser), **API** (APIRequestContext), **Hybrid** (API setup + UI verification), **DB** (direct DB read; needs DB access, not provided).

| Feature | UI candidate | API candidate | Backend verification | Level | Dependencies | Flaky / difficult | Data concerns | Validate first |
|---|---|---|---|---|---|---|---|---|
| Register | yes (sign-up form) | yes | DB row / duplicate messages | API primary, UI smoke | external email API for UI; unique data | **UI blocked/flaky by external validator**; Gmail rule | unique username/email each run; users persist | messages, post-success behavior |
| Login / session | yes | yes (login, refresh, me) | cookie + token claims | UI + API | user exists; cookie Secure/SameSite | cookie over HTTP; 1 s post-login delay; refresh on load | dedicated users | claim mapping, cookie behavior |
| Logout | yes | yes | cookie removal | UI | | cookie deletion, protected-page behavior after | | |
| Guest gating (modal/redirect) | yes | 401 checks | - | UI | none | modal focus/scroll lock | none | |
| Home / Genres / Charts | yes | yes (popular endpoints) | 7-day stream data | UI smoke + API contract | **recent streams must exist** | empty-state vs populated depends on time; 15-min client cache | may need stream seeding via API | data availability |
| Category / Artist pages | yes | yes | main/collab and related rules | UI + API | catalog data | colour extraction via canvas (CORS), pagination | stable ids | data ids |
| Search (suggest + results) | yes | yes | ES index | UI + API | Elasticsearch, index sync | debounce 300 ms, blur closes box in 150 ms, mousedown navigation, fuzzy results non-deterministic | needs known searchable titles | index refreshed only at API startup |
| Song detail / lyrics | yes | yes (detail, related, player) | counts | UI + API | LRC fetch/CORS | lyric highlight tied to audio clock | | |
| Player controls | yes | player/next-batch API | - | UI | audio playback; queue randomness | **autoplay policy, headless audio, random next-batch**; duplicate player bar | song with reachable mp3 | audio in Chromium |
| Stream counting (>= 20 s) | yes (network assertion) | yes (direct POST) | `Stream` row | API for rule, UI for trigger | 20 s of playback time | slow test; real-time dependent (may use Playwright clock only if audio time is controllable - UNKNOWN) | permanent rows | |
| Favorite toggle | yes (player bar) | yes | `Favorite.IsFavorite` | Hybrid | signed-in, song loaded in player | heart is a `div` (no role); counters relative | favorites persist; assert deltas | |
| Favorites page | yes | yes | list = flagged rows | Hybrid | favorited songs; 15-min cache cleared on toggle | drag & drop (library specific) | | |
| Rating / reviews | yes | yes | `Rating` row | Hybrid | signed-in | stars are unlabeled SVGs; hard-coded Vietnamese texts; duplicates allowed server-side | reviews persist forever | |
| Language / theme | yes | n/a | n/a | UI | none | dropdown markup unverified; persistence via localStorage | | |
| Downloads | yes (download event) | n/a | n/a | UI | cross-origin `download` attribute is ignored by browsers -> may open/navigate instead | media host CORS/headers | | |
| Stats endpoints | no | yes (`heartbeat`, `active-users`) | in-memory counters | API | signed-in | in-memory, global state affected by other tests | | |
| Authorization gaps (`/api/user/{id}`, rating validation) | no | yes (negative/security checks) | | API | 2 users | may expose defects to report, not silently work around | | |

## 3. Cross-cutting automation risks

| ID | Risk | Evidence | Mitigation direction |
|---|---|---|---|
| R-1 | UI sign-up depends on a third-party API + key and Gmail rule | `emailValidationService.js` | create test users via API; UI sign-up validated with network mocking (`page.route`) of the external host, or in a controlled environment; document that UI sign-up is not testable offline |
| R-2 | No test identifiers; class names hashed; icon-only buttons | see `pages-and-locators.md` | prefer role/text/placeholder/`data-tooltip`/`href`; pin language; ask SUT team for test ids (they cannot be added from this repo) |
| R-3 | Localized UI: strings depend on browser language; server messages always Vietnamese | `i18n.js` | set `locale` in Playwright context; or set language via the switcher/`localStorage` in setup; keep text maps per language |
| R-4 | Time-dependent "popular" data (7-day window) | `*Repository` | ensure fresh streams via API in setup, or detect/skip; avoid asserting order |
| R-5 | Global shared mutable state: favorites/ratings/streams counters, in-memory active users | entities | per-test users, relative assertions, avoid parallel tests touching the same song counters |
| R-6 | Audio playback in headless browsers | `PlayerContext` `<audio>` | validate with Chromium flags (autoplay policy) at browser exploration; consider asserting UI state and network calls rather than sound |
| R-7 | Search depends on ES freshness and fuzzy matching | `SongService.SearchAll` | use known static titles found at exploration; assert presence, not exact ordering |
| R-8 | Hover-revealed controls and mouse-down navigation | `ItemCardRow`, `Header` | use `hover()` before clicking; use normal `click()` (fires mousedown) |
| R-9 | Duplicate/parallel DOM (both auth forms; two player bars) | `AuthPage`, `ClientLayout` | scope locators to visible/first container; use `:visible` filtering |
| R-10 | Cookie flags (`Secure`, `SameSite=None`) vs plain HTTP & cross-origin API | `AuthController` | prefer `http://localhost` in Chromium (treated secure), or HTTPS; verify persistence; use `storageState` only after verifying |
| R-11 | Rate/perf: Elasticsearch cloud latency, cold API | `Program.cs` | generous but explicit waits on network responses (`waitForResponse`) rather than fixed delays (`CLAUDE.md` rule 10) |
| R-12 | Committed secrets in SUT repo (`docker-compose.yml`, `index.html`, `appsettings`) | files | never copy into this repo; use env vars / CI secrets |
| R-13 | 15-minute client cache and 10-minute server output-cache | `DataCacheContext`, `SongController` | reload/new context between assertions; note `/api/song/popular` is unused by UI |
| R-14 | Uncaught errors are swallowed in many client `catch {}` blocks (no UI feedback) | `PlayerControl`, `TopChartsPage`, etc. | assert via network response, not UI message, where UI shows nothing |

## 4. Suggested layering (informational)
- **API layer first** for: auth contract (register/login/refresh/logout/me), catalog endpoints shape and paging rules, favorite toggle, stream, rating (including negative/validation gaps), stats, user endpoint authorization.
- **UI layer** for: auth screens and gating, navigation/listing pages (existence/empty states), search UX, player controls state, favorites page, rating modal, language/theme.
- **Hybrid**: API-created users/tokens and setup -> UI verification; UI action -> API/network verification (e.g. favorite toggled -> `GET /song/favorites`).
- **DB verification** only if DB access becomes available; otherwise use the API as the oracle.

## 5. Things requiring Browser Exploration before writing any page object
1. Real DOM/roles of: dropdown options (language/settings), user avatar button accessible name, toast markup, Play/Pause visible state, `data-tooltip` rendering (CSS `::after` vs native `title`), loading spinner selectors.
2. Actual text shown for every error path (login, register, rating, search empty, lyric/no-lyric).
3. Real URLs and redirects (post-login navigation, logout, deep links).
4. Real network calls and payloads for each flow (compare with `api-inventory.md`).
5. Whether audio plays in Chromium, and how the player behaves when audio 404s.
6. Which catalog items exist (stable song/artist/category names & ids), whether ES search returns them.
7. Cookie behavior on the chosen host/scheme.

## 6. Areas requiring runtime/API validation (not browser)
- Status codes for unknown ids (204 vs 200 vs 404), page=0/size=0 behavior, missing `keyword`, invalid rating values, duplicate reviews, favorite toggle for a non-existent song, unauthorized access to `/api/user/{id}` for other users, header-missing behavior (401 shape), model-validation responses, CORS preflight from the UI origin.
