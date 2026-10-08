# PSMusic - Repository Unknowns and Validation Targets

Things that cannot be reliably determined from the repository alone. "Validate via" values: **BE** = Browser Exploration, **API** = direct API/runtime probing (Postman/curl/`APIRequestContext`), **DOC** = documentation/team clarification, **DB** = database inspection.

Confidence codes follow the other docs (UNKNOWN / CONFLICTING).

## 1. Environment and data
| ID | Unknown | Why unknown | Validate via |
|---|---|---|---|
| UNK-01 | Which environment is the test target (Docker `localhost:5173/7215`, VS dev, Netlify/production) and its actual base URLs | repo lists several; CORS/SPA-proxy ports disagree (`51743` SPA proxy vs `5173` CORS) | DOC |
| UNK-02 | Actual catalog content: existing songs, artists, categories, ids, names | data lives in PostgreSQL; no seed/import code in repo | BE, DB |
| UNK-03 | Whether recent (7-day) streams exist so Home/Genres/Charts are non-empty | time-dependent data | BE, API |
| UNK-04 | Elasticsearch `songs` index mapping and current content | **Partly answered 2026-10-08:** `ElasticSeeder` (SUT commit `d1a3c44`, 2026-10-08) populates `songs` and `artists` from PostgreSQL at every API startup (no sync between restarts). Mapping (e.g. `name.keyword` used by the exact-match query) is created by Elasticsearch, not by the repo | API (search calls) |
| UNK-05 | Media URL hosts (mp3/lrc/images), availability and CORS headers | stored in DB columns | BE, DB |
| UNK-06 | Pre-existing test accounts / credentials | none in repo | DOC |
| UNK-07 | Value of app secret header for the target environment | environment config, not to be committed | DOC |
| UNK-08 | Database name/schema state vs migrations (e.g. migrations named `test`, `test_add_key_sa` exist - meaning unclear) | migration content not analysed for semantic meaning | DB, DOC |
| UNK-09 | Whether Postgres `unaccent` extension is installed | only needed by unused queries | DB |
| UNK-10 | Meaning of category ids 10 and 26 (charts ordering) | hard-coded ids | DB, DOC |
| UNK-11 | Whether `error_smtp` and similar missing i18n keys are shown as raw keys | i18next default not verified | BE |

## 2. Rendered DOM and UI behavior
| ID | Unknown | Why | Validate via |
|---|---|---|---|
| UNK-20 | Final DOM/roles/accessible names of icon-only buttons (back/forward, eye toggle, close X, avatar, settings, player buttons) | no aria-labels/ids in source | BE |
| UNK-21 | How `data-tooltip` is rendered (CSS pseudo-element or JS) and whether it exposes text to accessibility tree | CSS modules not analysed | BE |
| UNK-22 | Hashed CSS-module class name format and stability across builds | Vite build output | BE |
| UNK-23 | Language and settings dropdown option element types/text (themes have names?) | markup lines not fully read | BE |
| UNK-24 | Toast (react-hot-toast) DOM, position, duration | library | BE |
| UNK-25 | Real appearance of empty/error states (e.g. home error message vs EmptyState) and loading spinner selectors | conditional rendering paths | BE |
| UNK-26 | Whether both `PlayerControl` instances are visible simultaneously (layout renders it twice, pages also render it) | CSS decides | BE |
| UNK-27 | Whether `/auth` panels toggle visibility by CSS transform (both forms in DOM) and which inputs are interactable | CSS | BE |
| UNK-28 | Post-registration behavior (redirect/panel switch) and login redirect timing effects | only text + 1 s timeout in code | BE |
| UNK-29 | Behavior for unknown routes (`*`) | no catch-all route | BE |
| UNK-30 | Seek bar/time display formats (`formatTime`) and the initial `duration` state | function not read | BE |
| UNK-31 | Drag-and-drop DOM attributes (`data-rfd-*`) and how to simulate reorder | library-generated | BE |
| UNK-32 | Whether the Charts page renders a Trending Artists block | tail of file not read | BE |
| UNK-33 | Whether audio continues when navigating between pages and after logout | provider lives above routes; no reset on logout | BE |
| UNK-34 | Responsive behavior (README claims responsive UI) | CSS | BE |
| UNK-35 | Suggestion box result when backend returns `size=10` while UI slices? (does the UI limit to 5?) | Header maps all results | BE |

## 3. Network and API behavior
| ID | Unknown | Why | Validate via |
|---|---|---|---|
| UNK-40 | Exact JSON casing of every response (camelCase assumed) | no custom JSON options found | API |
| UNK-41 | Status code for unknown artist/category id (`Ok(null)` => 204 assumed) | framework default | API |
| UNK-42 | Response to invalid model on login/register (ProblemDetails vs custom) and how UI displays it | `[ApiController]` auto behavior | API, BE |
| UNK-43 | Behavior for `page<=0` or `size<=0` on endpoints without correction | may throw SQL error | API |
| UNK-44 | Behavior for missing/blank `keyword` in search | no validation | API |
| UNK-45 | Whether JWT `sub` maps to `ClaimTypes.NameIdentifier` (needed by favorites/ratings/stream) | framework mapping | API |
| UNK-46 | Effect of missing `X-App-Service-Key` on CORS preflight and Swagger | middleware ordering | API |
| UNK-47 | Actual refresh-token lifetime config (`Jwt:RefreshExpiryMinutes` not in config files read) | default 7 days in code | API/DOC |
| UNK-48 | Concurrency behavior for double favorite toggles (composite PK race) | read-modify-write | API |
| UNK-49 | Rating with invalid values (0, 6, huge comment), duplicate reviews, unknown song | no validation code | API |
| UNK-50 | Rate limiting / lockout (none seen) | absence only | API |
| UNK-51 | Whether HTTPS redirection interferes in Docker HTTP (no HTTPS port configured) | env | API |
| UNK-52 | Output-cache behavior of `/api/song/popular` with Authorization or header variation | framework | API |
| UNK-53 | Actual network requests performed at page load (tracking SDK, `/stats/heartbeat`, refresh) and their failures | runtime | BE |

## 4. Security / auth runtime
| ID | Unknown | Validate via |
|---|---|---|
| UNK-60 | Refresh cookie acceptance over HTTP and cross-origin (Secure + SameSite=None) | BE, API |
| UNK-61 | Whether logout actually deletes the cookie (delete options vs set options) | BE |
| UNK-62 | Token expiry/refresh in practice (60-minute default) | API (short-lived config) or wait |
| UNK-63 | Whether a valid token on an anonymous endpoint changes response (`isFavorited` flags) as coded | API |
| UNK-64 | Authorization on `GET /api/user/{id}` across users (privacy) | API |

## 5. Conflicts recorded (not resolved)
| ID | Conflict | Sources |
|---|---|---|
| CNF-01 | Gmail-only registration (UI) vs any valid email (server) | `SignUp.jsx` vs `CreateUserDTO` |
| CNF-02 | Lyrics filter applied in some queries, disabled in others | `SongRepository` |
| CNF-03 | README lists `GET /api/user/profile`; controllers only have `GET /api/user/{id}` and `GET /api/auth/me` | `README.md` vs `UserController`, `AuthController` |
| CNF-04 | `avatarUrl` (login/refresh payload) vs `avatarURL` (`UserDTO`) | `AuthController`, `UserDTO` |
| CNF-05 | README states "responsive/high quality streaming" - no evidence of audio-quality selection | `README.md` |
| CNF-06 | Vite/SPA proxy ports: csproj `51743`, CORS `5173/5174` | `PSMusic.Server.csproj`, `Program.cs` |
| CNF-07 | UI language-less hard-coded Vietnamese vs i18n | `RatingModal.jsx` etc. |
| CNF-08 | Header requests suggestions `size=5`, server enforces minimum 10 | `Header.jsx`, `SongService` |

## 6. Corrections to `docs/requirements/user-stories.md` discovered during this exploration
The earlier story document was written from a shallower pass. This deeper pass shows the following items should be treated as superseded (the stories file itself was not edited by this task):
1. **Favorite is only available in the player bar.** Story text suggesting favorite controls on Top charts or rows (US-008-AC-04, US-015-AC-06) is unsupported: `ItemTopCharts` is unused and `SongRow` has no favorite control; `TopChartsPage.handleToggleFavorite` is dead code.
2. **Unknown-id API behavior:** `GET /api/artist/{id}` and `/api/category/{id}` return `Ok(null)`, which ASP.NET converts to **204 No Content** (INFERRED), not "200 with null body".
3. **Auth modal from the player pauses the audio** (`onStopMusic` is passed there) - the open question in US-014 is answered.
4. **Search size:** header suggestions request 5 but the server enforces at least 10; artist results are not paginated.
5. **Main/collab lists** have no explicit ordering (US-009-AC-05 unknown resolved as "no ordering in code").
6. **Page sizes:** artist page 10, category artists 10, category songs 12, search 12.
7. **Cache TTL:** client cache expires after 15 minutes (`CACHE_EXPIRATION`), not "unknown".
8. **Sign-up quirks:** missing `error_smtp` translation key and the possibility that a valid-looking message ("Email hợp lệ") is displayed as an error when only SMTP is invalid.
9. `avatarUrl` vs `avatarURL` casing difference.

## 7. Documentation-review questions for the SUT team
1. Intended test environment(s) and provisioning of DB/ES/media; seed data source.
2. Is the Gmail-only sign-up rule intended? Is there a way to disable/mock the external email validator in test environments?
3. Should favorites be available beyond the player bar (charts, rows)? Is the non-interactive heart/star on the song page intended?
4. Intended rating rules (range, single review per user) and whether server validation is planned.
5. Purpose of the tracking/recommendation SDK (`__RECSYS_DOMAIN_KEY__`) and whether it should be blocked in automated runs.
6. Are `/recent`, "Recommends for you", playlists planned features?
7. Are stable test hooks (`data-testid`) acceptable to add on the SUT side?
