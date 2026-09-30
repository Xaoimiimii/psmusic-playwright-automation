# PSMusic - Test Data (Browser Runtime Exploration)

Runtime data seen or created on 2026-09-30 in the local environment (UI `https://localhost:5174`, API `https://localhost:7215`, backed by a **remote** PostgreSQL). No passwords, tokens or keys are recorded here. Other users' names and review contents are not reproduced.

## 1. Data CREATED by this exploration (needs owner awareness / cleanup)

| Item | Details | How created | State at end of session |
|---|---|---|---|
| User `psmusicqa_7193372` | email `psmusicqa.autotest.7193372@example.com` | `POST /api/auth/register` from the page context | **Orphaned**: its random password was lost (explorer error). Unusable; delete via DB if cleanup is wanted |
| User `psmusicqa_browser01` | email `psmusicqa.browser01@example.com`, display name = username, user id **441** (JWT `sub`) | `POST /api/auth/register` from the page context | Active. Password was **not** written to any file; provide it through `.env` / a secret store if the account is reused |
| User `psmusicqa_priv1790780407163` | email `psmusicqa.priv1790780407163@example.com`, display name = username | `POST /api/auth/register` from the page context (2026-09-30, recommendations privacy pass) | Active. Password was a random canary string, **not** saved. Unusable without a password reset; delete via DB if cleanup is wanted |
| Favorite | user 441 -> song 1 | Player heart | Toggled on, then off. `isFavorited:false`; a DB row with `IsFavorite=false` probably remains (RUNTIME-INFERRED, per repository docs) |
| Review | id **1330**, song 1, rating 3, comment "QA browser exploration - automated test account", date 2026-09-30 | Rating modal | **Persisted**. Song 1 review count went 11 -> 12. No delete path observed |
| Stream | user 441, song 1, 1 row | ~20 s of playback | Persisted (affects "popular" rankings slightly) |
| Heartbeats | user 441 | Automatic | In-memory on the server (INFERRED) |
| External email checks | 2 Abstract API lookups (`psmusicqa.<ts>@example.com`, `psmusicqa.autotest.<ts>@gmail.com`) | UI Register submit | Consumed third-party quota |

Side effect: song 1 favorite count went 9 -> 10 while the favorite was on. After un-favoriting it is expected back at 9 (not re-verified).

## 2. Accounts

| Account | Purpose | Notes |
|---|---|---|
| `psmusicqa_browser01` | Logged-in flows (favorites, rating, stream, logout) | Has already reviewed song 1, so on song 1 the UI no longer shows the rating form for this user. Use another song for review scenarios, or a fresh user |
| Guest (no account) | Public browsing, redirects, auth modal | - |

No pre-provisioned test accounts were available. **UI registration cannot be used with synthetic emails** (external mailbox check). API registration with `@example.com` works.

## 3. Catalog data observed (reusable, read-only)

Categories returned by `GET /api/category/popular` (all 4 shown on Home / Genres / Charts):

| id | DB name | English UI name |
|---|---|---|
| 10 | Nhạc Việt | Vietnamese Music |
| 2 | Nhạc Trẻ | Vietnamese Youth Music |
| 1 | Pop | Pop |
| 26 | Âu Mỹ | Western Music |

Sizes observed: category 26 (Western) `song/category/popular/26` reported `totalItems: 836`. Category 1 (Pop) UI pagers showed 65 song pages (12/page) and 13 Featured Artist pages (10/page).

Artists seen in "Trending Artists" (ids): 166 Sơn Tùng M-TP, 8 Jack - J97, 63 SOOBIN, 69 The Weeknd, 73 Ariana Grande, 113 Sabrina Carpenter, 152 Thịnh Suy, 1 Hoàng Dũng, 168 Snoop Dogg.

Songs used / seen with ids:

| id | Title | Notes |
|---|---|---|
| 1 | Chờ Anh Nhé (Hoàng Dũng, Hoàng Rob) | Has lyrics + MP3; duration 05:22; used for favorite/rate/stream |
| 539 | Die For You (Remix) | Multi-artist |
| 581 | Starboy | Visible in Charts, yet search returns nothing |
| 1444 | Toosie Slide | Reached through player Next (random queue) |
| 3048, 3099, 2577, 1952, 585, 587, 336, 644, 4, 10, 22, 73, 89, 422, 444, 689, 696, 698, 1619, 1622, 1625 | other chart/genre songs | |

Invalid ids used for negative checks: `99999999` for song (404), artist (204), category (204).

## 4. Dynamic / stale-prone data (RUNTIME-OBSERVED or INFERRED)
- **Chart and Trending order** depends on recent streams (INFERRED); this session added one stream to song 1.
- **Counters** (favorites, reviews) are shared global values that other users change; assert on deltas, not absolute numbers.
- **"Recommends for you" / next-batch / Next track** are non-deterministic (third-party recommendations; random queue).
- **Reviews list** includes real third-party content with dates back to 2025-12. Content is not controlled by tests.
- **Song duration strings** vary in format across endpoints (`"00:03:07"`, `"00:04:04.7151020"`, `"05:22"`).
- **Search** returned no data at all during this session, so no search test data can be derived from runtime.

## 5. Data dependencies per flow
| Flow | Needs |
|---|---|
| Browse / charts | Categories 1/2/10/26 with streams (present at run time) |
| Song detail + playback | A song with reachable S3 MP3 + LRC (song 1 works) |
| Favorite | Logged-in user; toggle is reversible |
| Review | Logged-in user who has **not** reviewed that song; the review is permanent |
| Stream | Logged-in user + 20 s real playback (network audio) |
| Registration (UI) | A real deliverable mailbox accepted by Abstract API - **not available** |
| Registration (API) | Unique username + unique email |

## 6. Browser storage keys observed
`localStorage`: `i18nextLng`, `selectedTheme`, `recsys_anon_id`, `recsys_consent_status`, `recsys_tracker_queue`, `recsys_cached_user_info` (after login). `sessionStorage`: `recsys_tracker_session`, `recsys-cache-<domainKey>`. Cookies: `RefreshToken` only (HttpOnly).
