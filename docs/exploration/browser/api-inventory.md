# PSMusic - Runtime API Inventory (Browser Network Exploration)

Every endpoint below is **RUNTIME-OBSERVED**: it was captured in browser network traffic on 2026-09-30 against `https://localhost:7215`. This is **not** a complete API inventory. Endpoints that exist in source but were not triggered are listed in section 4 as NOT-OBSERVED. Where a purpose cannot be stated confidently it is marked **PURPOSE-UNKNOWN**.

Secret values (the `X-App-Service-Key` value, JWTs, cookie values, recsys domain key) are redacted.

## 0. Cross-cutting runtime behavior

| # | Observation | Evidence |
|---|---|---|
| X-1 | Every `/api/*` request from the SPA carries header `x-app-service-key: <redacted>`. Without it, or with a wrong value: **401** `{"message":"Unauthorized Access"}` (tested on `GET /api/category/popular`) | RUNTIME-OBSERVED |
| X-2 | After login, requests carry `Authorization: Bearer <jwt>` (seen on `/song/favorites`, `/stats/heartbeat`, `/song/{id}/detail` in SPA nav). Before login or right after a hard reload, requests go without it | RUNTIME-OBSERVED |
| X-3 | CORS: responses have `access-control-allow-origin: https://localhost:5174`, `access-control-allow-credentials: true`, `vary: Origin`; `server: Kestrel` | RUNTIME-OBSERVED |
| X-4 | JSON is camelCase | RUNTIME-OBSERVED |
| X-5 | Most GETs on page load are **sent twice** (e.g. `category/popular`, `artist/popular`, `auth/refresh`, `song/{id}/detail`) | RUNTIME-OBSERVED; cause RUNTIME-INFERRED (React StrictMode double effects in the dev server) |
| X-6 | Server messages are Vietnamese literals regardless of UI language | RUNTIME-OBSERVED |
| X-7 | An **invalid** bearer token on an anonymous endpoint (`GET /api/song/1/detail`) returns **200** (treated as guest), not 401 | RUNTIME-OBSERVED |
| X-8 | Paged list shape: `{ items: [...], page, limit, totalItems, totalPages }` | RUNTIME-OBSERVED |

---

## 1. Auth

### 1.1 `POST /api/auth/refresh` - RUNTIME-OBSERVED
- **Trigger:** every full page load (x2), and the axios 401 retry path (retry NOT-OBSERVED).
- **Request:** no body; relies on HttpOnly cookie `RefreshToken`.
- **Guest / no cookie:** `200 {"isSuccess":false,"message":"Refresh token không tìm thấy"}` (**HTTP 200 on failure**).
- **With valid cookie:** `200 {"isSuccess":true,"message":"Refresh thành công","token":"<jwt>","user":{...}}`. The two parallel calls on reload both succeeded.
- **Set-Cookie:** refresh rotation is INFERRED from the source; cookie attributes after login are in `authentication.md`.

### 1.2 `POST /api/auth/login` - RUNTIME-OBSERVED
- **Trigger:** Login form submit (only after client validation passes).
- **Request body:** `{ username, password }` (INFERRED from source; the UI request body was not captured).
- **Success:** `200 { isSuccess:true, message:"Đăng nhập thành công", token, user:{ id, username, email, displayName, avatarUrl } }`; sets cookie `RefreshToken`.
- **Unknown username:** `400 { isSuccess:false, message:"Tài khoản không tồn tại" }`.
- **Wrong password for an existing user:** NOT TESTED.

### 1.3 `POST /api/auth/register` - RUNTIME-OBSERVED (sent manually from the page context; see note)
- **Trigger in UI:** Register submit, but only after the external email check passes. The UI never reached this call in this session.
- **Request body used:** `{ username, password, email, displayName, avatarURL: null }` (shape taken from the repository docs, sent via `fetch` from the app origin with the service-key header).
- **Success:** `200 {"isSuccess":true,"message":"Đăng ký thành công"}` (no token, no cookie).
- **Duplicate username:** `400 {"isSuccess":false,"message":"Tài khoản đã tồn tại"}`.
- **Duplicate email:** `400 {"isSuccess":false,"message":"Email đã tồn tại"}`.
- Non-Gmail email (`@example.com`) **accepted by the API**; the Gmail rule is UI-only.

### 1.4 `POST /api/auth/logout` - RUNTIME-OBSERVED
- **Trigger:** user menu -> Logout. **Response:** 200. **Effect:** `RefreshToken` cookie removed from the browser.

### 1.5 `GET /api/auth/me` - RUNTIME-OBSERVED (manual probe only)
- Not called by the SPA in any explored flow. With service key and no token: **401**, empty body.

## 2. Songs

| # | Method + path | Trigger | Response (relevant) | Auth |
|---|---|---|---|---|
| 2.1 | `GET /api/song/category/popular/{categoryId}?page=1&size=10` | Genres page (x4 categories), Charts page (x4) | Paged; item `{ id, name, lrcUrl, mp3Url, avatarUrl, duration, artists:[{id,name}], isFavorited }`. `duration` mixes `"00:03:07"` and `"00:04:04.7151020"` | public |
| 2.2 | `GET /api/song/category/popular/{id}?id={id}&page=N&size=12` | Category page Songs grid + pagination (**redundant `id` query param**) | Paged. Unknown category: 200 (body not inspected) | public |
| 2.3 | `GET /api/song/{id}/detail` | Song page load | `{ id, title, artist (joined string), imageUrl, favorite, reviews, isFavorited, isReviewed, lyricUrl, audioUrl, duration "mm:ss" }`. Unknown id: **404** (UI "Song not found") | optional user |
| 2.4 | `GET /api/song/{id}/related` | Song page | Array of `{ id, title, imageUrl, mp3Url, ... }` (up to 30 rows rendered) | public |
| 2.5 | `GET /api/song/{id}/player` | Playback start / next / prev / Play All | `{ id, title, artist, coverUrl, singerUrl, likes, reviews, isFavorited, isReviewed, audioUrl, lyricUrl, duration }` | optional user |
| 2.6 | `GET /api/song/next-batch` | First playback start (queue fill) | Array of `{ id, title, artistNames[], coverUrl, singerUrl, ... }`; random-looking content | public |
| 2.7 | `GET /api/song/search?keyword=<q>&page=1&size=5` | Typing in the header search (suggestions) | `{ topResult, results, total, totalPages }`, **always `total:0`** in this session | public |
| 2.8 | `GET /api/song/search?keyword=<q>&page=1&size=12` | `/search?q=` page (sent x2) | Same shape, always empty | public |
| 2.9 | `GET /api/song/favorites` | `/favorites` page load; refetch after un-favoriting | Array of `{ id, title, imageUrl, lyricUrl, audioUrl, duration, artists:[{id,name,avatarUrl:""}] }` (not paged) | **token required**, 401 without |
| 2.10 | `POST /api/song/{id}/favorite-toggle` | Player heart click | `200 {"message":"Đã thêm vào yêu thích","isFavorited":true}` / `{"message":"Đã bỏ yêu thích","isFavorited":false}`; no request body | token |
| 2.11 | `POST /api/song/stream/{id}` | Automatically once playback reaches ~20 s (logged in) | 200, empty body. Not sent for guests during ~15 s of guest playback (the 20 s mark was not reached as guest, see unknowns) | token |
| 2.12 | `GET /api/song/artist/main/{artistId}?page=1&size=10` | Artist page | Paged. Unknown artist: 200 | optional user |
| 2.13 | `GET /api/song/artist/collab/{artistId}?page=1&size=10` | Artist page | Paged. Unknown artist: 200 | optional user |

## 3. Artists, categories, ratings, stats

| # | Method + path | Trigger | Response (relevant) | Auth |
|---|---|---|---|---|
| 3.1 | `GET /api/artist/popular` (Home, no params) / `?page=1&size=10` (Charts) | Home "Trending Artists"; Charts page (**fetched but not rendered**. Validation 2026-09-30: REPOSITORY-CONFIRMED that `TopChartsPage.jsx` stores `popularArtists` in state/cache but never renders it, so the call is unused on Charts) | Paged `{ id, name, avatarUrl }`; 9 items observed | public |
| 3.2 | `GET /api/category/popular?page=1&size=50` | Home / Genres tiles | Paged `{ id, avatarUrl, name }`; 4 items: 10 Nhạc Việt, 2 Nhạc Trẻ, 1 Pop, 26 Âu Mỹ (UI shows translated names) | public |
| 3.3 | `GET /api/category/{id}` | Category page | Unknown id: **204** No Content (UI renders a blank page) | public |
| 3.4 | `GET /api/artist/category/{id}?id={id}&page=1&size=10` | Category "Featured Artists" | Paged. Unknown category: 200 | public |
| 3.5 | `GET /api/artist/{id}` | Artist page | Unknown id: **204** (UI shows only a "Play" button) | public |
| 3.6 | `GET /api/artist/related/{id}` | Artist page | Unknown id: 200 | public |
| 3.7 | `GET /api/artist/{songId}/artists` | Song page "Artists" list (**path param is a song id**) | Array `{ id, name, avatarUrl }` | public |
| 3.8 | `GET /api/rating/{songId}/reviews` | Opening the rating modal | Array `{ id, user (display name), rating, comment, date "yyyy-MM-dd" }`, newest first | public |
| 3.9 | `POST /api/rating/{songId}/add-review` | Rating modal submit | Request `{"rating":3,"comment":"...","user":"<username>"}` (client also sends `user`. Validation 2026-09-30: the source sends `user: user?.username`, not the display name. The observed value was the test username, which equals its display name, and the server DTO `CreateRatingDTO` has no `user` field, so the server ignores it). Response `200 {"message":"Đánh giá thành công!"}` | token |
| 3.10 | `POST /api/stats/heartbeat` | Right after login, then periodically while logged in | 200, empty | token |
| 3.11 | `GET /api/stats/active-users` | Manual probe only (not called by the SPA in explored flows) | `200 { activeUsers, windowSeconds:120, timestamp }` | public (service key) |

## 4. NOT-OBSERVED in the browser (exist per repository docs; not triggered here)
`GET /api/song` (plain list), `GET /api/song/popular`, `GET /api/user/{id}`, the axios 401 -> refresh -> retry path, and any playlist endpoints. Their existence and behavior are UNKNOWN from runtime evidence.

## 5. Third-party requests (RUNTIME-OBSERVED, not PSMusic API)

| Method + URL | Trigger | Notes |
|---|---|---|
| `GET recsys-tracker-module-d8ty.onrender.com/domain/<key>`, `/rule/domain/<key>`, `/return-method/<key>`, `/rule/event-type`, `/search-keyword-config?domainKey=<key>`, `/domain/user-identity?key=<key>` | Every page load | Tracker configuration. PURPOSE-UNKNOWN in detail |
| `POST .../recommendation` -> 201 | Page load (x2 on song pages: `NumberItems` 50 and 10) | Body `{ AnonymousId, DomainKey, NumberItems, UserId? }`; response `{ item:[{ Id, DomainItemId (= PSMusic song id), Title, Description, ImageUrl, Categories, Artist }], search, lastItem }`. 50 -> popup, 10 -> in-page section. Details: `recommendations.md` |
| `POST .../evaluation` -> 201 | Clicking a recommendation card | Body `{ DomainKey, Rank }` (1-based card position); response `{ Id, DomainId, Rank, Timestamp }` |
| `GET emailreputation.abstractapi.com/v1/?api_key=<redacted>&email=<email>` -> 200 | UI Register submit | Response used: `email_deliverability.{status,status_detail,is_format_valid,is_smtp_valid}`, `email_sender.organization_name` |
| `GET psmusic.s3.ap-southeast-2.amazonaws.com/songs/LRC/...lrc` / `.../MP3/...mp3` | Song page / playback | |
| `GET https://localhost:5174/locales/{lng}/translation.json` | App start / language change | `en-US` returns 200 but is not JSON (console warning) |
