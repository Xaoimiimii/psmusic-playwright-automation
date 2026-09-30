# PSMusic - Application Overview (Repository Exploration)

Scope: findings derived **only from source code and repository files** of the SUT at `D:\Study\PSMusic` (git repo root; app under `PSMusic/`). No runtime was started. Nothing in the SUT was modified.

Confidence labels: **CONFIRMED** (directly seen in source), **INFERRED** (strongly suggested, not proven), **UNKNOWN** (repo does not say), **CONFLICTING** (sources disagree), **N/A**.

Path shorthand used in all exploration docs:
- `C:` = `PSMusic/psmusic.client/src/`
- `S:` = `PSMusic/PSMusic.Server/`
- `ROOT:` = `PSMusic/` (contains `docker-compose.yml`, `PSMusic.sln`)

Security note: the repo contains committed credential-like values (`ROOT:docker-compose.yml`, `S:appsettings*.json`, a tracking key in `psmusic.client/index.html`, `psmusic.client/.env`). **They are intentionally not reproduced in these docs.** Obtain them through the team's normal channel.

---

## 1. Repository layout

| Item | Location | Confidence |
|---|---|---|
| Git repo root | `D:\Study\PSMusic` (`.git`, `README.md`, `.gitattributes`, `.gitignore`, `.vscode/settings.json`) | CONFIRMED |
| Solution | `ROOT:PSMusic.sln` (server + `psmusic.client.esproj`) | CONFIRMED |
| Frontend | `ROOT:psmusic.client/` | CONFIRMED |
| Backend | `ROOT:PSMusic.Server/` | CONFIRMED |
| Docker orchestration | `ROOT:docker-compose.yml` | CONFIRMED |
| Automated tests in SUT | none found (no test project/folder, no test scripts in `package.json`) | CONFIRMED (absence) |
| Requirement docs | none besides root `README.md` (Vietnamese feature list) | CONFIRMED |
| Git history | ~15+ commits; PR-style merges from branches `fe/enhance-category`, `fix/datfixbug`; GitHub repo `FlyingCat04/PSMusic` (from merge messages) | CONFIRMED |

## 2. Components

### 2.1 Frontend SPA - `psmusic.client`
- **Location:** `ROOT:psmusic.client/` (entry `index.html` -> `C:main.jsx` -> `C:App.jsx`).
- **Responsibility:** user-facing music streaming UI (browse, search, play, favorites, ratings).
- **Stack:** React 19.1, Vite 7.1 (`vite.config.js`: react plugin + `vite-plugin-mkcert`), react-router-dom 7, axios, i18next (+ http backend + browser language detector), react-hot-toast, lucide-react, `@hello-pangea/dnd` (drag & drop), `color-thief-browser` (dominant colour). CSS Modules for styling. JavaScript (no TypeScript). CONFIRMED (`package.json`).
- **Providers (main.jsx):** `BrowserRouter` > `DataCacheProvider` > `AuthProvider` > `PlayerProvider` > `App`. CONFIRMED.
- **Build/package:** npm (`package-lock.json`), scripts `dev`, `build`, `lint`, `preview`. CONFIRMED.
- **Deploy configs:** `Dockerfile` (node:20-alpine build -> nginx:alpine, port 80), `nginx.conf` (SPA fallback to `index.html`, 1-year cache for assets, no-cache for html), `netlify.toml` + `public/_redirects` (Netlify SPA redirect). CONFIRMED.
- **Third-party runtime dependencies (browser):**
  - External email-reputation HTTP API (Abstract API) called from sign-up (`C:services/emailValidationService.js`). CONFIRMED.
  - External tracking SDK script `tracking-sdk.s3-ap-southeast-2.amazonaws.com/dist/loader.js` and `window.__RECSYS_DOMAIN_KEY__` in `index.html` (purpose: recommendation/tracking - INFERRED from the name; behavior UNKNOWN).
  - Song audio (`Mp3Url`), lyric (`LrcUrl`) and image URLs are fetched from whatever URLs are stored in the database (hosting UNKNOWN).
  - A hard-coded fallback image `cdn.pixabay.com/...` used in several components. CONFIRMED.
  - Footer social links all point to one YouTube URL (placeholder content). CONFIRMED.

### 2.2 Backend API - `PSMusic.Server`
- **Location:** `ROOT:PSMusic.Server/`. **Entry:** `S:Program.cs`.
- **Responsibility:** REST API for catalog, search, auth, favorites, ratings, stream statistics.
- **Stack:** ASP.NET Core Web API, `net8.0`, EF Core 9 + Npgsql (PostgreSQL), AutoMapper 12, BCrypt.Net-Next, `Microsoft.AspNetCore.Authentication.JwtBearer` 8, Elastic.Clients.Elasticsearch 9.3, Swashbuckle 6.6. CONFIRMED (`PSMusic.Server.csproj`).
- **Layers (CONFIRMED):** `Controllers/` -> `Services/(Interfaces|Implementations)` -> `Repositories/(Interfaces|Implementations)` -> `Data/DBContext.cs`; DTOs in `Models/DTO`, entities in `Models/Entities`, AutoMapper `Mappings/MappingProfile.cs`, helpers `Helpers/` (paging), middleware `Middlewares/ApiAuthMiddleware.cs`, EF `Migrations/` (13 migrations, Nov 2025 - Feb 2026).
- **SPA hosting:** csproj references the client via `SpaProxy` (dev: `npm run dev`, `SpaProxyServerUrl https://localhost:51743`); `Program.cs` has `UseDefaultFiles/UseStaticFiles/MapFallbackToFile("/index.html")`. Docker deployment runs client and server as separate containers, so the server does not serve the SPA there. CONFIRMED.
- **Launch profiles (`Properties/launchSettings.json`):** `http` `http://localhost:5006`; `https` `https://localhost:7215;http://localhost:5006`; IIS Express `http://localhost:38519`; Docker profile. Opens `/swagger`. CONFIRMED.

### 2.3 Data stores and external services
| Component | Evidence | Notes |
|---|---|---|
| PostgreSQL | `Npgsql.EntityFrameworkCore.PostgreSQL`, `UseNpgsql(ConnectionStrings:DBConnection)`; queries use `EF.Functions.ILike` and `Unaccent` (requires Postgres `unaccent` extension) | Connection string in git-ignored `appsettings.Development.json`/env `DB_CONNECTION`; server location UNKNOWN. CONFIRMED |
| Elasticsearch (cloud) | `Program.cs` builds `ElasticsearchClient` from `Elasticsearch:Uri/DefaultIndex/ApiKey`; **throws at startup if section missing** | Indices `songs` (read) and `artists` (auto-filled). CONFIRMED |
| In-memory active-user tracker | `S:Services/Implementations/ActiveUserTracker.cs` (singleton `ConcurrentDictionary`) | Not persisted; resets on restart. CONFIRMED |
| Output cache | `AddOutputCache()`/`UseOutputCache()`; used on `GET /api/song/popular` (600 s, vary by `page,size`) | CONFIRMED |
| Media/asset hosting | URLs stored in DB columns `Mp3Url`, `LrcUrl`, `AvatarUrl` | Host UNKNOWN |

### 2.4 Authentication / authorization components
See `authentication.md`. Summary: JWT bearer access token (60 min) + HttpOnly refresh cookie (default 7 days), a static shared-secret request header on every `/api` call, no roles. CONFIRMED.

### 2.5 Configuration and environments
| Setting | Where | Notes |
|---|---|---|
| `Jwt:Key/Issuer/Audience/ExpiryMinutes(/RefreshExpiryMinutes)` | `S:appsettings.json` (git-ignored) or env `Jwt__*` (docker-compose) | `RefreshExpiryMinutes` default 10080 in code |
| `ApiSecurity:HeaderName/SecretValue` | `S:appsettings.json`, env `ApiSecurity__*` | header default `X-App-Service-Key` |
| `ConnectionStrings:DBConnection` | `appsettings.Development.json`, env | |
| `Elasticsearch:Uri/DefaultIndex/ApiKey` | `appsettings.Development.json`, env | |
| Client: `VITE_API_BASE_URL`, `VITE_API_SIGNATURE`, `VITE_ABSTRACT_API_KEY` | `psmusic.client/.env` (git-ignored), docker build args | `VITE_*` are baked at build time. `VITE_API_SIGNATURE` falls back to a literal in code when unset |
| CORS | `Program.cs` policy `AllowFrontend`: Development -> `http(s)://localhost:5173`, `https://localhost:5174`, one LAN IP; otherwise -> `psmusic.netlify.app`, `dev--psmusic.netlify.app`, one LAN IP; credentials allowed | CONFIRMED |
| Environment behavior | Swagger only in `Development`; `UseHttpsRedirection()` always | CONFIRMED |
| Docker ports | server host `7215` -> container `8080` (HTTP, `ASPNETCORE_ENVIRONMENT=Development`); client host `5173` -> container `80` | CONFIRMED (`docker-compose.yml`) |
| Feature flags | none found | CONFIRMED (absence) |

**Environment/URL matrix (CONFIRMED from files; which is the test target is UNKNOWN):**
- Docker compose: UI `http://localhost:5173`, API `http://localhost:7215/api` (built into client via arg).
- Visual Studio: API `https://localhost:7215` or `http://localhost:5006`; Vite dev server default origin is `https://localhost:5173` (mkcert) per CORS list; `SpaProxyServerUrl` states `https://localhost:51743` (CONFLICTING with the CORS list; which is used depends on how it is launched - UNKNOWN).
- Netlify production/dev hosts exist in CORS list only.

### 2.6 Architectural boundaries
- Client <-> API over HTTP/JSON with axios (`withCredentials: true`, header `X-App-Service-Key`, `Authorization: Bearer` set after login). CONFIRMED.
- The browser talks directly to the third-party email API and to media hosts. CONFIRMED.
- All server-side user-facing strings are Vietnamese literals; UI strings come from i18n JSON (`public/locales/{en,vi,jp,ru,ger}/translation.json`) - with several **hard-coded Vietnamese strings in the client** (e.g. `RatingModal`, some fallbacks). CONFIRMED.

## 3. Domain model (short)
Entities: `User`, `Artist`, `Category`, `Song`, `SongArtist` (own `Id`), `SongCategory`, `Favorite`, `Rating`, `Stream`, `Playlist`, `SongPlaylist`. Details in `test-data.md`. `Playlist`/`SongPlaylist` have DB sets but no controllers/services/UI. CONFIRMED.

## 4. What is not in the repository
No admin tooling, no data seeding code, no seed SQL, no import scripts, no CI workflow files (`.github` absent), no automated tests, no API spec file besides Swagger auto-generation (`S:PSMusic.Server.http` exists - not analysed as authoritative). Catalog data origin is therefore UNKNOWN.
