# PSMusic - Business Rules (as implemented)

Every rule cites its source. Type column: **EXPLICIT** = deliberately coded rule/validation/message; **IMPL** = behavior emerging from implementation (may not be intended); **INFERRED** = deduced, not directly coded. "Layer": C=client, S=server. Paths: `C:` = `PSMusic/psmusic.client/src/`, `S:` = `PSMusic/PSMusic.Server/`.

## A. Accounts and authentication
| ID | Rule | Type | Layer | Source |
|---|---|---|---|---|
| A1 | Username must be unique | EXPLICIT | S | `AuthService.Register` (`Tài khoản đã tồn tại`), unique index in `DBContext` |
| A2 | Email must be unique | EXPLICIT | S | `AuthService.Register` (`Email đã tồn tại`), unique index |
| A3 | Password >= 8 chars at registration and login | EXPLICIT | C+S | `SignIn.jsx`, `SignUp.jsx`, `AuthReqDTO`, `CreateUserDTO` |
| A4 | DisplayName <= 30 chars (required) | EXPLICIT | S | `CreateUserDTO`, `User` |
| A5 | UI sets displayName = username; therefore a username > 30 chars is likely rejected | IMPL | C+S | `SignUp.jsx` (`displayName: name`) |
| A6 | Sign-up UI accepts only emails passing an external deliverability check and identified as Gmail | EXPLICIT (UI) | C | `SignUp.jsx`, `emailValidationService.js`; server has no such rule (CONFLICTING) |
| A7 | Email format valid (`EmailAddress`) | EXPLICIT | S | `CreateUserDTO` |
| A8 | Passwords stored as BCrypt hashes | EXPLICIT | S | `User.SetPassword` |
| A9 | Login message distinguishes unknown user vs wrong password | IMPL | S | `AuthService.Login` |
| A10 | Access token valid 60 min; refresh token 7 days (default); refresh rotates token | EXPLICIT/IMPL | S | `TokenGenerator`, `appsettings`, `AuthController` |
| A11 | Every `/api` call requires the shared header `X-App-Service-Key` | EXPLICIT | S | `ApiAuthMiddleware` |
| A12 | Favorites page and `/recent` are for signed-in users only | EXPLICIT | C | `App.jsx`, `PrivateRoute.jsx` |
| A13 | Guests trying Favorites (sidebar), heart, rate get a sign-in prompt | EXPLICIT | C | `Sidebar.jsx`, `PlayerControl.jsx`, `AuthModal.jsx` |
| A14 | Registration does not sign the user in | IMPL | C | `SignUp.jsx` |
| A15 | No roles/permissions; any authenticated user is equal | IMPL | S | no role claim/policy; `TokenGenerator` role commented out |

## B. Catalog visibility and ordering
| ID | Rule | Type | Source |
|---|---|---|---|
| B1 | "Popular" categories/artists/songs = those with streams in the last 7 days (UTC), ordered by that 7-day stream count desc; entries with 0 recent streams are **excluded** | EXPLICIT | `CategoryRepository.GetCategoriesWithStreamsLast7Days`, `ArtistRepository.GetArtistsWithStreamsLast7Days`, `SongRepository.GetSongsWithStreamsLast7Days` |
| B2 | Songs without lyrics URL (`LrcUrl` null/empty) are excluded from: `GET /song`, popular songs, next-batch (random), search-by-DB, main/collab artist lists | EXPLICIT | `SongRepository` (`Where(!string.IsNullOrEmpty(LrcUrl))`) |
| B3 | Songs without lyrics are **not** excluded from: category song lists, song detail, player data, related songs, favorites | IMPL / CONFLICTING with B2 | `GetPopularSongWithCategoryQuery` (filter commented `// .Where(...)`), `GetSongDetail_DTO`, `GetSongForPlayer_DTO`, `GetRelatedSongs`, `GetFavoriteSongs` |
| B4 | Category song list ordered by **total** streams desc (not the 7-day window) | IMPL | `GetPopularSongWithCategoryQuery` |
| B5 | Main artist of a song = the `SongArtist` with the smallest `Id`; other artists are collaborators | EXPLICIT | `SongService.GetPopularSongsAsMainArtistAsync/AsCollaboratorAsync`, `MappingProfile` (`Type`: Main/Collab), `SongRepository.GetRandomSongsAsync` orders artists by `sa.Id` |
| B6 | An artist's main category = category with the most of that artist's songs (ties unspecified) | EXPLICIT/IMPL | `ArtistRepository.GetArtistsByMainCategory`, `CategoryRepository.GetMainCategoryOfAnArtist` (two implementations) |
| B7 | Related artists = artists with the same main category, excluding the artist itself | EXPLICIT | `ArtistController.GetRelatedArtist` |
| B8 | Related songs = other songs sharing at least one artist, max 30, distinct | EXPLICIT | `SongRepository.GetRelatedSongs` |
| B9 | Main/collab lists have no explicit ordering despite "popular" naming | IMPL | `SongService` (uses `GetAll()` + in-memory `Paginate`) |
| B10 | Charts page shows category ids 10 and 26 first (data-specific), max 10 categories; first two rendered as dual column | EXPLICIT | `TopChartsPage.jsx` |
| B11 | Home shows max 8 genres and 10 artists; Genres page max 42 categories fetched, first 6 shown with 10 songs each | EXPLICIT | `HomePage.jsx`, `ExploreCategoriesPage.jsx` |
| B12 | Duration displays as `mm:ss`, `00:00` when null | EXPLICIT | `MappingProfile`, repository projections (a duration >= 1 h would be shown modulo minutes due to `mm\:ss` custom format - INFERRED) |
| B13 | Random next-batch returns random songs with lyrics (can repeat songs across batches/queue) | IMPL | `GetRandomSongsAsync` |

## C. Paging rules (server)
| ID | Rule | Source |
|---|---|---|
| C1 | `GetAll` / `SearchAll`: `page<1`->1, `size<10`->10 | `SongService` |
| C2 | Main artist songs: same min; collab songs: no correction; category songs: `size<1`->10 (min 1) | `SongService` |
| C3 | Popular categories/artists/songs: no correction (`page`/`size` used as given; `page=0` produces negative skip -> likely SQL error 500 INFERRED) | `PaginationHelper.PaginateAsync` |
| C4 | `totalPages = ceil(totalItems / limit)`; `limit` = requested size | `PagedResult` |
| C5 | Search: artists never paged; `totalPages = ceil((songTotal + artistTotal)/size)` | `SongService.SearchAll` |
| C6 | Client page sizes: artist page 10; category artists 10, songs 12; search 12; charts/explore 10 | `ArtistPage.jsx`, `CategoryPage.jsx`, `SearchResultPage.jsx`, `topChartsService` |

## D. Search
| ID | Rule | Type | Source |
|---|---|---|---|
| D1 | Header suggestions need >= 2 trimmed chars; debounce 300 ms; request size 5 (server raises to 10) | EXPLICIT | `Header.jsx`, `SongService.SearchAll` |
| D2 | Enter submits `/search?q=<trimmed>` if non-empty | EXPLICIT | `Header.jsx` |
| D3 | Ranking: song fields name x3, artist name x2, category x1.5 with fuzziness AUTO; exact name (case-insensitive) boosted x10 | EXPLICIT | `SongService.SearchAll` |
| D4 | Top result = first hit whose name equals the keyword (ordinal, ignore-case), removed from the list; artists listed before songs | EXPLICIT | `SongService.SearchAll` |
| D5 | Search relies on external index `songs` (not populated by this code) and index `artists` (auto-filled once per process if empty) | IMPL | `SongService` |
| D6 | All tab shows <= 10 songs and <= 4 artists; Songs tab paginates songs; Artists tab shows all returned artists | EXPLICIT | `SearchResultPage.jsx` |
| D7 | Exception/invalid ES response -> empty results (no error to user) | IMPL | `SearchAll` checks `IsValidResponse` |

## E. Playback and streaming
| ID | Rule | Type | Source |
|---|---|---|---|
| E1 | Guests may play music | IMPL | `startNewSession` has no auth check |
| E2 | A stream is recorded once per play session after 20 s of playback for **signed-in** users | EXPLICIT | `PlayerContext.jsx` (`currentTime >= 20`, `hasStreamed`, `user`) |
| E3 | Queue = current + `next-batch`; near queue end (<= 3 left) another batch appended | EXPLICIT | `PlayerContext.playNextSong` |
| E4 | Repeat modes cycle 0 -> 1 -> 2 -> 0 (Off/All/One) | EXPLICIT | `toggleRepeat` |
| E5 | Shuffle keeps current song first and shuffles the rest; disabling restores original order | EXPLICIT | `toggleShuffle` |
| E6 | Default volume 0.7; mute restores last non-zero volume (fallback 0.5) | EXPLICIT | `PlayerContext`, `PlayerControl` |
| E7 | Song end triggers next; repeat One restarts current | EXPLICIT | `onEnded`, `playNextSong` |
| E8 | Previous only moves within queue/playlist (no restart of current song) | IMPL | `playPrevSong` |
| E9 | Downloads use browser anchor `download` with sanitized filename `[^a-zA-Z0-9._-]` -> `_` (so non-ASCII titles lose characters) | EXPLICIT | `PlayerControl`, `SongViewPage`, `FavoriteSongsPage` |
| E10 | Playlist download is sequential with 1 s delay | EXPLICIT | `FavoriteSongsPage.handleDownloadPlaylist` |
| E11 | Stream counted server-side with no dedup or throttle | IMPL | `SongRepository.AddStream` |

## F. Favorites
| ID | Rule | Type | Source |
|---|---|---|---|
| F1 | One Favorite row per (user, song); toggle flips `IsFavorite` | EXPLICIT | `Favorite` PK, `ToggleFavorite` |
| F2 | Like count = rows with `IsFavorite = true` | EXPLICIT | repositories |
| F3 | Favorites list = user's rows with `IsFavorite = true`; unordered | IMPL | `GetFavoriteSongs` |
| F4 | Favorite control exists only in the player bar; not on song page (icon display only), charts, rows, cards | IMPL | source grep (`ItemTopCharts` unused; `SongRow` has none) |
| F5 | Reordering favorites is client-only, not persisted | IMPL | `FavoriteSongsPage.onDragEnd` |
| F6 | After toggle: count +1/-1 (min 0) locally; favorites cache cleared | EXPLICIT | `PlayerControl.toggleFavorite` |
| F7 | Toggle blocked while a request is pending | EXPLICIT | `updatingFavorite` |

## G. Ratings and reviews
| ID | Rule | Type | Source |
|---|---|---|---|
| G1 | Only signed-in users can rate | EXPLICIT | `[Authorize]`, `toggleRating` |
| G2 | Rating is 1-5 stars via UI; submit disabled when 0 | EXPLICIT (UI) | `RatingModal.jsx` |
| G3 | Comment optional; empty replaced by `(Không có bình luận)` | EXPLICIT (UI) | `RatingModal.jsx` |
| G4 | A user who has reviewed sees no form (based on `isReviewed` or username match in list) | EXPLICIT (UI) | `RatingModal.jsx` |
| G5 | Server enforces neither range, uniqueness, nor comment length | IMPL | `RatingService`, `RatingRepository`, `CreateRatingDTO` |
| G6 | Reviews ordered by newest first, date `yyyy-MM-dd` (UTC) | EXPLICIT | `RatingRepository.GetSongReviews` |
| G7 | Review author shown = `DisplayName`; UI ownership check uses `username` | IMPL | `RatingRepository`, `RatingModal` |
| G8 | Reviews cannot be edited or deleted | IMPL | no endpoint |

## H. Preferences and localization
| ID | Rule | Source |
|---|---|---|
| H1 | Supported UI languages: vi, en, jp, ru, ger; fallback en; `<html lang>` = vi/en/ja/ru/de | `LanguageSwitcher`, `i18n.js`, `App.jsx` |
| H2 | Six themes; choice saved in `localStorage.selectedTheme` | `SettingsDropdown.jsx` |
| H3 | Server messages Vietnamese only | controllers/services |
| H4 | Rating modal and a few fallbacks are hard-coded Vietnamese regardless of language | `RatingModal.jsx`, `ArtistPage.jsx` (`"Không tên"`, `"Nghệ sĩ"`), `App.jsx` (`/recent`) |

## I. Statistics
| ID | Rule | Source |
|---|---|---|
| I1 | Active users = users seen (heartbeat or any validated JWT) within `windowSeconds` (default 120; <= 0 -> 120); in-memory; entries older than the window are purged on each read | `StatsController`, `ActiveUserTracker` |
| I2 | Client heartbeat every 45 s when tab visible and signed in | `AuthContext.jsx` |

## J. Conflicts and irregularities observed (documented, not resolved)
1. **Gmail-only** (C, A6) vs server accepting any valid email.
2. **Lyrics filter** applied inconsistently (B2 vs B3).
3. **Two implementations of "main category"** (B6) with unspecified tie-breaking.
4. **Client-only uniqueness of reviews** vs no server constraint (G4/G5).
5. **`avatarUrl` vs `avatarURL`** property casing between login/refresh user object and `UserDTO` (`AuthController` vs `UserDTO`).
6. **Search paging**: artists not paged, `totalPages` combines both counts (C5).
7. **Heart/star on song page are non-interactive** while their counts come from the same fields as the interactive player bar (F4).
8. **Route ambiguity**: `GET /api/artist/{id}/artists` uses a song id.
9. Swagger described endpoints vs actual: README lists `GET /api/user/profile`, which does **not** exist (only `GET /api/user/{id}` and `GET /api/auth/me`) - CONFLICTING with README.
