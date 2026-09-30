# PSMusic - Application Overview (Browser Runtime Exploration)

Scope: findings from **driving the running application in a browser** (Playwright MCP, Chromium 154, viewport 1037x583) on 2026-09-30. No SUT code or configuration was changed. Complements `../repository/` (source-derived) and `../documentation/`.

Evidence labels used in every file of this folder:
- **RUNTIME-OBSERVED** - seen directly in the rendered page, DOM, console, storage, or network traffic during this session.
- **RUNTIME-INFERRED** - a conclusion drawn from runtime observations, not proven.
- **NOT-OBSERVED** - looked for and not seen, or exists but was not exercised.
- **UNKNOWN** - cannot be determined from the browser.
- **NOT TESTED** - deliberately not exercised (scope, safety or time).

Secrets policy: the app-level API key header value, JWT access/refresh tokens, cookie values, the recsys domain key, third-party API keys and passwords were seen in traffic but are **not reproduced** here. Other people's review author names and comments are not reproduced either.

---

## 1. Environment explored (authorized by the project owner for this session)

| Item | Value | Evidence |
|---|---|---|
| UI entry point | `https://localhost:5174/` (Vite dev server, HTTPS, served from `D:\Study\PSMusic\PSMusic\psmusic.client`) | RUNTIME-OBSERVED |
| API base | `https://localhost:7215/api` (Kestrel, `PSMusic.Server.exe` Debug build; also listening on `http://localhost:5006`) | RUNTIME-OBSERVED |
| Swagger UI | `https://localhost:7215/swagger/index.html` returns 200 (not explored) | RUNTIME-OBSERVED |
| Database | Local API connects to a **remote** hosted PostgreSQL (Neon, `ap-southeast-1`) configured in the SUT's `appsettings.Development.json`; search uses a cloud Elasticsearch | RUNTIME-INFERRED (host names read from config, not from traffic) |
| Out of scope | `localhost:5173` belongs to a different project (Foodly) and was not touched. Netlify hosts listed in the SUT's CORS config were not accessed | - |

**Consequence:** every write performed through this local UI (users, favorites, reviews, streams) lands in a remote database whose other consumers are UNKNOWN. See `test-data.md` for the exact data this session created.

## 2. Application shape (RUNTIME-OBSERVED)

- Single-page React app. Route changes happen client-side; the document title stays `PSMusic` on every route.
- **Layout:** left sidebar (logo + 4 nav links), top header (back/forward arrows, search box, language, theme, Login/avatar), `main` content, footer (`contentinfo`), and a fixed-position player bar that appears only after playback starts.
- `/auth` is a separate full-screen layout without the sidebar, header or footer, with only a Language button.
- **Language:** i18next with 5 languages (Tiếng Việt, English, 日本語, Русский, Deutsch), chosen from the header and stored in `localStorage.i18nextLng`. The default was `en-US` in this browser (detected). All visible labels, including accessible names, change with language.
- **Theme:** 6 colour themes (Ruby, Amethyst, Sapphire, Emerald, Topaz, Aquamarine), stored in `localStorage.selectedTheme` and applied as CSS variables on `<html style>`.
- **Server messages are Vietnamese regardless of UI language** (e.g. `Tài khoản không tồn tại`, `Đăng ký thành công`). The rating modal and `/recent` page are hard-coded Vietnamese even in English UI.

## 3. Major pages / routes observed

| Route | Page | Auth | Evidence |
|---|---|---|---|
| `/` | Discover (Home): genre tiles, Trending Artists, Recommends for you | public | RUNTIME-OBSERVED |
| `/genres` | Genres & Topics: 4 genre tiles + "Discover <Genre> Genre" song grids | public | RUNTIME-OBSERVED |
| `/charts` | Charts: 4 "Top <Genre>" ranked lists (10 rows each) | public | RUNTIME-OBSERVED |
| `/category/:id` | Category page: title, Featured Artists (paged), Songs grid (paged, 12/page) | public | RUNTIME-OBSERVED |
| `/artist/:id` | Artist page: name, Play, Main Songs (paged), Collaboration Songs, Related Artists | public | RUNTIME-OBSERVED |
| `/song/:id` | Song detail: title, artists, favorite/review counters, Play, Download, Lyrics, Artists, Other songs by…, Recommends for you | public | RUNTIME-OBSERVED |
| `/search?q=` | Search results with All / Songs / Artists tabs | public | RUNTIME-OBSERVED |
| `/auth` | Login / Create Account sliding panel | public | RUNTIME-OBSERVED |
| `/favorites` | Favorite Playlist | **guest -> redirect `/auth`** | RUNTIME-OBSERVED |
| `/recent` | Stub page titled "Nghe Gần Đây" only | **guest -> redirect `/auth`** | RUNTIME-OBSERVED |
| any unknown path | Empty main area; console warns `No routes matched location` | public | RUNTIME-OBSERVED |

## 4. Major features observed

| Feature | Status in this session |
|---|---|
| Browse genres / charts / categories / artists / songs | RUNTIME-OBSERVED, working |
| Audio playback + player bar (shuffle, prev, play/pause, next, repeat, rate, download, volume, seek, favorite) | RUNTIME-OBSERVED; prev/next/play/pause/favorite/rate exercised |
| Lyrics on song page (LRC fetched from S3) | RUNTIME-OBSERVED |
| Search | **Returns zero results for every query tried** (see `business-rules.md` BR-S1) |
| Login / logout / session restore | RUNTIME-OBSERVED, working |
| Registration via UI | Blocked for synthetic emails by external validation (see `authentication.md`) |
| Favorites (toggle, list, Play All) | RUNTIME-OBSERVED, working |
| Rating + review | RUNTIME-OBSERVED, working; one review per user enforced by the UI |
| Stream counting | RUNTIME-OBSERVED (one `POST /api/song/stream/{id}` after ~20 s playback) |
| Language / theme switch | RUNTIME-OBSERVED |
| Third-party "recsys" tracker: privacy banner, recommendation popup, "Recommends for you" | RUNTIME-OBSERVED (affects automation, see `automation-considerations.md`) |

## 5. Third-party runtime dependencies (RUNTIME-OBSERVED in network)

| Host | Use |
|---|---|
| `recsys-tracker-module-d8ty.onrender.com` | Tracker config (`/domain/*`, `/rule/*`, `/return-method/*`, `/search-keyword-config`, `/domain/user-identity`) and `POST /recommendation` (201) that feeds "Recommends for you" and a popup |
| `psmusic.s3.ap-southeast-2.amazonaws.com` | MP3 and LRC files |
| `image-cdn.nct.vn`, `i.scdn.co` | Cover / avatar images |
| `emailreputation.abstractapi.com` | Email validation during UI sign-up |

## 6. Related files
`pages-and-locators.md`, `api-inventory.md`, `user-flows.md`, `authentication.md`, `test-data.md`, `business-rules.md`, `automation-considerations.md`, `browser-unknowns.md`, `recommendations.md` (focused pass on the third-party recommendation feature). Screenshots: `evidence/`.
