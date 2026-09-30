# PSMusic - API Inventory

Source: `PSMusic/PSMusic.Server` (`S:`), controllers in `S:Controllers`, plus the client callers in `C:` (`PSMusic/psmusic.client/src`). Everything is derived from source; **no request was sent**. Status codes marked *(default)* come from ASP.NET Core framework behavior, not from explicit code, and need runtime validation.

## 0. Cross-cutting behavior

| # | Behavior | Evidence | Confidence |
|---|---|---|---|
| X-1 | **Every request whose path starts with `/api` must contain header `X-App-Service-Key` (name from `ApiSecurity:HeaderName`, default `X-App-Service-Key`) equal to `ApiSecurity:SecretValue`**; otherwise `401` with JSON `{"message":"Unauthorized Access"}`. Applies to all endpoints, public or not. Not applied to `/swagger`. | `S:Middlewares/ApiAuthMiddleware.cs`, `S:Program.cs` (`UseMiddleware` after `UseCors`, before `UseAuthentication`) | CONFIRMED |
| X-2 | Client always sends that header (from `VITE_API_SIGNATURE`, else a literal fallback) and `withCredentials: true`; after login it sets `Authorization: Bearer <token>` as an axios default header | `C:services/axiosInstance.js`, `C:contexts/AuthContext.jsx` | CONFIRMED |
| X-3 | Auth = JWT bearer (issuer, audience, signing key, lifetime validated). Token may be read from cookie `AccessToken` if present (nothing in the repo sets that cookie). `[Authorize]` -> `401` when missing/invalid *(default)* | `S:Program.cs` | CONFIRMED |
| X-4 | JSON property naming is ASP.NET default camelCase (`isSuccess`, `token`, `items`, `totalPages`) - the client reads camelCase everywhere | client code, no custom `JsonOptions` in `Program.cs` | INFERRED (high) |
| X-5 | CORS policy `AllowFrontend` (credentials on) restricted to listed origins (see `application-overview.md`) | `S:Program.cs` | CONFIRMED |
| X-6 | `[ApiController]` on all controllers => invalid model binding / DataAnnotations failures return automatic `400` ProblemDetails/validation JSON *before* the action runs *(default)*. The manual `ModelState` check in `Register` is therefore probably unreachable | `S:Controllers/*` | INFERRED |
| X-7 | `Ok(null)` (returning a null object) yields `204 No Content` *(default)* - relevant to `GET /api/artist/{id}`, `/api/category/{id}` with unknown ids | `ArtistController.GetArtistDetail`, `CategoryController.GetById` | INFERRED |
| X-8 | Paged responses use `PagedResult<T>`: `{ items, page, limit, totalItems, totalPages }` | `S:Helpers/PagedResult.cs` | CONFIRMED |
| X-9 | Unhandled exceptions have no global handler (no exception middleware) -> `500` *(default)* | `S:Program.cs` | CONFIRMED (absence) |
| X-10 | Server user-facing `message` texts are Vietnamese literals regardless of UI language | controllers/services | CONFIRMED |
| X-11 | `UseHttpsRedirection()` is enabled; behind plain HTTP (docker port 7215->8080 HTTP) redirection may not trigger because no HTTPS port is configured (warning only) | `S:Program.cs`, `docker-compose.yml` | UNKNOWN |

Legend for auth column: **Public** = no `[Authorize]` (but X-1 header still required). `[Authorize]` = valid Bearer JWT required.

---

## 1. Auth - `api/auth` (`S:Controllers/AuthController.cs`)

### 1.1 `POST /api/auth/register` - Public
- **Body** (`CreateUserDTO`): `username` (required), `password` (required, min 8), `email` (required, EmailAddress), `displayName` (required, max 30), `avatarURL` (optional string).
- **Logic** (`AuthService.Register`): email exists -> fail; username exists -> fail; map to `User`; `SetPassword` (BCrypt); `UserRepository.Add` (returns false on `DbUpdateException`).
- **Responses:** `200 {isSuccess:true, message:"Đăng ký thành công"}`; `400 {isSuccess:false, message}` with messages `Email đã tồn tại`, `Tài khoản đã tồn tại`, `Tạo tài khoản thất bại`, and (if action reached) `Dữ liệu không hợp lệ.` See X-6.
- **Client:** `authService.register`, called only after the external email checks pass (`SignUp.jsx`); on failure the UI shows `error.response.data?.message` or "Đăng ký thất bại".
- **Notes:** no server-side check that email is Gmail (CONFLICT with UI rule). Username is not trimmed/normalized. `Password` property on entity has `[MinLength(8)]` - applied to the plain value before hashing? (`SetPassword` receives plain; entity validation on the hash is irrelevant).

### 1.2 `POST /api/auth/login` - Public
- **Body** (`AuthReqDTO`): `username` (required), `password` (required, min 8 - message "Password must be at least 8 characters").
- **Logic:** `GetUserByUsername`; not found -> fail; `BCrypt.Verify`; on success generate access token + refresh token.
- **Success:** `200 { isSuccess, message:"Đăng nhập thành công", token, user:{ id, username, email, displayName, avatarUrl } }` + `Set-Cookie: RefreshToken` (HttpOnly; Secure; SameSite=None; Path=/; Expires +7 days).
- **Failure:** `400 { isSuccess:false, message: "Tài khoản không tồn tại" | "Sai mật khẩu" }`. If the service returned success without `UserId` -> `401`.
- **Note:** `RefreshToken` is not in the response body. Distinct messages allow user enumeration.

### 1.3 `POST /api/auth/refresh` - Public (cookie-based)
- **Input:** cookie `RefreshToken` only; no body.
- **Responses (all HTTP 200 unless noted):**
  - no cookie: `{ isSuccess:false, message:"Refresh token không tìm thấy" }`
  - invalid/expired/wrong type: `{ isSuccess:false, message:"Refresh token không hợp lệ hoặc đã hết hạn" }` (also `Token không chứa thông tin người dùng`, `Người dùng không tồn tại`)
  - success: `{ isSuccess:true, message:"Refresh thành công", token, user:{...} }` and a **new** `RefreshToken` cookie (rotation, no server-side revocation list).
- **Client:** called on app start (`AuthContext`) and from the axios 401 interceptor (skipped for URLs containing `/refresh`).

### 1.4 `GET /api/auth/me` - `[Authorize]`
Returns `200 { id, username, email, displayName }`; `401` if claim/user missing. **No active caller** in the client (`getCurrentUser` only referenced in commented code). CONFIRMED unused.

### 1.5 `POST /api/auth/logout` - no `[Authorize]` attribute, but requires a valid token claim
- Reads `NameIdentifier` claim; missing -> `401`; user not found -> `401`; else deletes `RefreshToken` cookie (options depend on `Request.IsHttps`) and `200 { isSuccess:true, message:"Đăng xuất thành công" }`.
- Does not invalidate any token. Client ignores errors (returns success object).

---

## 2. Songs - `api/song` (`S:Controllers/SongController.cs`, `S:Services/Implementations/SongService.cs`, `S:Repositories/Implementations/SongRepository.cs`)

All action-level `[Authorize]` attributes on read endpoints are **commented out** (`//[Authorize]`), i.e. public. Only where marked below is auth required.

| # | Method & path | Auth | Purpose | Client caller |
|---|---|---|---|---|
| 2.1 | `GET /api/song?page=1&size=10` | Public | All songs having lyrics (`LrcUrl` non-empty), `PagedResult<SongDTO>`; `page<1`->1, `size<10`->10; **no explicit ordering** | none found |
| 2.2 | `GET /api/song/search?keyword&page=1&size=10` | Public | Elasticsearch search (songs+artists) | Header suggestions (size 5), SearchResultPage (size 12) |
| 2.3 | `GET /api/song/popular?page=1&size=10` | Public, **output-cached 600 s** vary `page,size` | songs with streams in last 7 days ordered by stream count desc, `PagedResult<SongSearchDetailDTO>` | none (call commented out in `homeService.js`) |
| 2.4 | `GET /api/song/next-batch?size=10` | Public | random songs with lyrics (`ORDER BY random() LIMIT size`) as `NextBatchSongDTO[]` | `PlayerControlService.getNextBatch` |
| 2.5 | `GET /api/song/artist/main/{id:int}?page&size` | Public (uses userId if token present) | songs where artist is the *main* artist | ArtistPage |
| 2.6 | `GET /api/song/artist/collab/{id:int}?page&size` | Public (userId optional) | songs where artist is a collaborator | ArtistPage |
| 2.7 | `GET /api/song/category/popular/{id:int}?page&size` | Public (userId optional) | songs of a category ordered by total streams desc | CategoryPage, Explore, TopCharts |
| 2.8 | `GET /api/song/{songId}/detail` | Public (userId optional) | song detail for the detail page | SongViewPage |
| 2.9 | `GET /api/song/{id}/related` | Public | up to 30 other songs sharing an artist | SongViewPage |
| 2.10 | `GET /api/song/{songId}/player` | Public (userId optional) | player data | `PlayerControlService.getPlayerData` |
| 2.11 | `GET /api/song/favorites` | `[Authorize]` | current user's favorited songs | FavoriteSongsPage |
| 2.12 | `POST /api/song/{id}/favorite-toggle` | `[Authorize]` | toggle favorite | PlayerControl (and unused TopCharts handler) |
| 2.13 | `POST /api/song/stream/{songId:int}` | `[Authorize]` | record one stream | `PlayerControlService.streamSong` (PlayerContext after 20 s) |

### 2.2 Search details
- **Params:** `keyword` (string, not validated - null/empty behavior UNKNOWN), `page` (<1 -> 1), `size` (<10 -> 10; **so the header's `size=5` request is raised to 10** - CONFIRMED in `SongService.SearchAll`).
- **Logic:** `EnsureArtistsIndexed()` (one-time per process: if index `artists` empty, index all artists from PostgreSQL; failures swallowed) -> songs query on ES index `songs` (`from=(page-1)*size, size`; bool.should: `multi_match` fields `name^3, artists.name^2, category^1.5` fuzziness AUTO; `term name.keyword` case-insensitive boost 10) -> artist query on index `artists` (`from 0`, same `size`; `match name` fuzziness AUTO + keyword term boost 10).
- **Result assembly:** artists first then songs; the first hit whose name equals the keyword (ordinal ignore case) becomes `topResult` and is removed from `results`; results sorted by type (artist=0, song=1) (stable LINQ `OrderBy`).
- **Response:** `{ topResult|null, results:[{ type:"artist"|"song", id, name, avatarUrl, mp3Url, duration, artists:[{id,name}] }], total, totalPages }`. `totalPages = ceil((totalSongs+totalArtists)/size)`.
- **Behaviors/risks (CONFIRMED in code):** artist results are **not paginated** (always `from 0`) while song results are; `totalPages` mixes both totals; `mp3Url` of artist is null; `duration` is `TimeSpan` (JSON string like `"00:03:46"`, parsed with `TimeSpan.TryParse` from a document string). If ES call fails, `IsValidResponse` false -> empty results with `totalPages` 0 (no exception). Client `SongRow.formatDuration` handles `"hh:mm:ss[.ms]"` and `"mm:ss"` forms - consistent with this.
- **Index `songs` population:** no code indexes songs (only `artists` are indexed). UNKNOWN who fills it.
- **Repository has a PostgreSQL ILIKE/unaccent alternative** (`SongRepository.Search/SearchPaging`, `ArtistRepository.Search/SearchPaging`, `SongService.SearchByName`), but **no controller uses it** (the older `SearchAll` implementation is commented out). CONFIRMED unused.

### 2.5 / 2.6 main vs collab
- Main: songs (from `GetAll()`, i.e. **only with lyrics**) where the artist's `SongArtist.Id` equals the **minimum** `SongArtist.Id` among the song's artists. `size<10` -> 10 for main only; collab has **no** min-size/page correction. Response items are `SongWithArtistRole` (`id,name,lrcUrl,mp3Url,avatarUrl,duration,artists[],isFavorited,type:"Main"|"Collab"`), `isFavorited` true only if valid token present and favorite flagged. In-memory pagination (`Paginate` after `ToList`), **no ordering clause** (despite the "popular" naming).
- **Query param name conflict:** none; CategoryPage also sends a redundant `id` query param (ignored).

### 2.7 Category songs
- `page<1`->1, `size<1`->10 (min 1 here, unlike others). Order by number of streams (all time, not 7 days) desc. **Not filtered by lyrics** (filter commented out). DB-side paging. `SongSearchDetailDTO` items with `isFavorited` per user. CONFLICT with other lists on lyrics filter (see business-rules).

### 2.8 Detail (`SongDetail2DTO`)
Response `{ id, title, artist (names joined ", "), imageUrl, favorite (count where IsFavorite), reviews (count of ratings), isFavorited, isReviewed, lyricUrl, audioUrl, duration ("mm:ss" or "00:00") }`. `404 {message:"Không tìm thấy bài hát"}` when not found. **Not filtered by lyrics**. `userId` is derived from JWT claim if present (`0` otherwise).

### 2.9 Related
Returns `RelatedSongDTO[]`: `{ id, title, imageUrl, mp3Url, duration, artist, artists:[{id,name}] }`. Songs sharing any artist except itself, `Distinct().Take(30)` (order undefined). Empty array if none. Does not 404 for unknown id.

### 2.10 Player data (`SongPlayerDTO`)
`{ id, title, artist, coverUrl, singerUrl (= song AvatarUrl, not the artist's), likes, reviews, isFavorited, isReviewed, audioUrl, lyricUrl, duration }`. Anonymous (`userId<=0`) branch sets `isFavorited/isReviewed=false`. `404 {message}` if missing.

### 2.11 Favorites list
`200 FavoriteSongDTO[]`: `{ id, title, imageUrl, lyricUrl, audioUrl, duration, artists:[{id,name,avatarUrl}] }` where `Favorite.IsFavorite == true`. **No ordering**. `400 {message:"UserId không hợp lệ"}` if claim missing/invalid (after `[Authorize]` passes).
**Client note:** `FavoriteSongsPage` maps `song.audioUrl || song.mp3Url` and `song.artists[]` - consistent.

### 2.12 Toggle favorite
`200 { message: "Đã thêm vào yêu thích" | "Đã bỏ yêu thích", isFavorited: bool }`; `400 { message:"Lỗi xử lý: ..." }` on exception (e.g. unknown song id -> FK violation, INFERRED). Repository: find `(userId, songId)`; if none insert `IsFavorite=true`; else flip flag. Not atomic (read-then-write; concurrent toggles may race/duplicate key) - INFERRED.

### 2.13 Stream
`200` (empty body) if inserted; `400` (empty) on exception (e.g. FK/unknown song). No de-duplication or rate limit server-side. `userId` from claim (`int.Parse`).

---

## 3. Artists - `api/artist` (`S:Controllers/ArtistController.cs`)

| # | Method & path | Auth | Purpose / response | Client |
|---|---|---|---|---|
| 3.1 | `GET /api/artist/popular?page=1&size=10` | Public | artists with streams in the last 7 days ordered by 7-day streams desc; `PagedResult<ArtistDTO{id,name,avatarUrl}>` (no min/max correction) | Home, TopCharts |
| 3.2 | `GET /api/artist/{id:int}` | Public | `ArtistDTO`; unknown id -> `Ok(null)` -> 204 (INFERRED) | ArtistPage |
| 3.3 | `GET /api/artist/related/{id:int}` | Public | artists sharing the artist's *main category*, excluding self; returns plain array (not paged); `Ok()` empty 200 when artist has no category | ArtistPage |
| 3.4 | `GET /api/artist/{id}/artists` | Public | **`id` is a SONG id** (route is misleading): artists of a song (`SongArtist` join) -> `ArtistDTO[]` | SongViewPage (`/artist/${songId}/artists`) |
| 3.5 | `GET /api/artist/category/{id:int}?page&size` | Public | artists whose main category is `id`, in-memory `Paginate(page,size)` | CategoryPage |

Route ambiguity: `GET /api/artist/{id:int}` vs `GET /api/artist/{id}/artists` and `related/{id:int}` differ in shape; no conflict found (CONFIRMED by reading attributes). "Main category of an artist" = category with highest count of the artist's songs (two implementations: `ArtistRepository.GetArtistsByMainCategory` per-artist subquery and `CategoryRepository.GetMainCategoryOfAnArtist`; tie-breaking is unspecified - potential inconsistency).

## 4. Categories - `api/category` (`S:Controllers/CategoryController.cs`)

| # | Method & path | Auth | Purpose |
|---|---|---|---|
| 4.1 | `GET /api/category/popular?page=1&size=10` | Public | categories with >=1 stream in the last 7 days ordered by 7-day streams desc; `PagedResult<CategoryDTO{id,avatarUrl,name}>` |
| 4.2 | `GET /api/category/{id:int}` | Public | `CategoryDTO`; unknown -> `Ok(null)` -> 204 (INFERRED) |
**Important consequence:** categories/artists with **zero streams in the last 7 days are never returned** by popular endpoints, so the Home/Genres/Charts content depends on recent stream data (time-dependent). CONFIRMED.

## 5. Ratings - `api/rating` (`S:Controllers/RatingController.cs`)

| # | Method & path | Auth | Behavior |
|---|---|---|---|
| 5.1 | `GET /api/rating/{songId}/reviews` | Public | `200 RatingDTO[]` `{ id, user (DisplayName), rating, comment, date "yyyy-MM-dd" }` ordered by `CreatedAt` desc. Unknown song -> empty array |
| 5.2 | `POST /api/rating/{id}/add-review` | `[Authorize]` | Body `CreateRatingDTO { rating:int, comment:string }` (`userId`,`songId` overwritten from token/route). `200 { message:"Đánh giá thành công!" }`; `400 { message: ex.Message }` on exception or invalid `UserId` (`UserId không hợp lệ`). |
**Validation: none server-side** for rating range, comment length, duplicates (one review per user per song enforced only in the UI). Response does not contain the new review (client synthesizes it). Unknown song id -> FK error -> 400 with exception message (INFERRED). `Rating.Review` non-null string (empty comment ok).

## 6. Stats - `api/stats` (`S:Controllers/StatsController.cs`)
| # | Method & path | Auth | Behavior |
|---|---|---|---|
| 6.1 | `POST /api/stats/heartbeat` | `[Authorize]` | marks user active (in-memory); `200` empty; `400` if claim missing. Client calls every 45 s while tab visible and on visibility change |
| 6.2 | `GET /api/stats/active-users?windowSeconds=120` | Public | `{ activeUsers, windowSeconds, timestamp }`; `windowSeconds<=0` -> 120. Also, **every successfully validated JWT request** marks the user active (`OnTokenValidated`). No client caller found |

## 7. Users - `api/user`
| 7.1 | `GET /api/user/{id:int}` | `[Authorize]` | Returns `UserDTO { id, username, email, displayName, avatarURL }` for **any** id; `404` (empty) if missing. No ownership check (any authenticated user can read any profile). Client `userService.getUserById` exists but has no caller found |

---

## 8. Endpoints with no evidence of use / possibly internal
`GET /api/song`, `GET /api/song/popular`, `GET /api/auth/me`, `GET /api/user/{id}`, `GET /api/stats/active-users` have no client callers (CONFIRMED by grep). `PSMusic.Server.http` contains only a leftover template call to `/weatherforecast/` which does not exist in the code (CONFIRMED).

## 9. Data-shape notes the client depends on
- Login/refresh: `res.data.token`, `res.data.user` (`AuthContext` sets `user` from `res.user`; `Header` reads `user.avatarUrl`; `UserDropdown` reads `user.displayName`). **Login/refresh user object uses `avatarUrl`; `UserDTO`/`GET /api/user/{id}` uses `avatarURL`** (casing differs) - CONFIRMED in `AuthController` vs `UserDTO`.
- Lists: `items`, `totalPages`.
- Favorite toggle: `isFavorited`.
