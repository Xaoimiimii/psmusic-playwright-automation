# PSMusic - Test Data and Data Dependencies

Sources: `S:Models/Entities/*`, `S:Data/DBContext.cs`, `S:Migrations/DBContextModelSnapshot.cs`, repositories/services, client services. No secrets or credentials are recorded here.

## 1. Where data lives and how it is created

| Data | Store | Created by | Evidence |
|---|---|---|---|
| Users | PostgreSQL `User` table | `POST /api/auth/register` only | `AuthService.Register`; no seed code |
| Songs, artists, categories and their links | PostgreSQL `Song`, `Artist`, `Category`, `SongArtist`, `SongCategory` | **No API or code in the repo creates them** (read-only API; no seeding/import scripts; migration files only alter schema). Origin UNKNOWN (likely manual SQL/external tooling) | controllers/migrations |
| Favorites | `Favorite` | `POST /api/song/{id}/favorite-toggle` | |
| Ratings/reviews | `Rating` | `POST /api/rating/{id}/add-review` | |
| Streams | `Stream` | `POST /api/song/stream/{songId}` | |
| Playlists | `Playlist`, `SongPlaylist` (DbSet `SongPlaylist` not declared in `DBContext` DbSets but configured in `OnModelCreating`) | nothing (no API/UI) | |
| Search index docs | Elasticsearch indices `songs` and `artists`, both bulk-indexed from PostgreSQL at API startup | app | `ElasticSeeder` (since `d1a3c44`) |
| Active users | server memory | heartbeat / authenticated requests | `ActiveUserTracker` |
| Media files (mp3, lrc, images) | external URLs stored in columns | external | |
| Browser storage | `localStorage`: `selectedTheme`, (i18next language, library default); no token storage | client | `SettingsDropdown.jsx` |

## 2. Entity details

### User (`S:Models/Entities/User.cs`, `DBContext`)
- Columns: `Id` (PK), `Username` (required, **unique**), `Password` (required, BCrypt hash, entity `[MinLength(8)]`), `Email` (required, **unique**), `DisplayName` (required, `[MaxLength(30)]`), `AvatarURL` (nullable).
- Constraints: unique indexes on Email and Username (migration `add_unique_to_email_username`). Comparisons in the app are case-**sensitive** (`u.Username == username`, `u.Email == email`) - PostgreSQL default collation is case-sensitive, so `Foo` and `foo` are distinct (INFERRED).
- Relations: 1..* Favorites, 1..* Playlists, 1..* Ratings (via `Rating.UserId`; `Rating.User` navigation without configured cascade), 1..* Streams.
- Lifecycle: created once; no update/delete path exists. **Test users persist forever** unless cleaned via DB.
- Data needed for tests: unique username/email per test (email also must satisfy the UI's external Gmail validation for UI sign-up; API sign-up needs only a valid email format).

### Artist (`Artist.cs`)
`Id`, `Name` (required), `AvatarUrl` (nullable; column name `AvatarUrl`). Linked to songs via `SongArtist`. Popular artists require recent streams (7 days).

### Category (`Category.cs`)
`Id`, `Name` (required), `AvatarUrl` (nullable). Genre names are mapped from **database names** to translation keys by an explicit dictionary `GENRE_KEY_MAPPING` in `C:utils/genreTranslation.js` (e.g. `'Nhạc Trẻ'`->`genre_nhac_tre`, `'R&B'`->`genre_r_and_b`, `'K-Pop'`->`genre_k_pop`), so DB category names are expected to be those exact strings; unmapped names presumably fall back to the raw name (fallback code not read - INFERRED). This gives hints about likely real category names (Vietnamese and English).

### Song (`Song.cs`)
`Id`, `Name` (required), `LrcUrl` (nullable), `Mp3Url`, `AvatarUrl` (nullable), `Description`, `Duration` (`interval`, nullable). Migrations: `add_song_urls`, `add_item_description`, `add-song-duration`, `nullable-lrc`.
- **Visibility rule:** most listings/search/random/main-collab require `LrcUrl` non-empty; category lists and detail/player do not.

### SongArtist (`SongArtist.cs`)
Own `Id` (PK) + `SongId` + `ArtistId`. **`Id` order defines "main artist"** (lowest Id per song). Data creation order matters for tests that rely on main/collab.

### SongCategory (`SongCategory.cs`)
Composite PK (`SongId`, `CategoryId`).

### Favorite (`Favorite.cs`)
Composite PK (`UserId`,`SongId`), `IsFavorite` bool. Cascade delete from User and Song. A row remains after un-favoriting (`IsFavorite=false`).

### Rating (`Rating.cs`)
`Id`, `Value` (int, required), `Review` (string), `UserId`, `SongId`, `CreatedAt` (default `DateTime.UtcNow` from entity initializer). Cascade delete from Song. **No unique (User,Song) constraint, no check on Value.** `CreatedAt` is `timestamp` (kind UTC); display date `yyyy-MM-dd` (UTC date - a review created near midnight local time may show a different day; INFERRED).

### Stream (`Stream.cs`)
`Id`, `UserId`, `SongId`, `StreamedAt` (default UTC now). One row per counted playback. **Drives the "popular" lists**; no cleanup.

### Playlist / SongPlaylist
Defined but unused.

## 3. Data required per flow

| Flow | Minimum data |
|---|---|
| Home / Genres / Charts (non-empty) | >= 1 category and >= 1 artist with **a stream in the last 7 days** (`StreamedAt >= UTC now - 7d`); for genre sections, songs in those categories; ids 10/26 only affect ordering |
| Category page | category id with songs; artists whose main category (mode of their songs' categories) is that category |
| Artist page | artist with songs having non-empty `LrcUrl` for main/collab lists; for related artists a main category shared by others |
| Song detail / player / lyrics | song with `Mp3Url` reachable by the browser, `LrcUrl` reachable + CORS-permitting for `fetch`, cover URL |
| Search | Elasticsearch `songs` documents (fields `name`, `artists.name`, `category`, `mp3Url`, `duration`, etc.) and `artists` documents; consistency with PostgreSQL is not guaranteed |
| Favorites | signed-in user + songs; page lists only `IsFavorite=true` |
| Ratings | signed-in user + song; a second review by the same user via API is accepted |
| Popularity/stream recording | signed-in user, 20 s of playback (real audio time) or a direct API call |

## 4. Static vs dynamic data
- **Static/reusable (catalog):** songs, artists, categories, links (read-only via API; safe to reuse if the environment is stable).
- **Dynamic per test:** users (unique username/email), favorites, ratings, streams.
- **Time-dependent:** everything labelled "popular" (7-day window). A quiet environment will show empty Home/Genres/Charts (EmptyState). Test setup may need to create recent streams (via API with an authenticated user) - each stream row is permanent.
- **Cached:** `GET /song/popular` (server 10 min); client `DataCacheContext` (home, charts, explore, favorites) - TTL: `DataCacheContext` `CACHE_EXPIRATION = 15 * 60 * 1000` (15 minutes) using `Date.now()` timestamps for `homePage`, `topCharts`, `exploreCategories`, `favorites`, `popularCategories` (CONFIRMED). Note `setFavoritesData`/`getFavoritesData` semantic details for expiry were not traced. Cache is per page load (in-memory), cleared by `logout`.

## 5. Stale-data / consistency risks
1. Reviews and favorites accumulate; no API to delete -> counters (likes, reviews) monotonic; tests that assert absolute counts are fragile; assert relative deltas.
2. Elasticsearch indices are synced with PostgreSQL only at API startup (`ElasticSeeder`). A song added after startup is not searchable until the next restart; a deleted song stays searchable (the seeder never removes documents).
3. Popular lists change as streams are added; ordering assertions unstable.
4. `size` minimums differ by endpoint (10 for many; 1 for category songs); counts/paging depend on this.
5. Unaccent/ILIKE search functions exist in code but are unused by API; Elasticsearch behavior (fuzziness) may return loosely related items.
6. `Rating.CreatedAt` UTC dates vs local expectations.
7. Duplicate accounts: usernames/emails case-sensitive; `Email đã tồn tại` only on exact match.
8. Media URLs may go dead; CORS for lyrics/colour extraction depends on the media host.

## 6. Test-data recommendations (informational, not tests)
- Create users through the API (`POST /api/auth/register`) with unique generated username/email; the API path avoids the external email validator.
- Prefer read-only reuse of existing catalog items discovered at runtime; avoid depending on hard-coded ids (ids 10 and 26 are referenced by the chart ordering rule but their meaning is unknown).
- Record discovered stable ids/names in a future `docs/exploration/` runtime addendum after browser exploration.
- Obtain a DB snapshot or seed script from the SUT team (missing from repo).
