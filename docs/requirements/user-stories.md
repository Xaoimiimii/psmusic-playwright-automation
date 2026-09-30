# User Stories

## 1. Overview

These user stories are **repository-derived and provisional**. PSMusic has no formal requirements, user stories or acceptance criteria, so they were inferred from the SUT source code at `D:\Study\PSMusic` (React 19 + Vite client in `PSMusic/psmusic.client`, ASP.NET Core 8 API in `PSMusic/PSMusic.Server`). They are **hypotheses to guide browser/runtime exploration**, not authoritative requirements.

Method and limits:

- Read: client routes/pages/components/services/contexts, all API controllers, services, the repositories that hold business logic, entities, `DBContext`, DTO validation, auth middleware, the token generator, `appsettings.json` (secret values not recorded), the two READMEs and the CHANGELOGs.
- The repository contains **no automated tests** and **no requirement documents**. The root `README.md` is a marketing-style feature list (in Vietnamese) and the only explicit product statement; it lists streaming, authentication/user management, a responsive UI, JWT auth and genre classification.
- Runtime data (seed data, Elasticsearch index content, real responses) was **not** inspected. Anything that depends on it is marked UNKNOWN.
- The SUT was not modified. No tests or detailed test cases were written.
- Message texts are quoted verbatim from source (mostly Vietnamese) as evidence. The exact wording shown to users must be confirmed at runtime.

Status legend: CONFIRMED, REPOSITORY-CONFIRMED, REPOSITORY-INFERRED, PARTIALLY-CONFIRMED, UNKNOWN, CONFLICTING.

Path shorthand used in evidence: `C:` = `PSMusic/psmusic.client/src/`, `S:` = `PSMusic/PSMusic.Server/`.

---

## 2. User Roles

| Role | Evidence | Confidence |
|---|---|---|
| Guest (unauthenticated visitor) | `C:App.jsx` routes `/`, `/genres`, `/charts`, `/song/:id`, `/artist/:id`, `/category/:id`, `/search` are outside `PrivateRoute`. Most `S:Controllers` GET actions have `[Authorize]` commented out. `C:Header.jsx` shows a Login button when `user` is null. | REPOSITORY-CONFIRMED |
| Registered user (authenticated listener) | `C:App.jsx` `PrivateRoute` for `/favorites`. `[Authorize]` on `favorite-toggle`, `favorites`, `stream/{id}`, `add-review`, `heartbeat`, `auth/me`, `user/{id}`. `S:Models/Entities/User.cs`. | REPOSITORY-CONFIRMED |
| Admin / staff / manager | None. `S:TokenGenerator.cs` has a commented-out role claim (`//new Claim(ClaimTypes.Role, user.Type)`) and `User.Type` is commented out. No admin UI, endpoint or content-management API exists. | Not a role in this repo (no evidence) |

Note: no content-creation endpoints exist (songs, artists and categories are read-only through the API). Catalog data is presumably loaded outside the app (database seed or scripts) - UNKNOWN.

---

## 3. User Stories

Capabilities: Authentication (US-001..004), Discovery/Browse (US-005..009), Search (US-010), Song & Artist detail (US-011..012), Playback (US-013..014), Personalization (US-015..018), Preferences (US-019..020), Popularity (US-021).

---

### US-001 - Register an account

**Status:** PARTIALLY-CONFIRMED

**Actor:** Guest

**User Story:**

> As a guest, I want to create an account with a username, email and password, so that I can sign in and use personalized features such as favorites and ratings.

**Evidence:**
- `C:pages/Auth/AuthPage.jsx` (sign-in / sign-up panels at `/auth`), `C:components/Auth/SignUp.jsx`
- `C:services/authService.js` `register()` -> `POST /api/auth/register`
- `S:Controllers/AuthController.cs` `Register`; `S:Services/Implementations/AuthService.cs` `Register`
- `S:Models/DTO/User/CreateUserDTO.cs` (Username required, Password `MinLength(8)`, Email `EmailAddress`, DisplayName required `MaxLength(30)`)
- `S:Data/DBContext.cs` (unique index on `Email` and `Username`); migration `add_unique_to_email_username`
- `C:services/emailValidationService.js` (external email-reputation call)

**Acceptance Criteria:**

- US-001-AC-01
  - Given a guest is on the sign-up form
  - When they submit with any of name, email or password empty
  - Then a "fill in all info" error is shown (i18n key `error_fill_info`) and no registration request is sent
- US-001-AC-02
  - Given a guest is on the sign-up form
  - When they submit a password shorter than 8 characters
  - Then the `error_password_length` message is shown ("Password must be at least 8 characters" in en) and no registration request is sent
- US-001-AC-03
  - Given valid, unused username/email and a password of 8+ characters
  - When the guest submits the form (and the email passes the client email check, see rules)
  - Then the account is created and a success message (`register_success`) is displayed and the form is cleared
- US-001-AC-04
  - Given an email that already exists
  - When registration is submitted
  - Then the API returns 400 with `Email đã tồn tại` and the UI shows the message
- US-001-AC-05
  - Given a username that already exists
  - When registration is submitted
  - Then the API returns 400 with `Tài khoản đã tồn tại` and the UI shows the message
- US-001-AC-06
  - Given a registration succeeds
  - Then the password is stored hashed (BCrypt), never in clear text (API-observable: not returned in any response)
- US-001-AC-07 - Behavior after successful registration (auto sign-in, switch to sign-in panel, redirect): UNKNOWN - requires runtime validation. Source only shows a success message.

**Business Rules:**
- BR-01 Username unique; email unique (server check plus DB unique index).
- BR-02 Password >= 8 chars (client and server).
- BR-03 Display name is set equal to the username on the client (`displayName: name`) and is limited to 30 chars by the server; so usernames > 30 chars are likely rejected by the server (`Dữ liệu không hợp lệ.`).
- BR-04 Client only accepts Gmail addresses (`error_email_gmail`: "Only @gmail.com is accepted") after an external email-reputation check (SMTP-valid, format-valid, deliverable, isGmail).

**Browser Validation Needed:**
- What happens after successful registration (redirect / panel switch / auto-login).
- Whether registration works when the external email-validation API is unavailable or the key (`VITE_ABSTRACT_API_KEY`) is not configured in the target environment (the sign-up flow depends on it).
- Actual messages for taken username/email, and for username > 30 chars.
- Whether non-Gmail addresses are always rejected in the UI.
- Whether leading/trailing spaces and special characters are accepted in username.

**Open Questions:**
- Is the Gmail-only restriction an intended product rule or a side effect of the email validator? (CONFLICTING evidence, see U-03.)
- Is an external network dependency for sign-up acceptable in the test environment?

---

### US-002 - Log in

**Status:** REPOSITORY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want to sign in with my username and password, so that I can access my favorites and rate songs.

**Evidence:**
- `C:components/Auth/SignIn.jsx`, `C:contexts/AuthContext.jsx` `login()`, `C:services/authService.js` `login()`
- `S:Controllers/AuthController.cs` `Login`; `S:Services/Implementations/AuthService.cs` `Login`
- `S:Models/DTO/Auth/AuthReqDTO.cs` (Username required, Password `MinLength(8)`)
- `S:Services/Implementations/TokenGenerator.cs`; `S:appsettings.json` `Jwt:ExpiryMinutes = 60`

**Acceptance Criteria:**

- US-002-AC-01
  - Given a guest on the sign-in form
  - When they submit with username or password empty
  - Then `error_fill_info` is shown and no request is sent
- US-002-AC-02
  - Given a password shorter than 8 characters
  - When submitted
  - Then `error_password_length` is shown client-side and no request is sent
- US-002-AC-03
  - Given valid credentials
  - When submitted
  - Then the API returns an access token and the user profile (id, username, email, displayName, avatarUrl), a `RefreshToken` HttpOnly cookie is set, the UI shows `login_success` and navigates to `/` after ~1 second
- US-002-AC-04
  - Given a username that does not exist
  - When submitted
  - Then the API returns 400 with `Tài khoản không tồn tại` and the UI displays it
- US-002-AC-05
  - Given an existing username with the wrong password
  - When submitted
  - Then the API returns 400 with `Sai mật khẩu` and the UI displays it
- US-002-AC-06
  - Given the password field is masked
  - When the user toggles the eye icon
  - Then the password becomes visible/hidden (`type` text/password)
- US-002-AC-07
  - Given the user switches between the Sign In and Sign Up panels
  - Then form fields, errors and success messages are cleared

**Business Rules:**
- BR-05 Access token lifetime 60 minutes (config); refresh token lifetime defaults to 7 days (10080 min, `Jwt:RefreshExpiryMinutes` default) and the cookie expires in 7 days.
- BR-06 Login distinguishes "user not found" from "wrong password" (different messages).
- BR-07 Refresh token cookie: HttpOnly, Secure, SameSite=None, path `/`.

**Browser Validation Needed:**
- Actual displayed error text for wrong password / unknown user (and language).
- Whether a server-side model-validation 400 (e.g., password < 8 sent directly to API) is shown as a generic error, because the client reads `data.message` and ASP.NET ProblemDetails has no `message`.
- Whether the Secure/SameSite=None cookie works on plain-HTTP test hosts (may prevent session persistence).
- Whether the login page is accessible while already signed in.

**Open Questions:** Is the enumeration of accounts via distinct messages intended?

---

### US-003 - Stay signed in across page loads and token expiry

**Status:** REPOSITORY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want my session to be restored automatically, so that I do not have to sign in again every time I reload the app or my access token expires.

**Evidence:**
- `C:contexts/AuthContext.jsx` (init effect calling `refresh`, axios 401 interceptor with single-flight refresh queue, `logout()` on refresh failure)
- `S:Controllers/AuthController.cs` `Refresh`; `S:AuthService.cs` `Refresh`; `S:TokenGenerator.cs` `ValidateRefreshToken` (requires claim `token_type=refresh`)
- `C:components/PrivateRoute/PrivateRoute.jsx`

**Acceptance Criteria:**

- US-003-AC-01
  - Given a user signed in earlier and the refresh cookie is valid
  - When the app is loaded/reloaded
  - Then the user is restored (user menu shown instead of Login button) without re-entering credentials
- US-003-AC-02
  - Given no refresh cookie
  - When the app loads
  - Then the API replies HTTP 200 with `IsSuccess:false` (`Refresh token không tìm thấy`) and the user is treated as a guest
- US-003-AC-03
  - Given an unauthenticated visitor
  - When they navigate directly to `/favorites`
  - Then they are redirected to `/auth` (after the loading spinner)
- US-003-AC-04
  - Given an API call returns 401 with an expired access token and the refresh cookie is valid
  - When the request is retried
  - Then a new token is obtained transparently and the original request succeeds
- US-003-AC-05
  - Given the refresh fails during a 401 retry
  - Then the user is logged out, cache cleared and redirected to `/`
- US-003-AC-06 - Exact behavior of concurrent requests during refresh: UNKNOWN - requires runtime validation.

**Business Rules:**
- BR-08 Refresh rotates the refresh token (a new one is set on every refresh).
- BR-09 The frontend keeps the access token in memory only (not localStorage).

**Browser Validation Needed:** reload persistence; cookie deletion behavior; forcing token expiry (short `ExpiryMinutes` in test env); `/favorites` deep link as guest.

**Open Questions:** `OnMessageReceived` reads an `AccessToken` cookie that no code sets - dead code or a planned feature?

---

### US-004 - Log out

**Status:** PARTIALLY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want to log out, so that my account is no longer active on this device.

**Evidence:**
- `C:components/UserDropdown/UserDropdown.jsx` (logout option), `C:contexts/AuthContext.jsx` `logout()`
- `S:Controllers/AuthController.cs` `Logout`, `RemoveRefreshTokenCookie`

**Acceptance Criteria:**

- US-004-AC-01
  - Given a signed-in user opens the user dropdown
  - When they choose Logout
  - Then the local user/token are cleared, cached data is cleared, and the app navigates to `/`, showing the Login button
- US-004-AC-02
  - Given a signed-in user logged out
  - When they call the logout API
  - Then the refresh cookie is deleted and `Đăng xuất thành công` is returned
- US-004-AC-03
  - Given the user has logged out
  - When they reload the app
  - Then they stay a guest (refresh cookie removed) - UNKNOWN whether cookie deletion succeeds on all environments (delete options depend on `Request.IsHttps`).

**Business Rules:** BR-10 Logout does not invalidate already issued JWTs (stateless; no server token store found).

**Browser Validation Needed:** whether logout keeps the user on a protected page; whether stale refresh cookie remains after logout in HTTP env; behavior of Back after logout.

**Open Questions:** Should Logout require a valid access token? (API returns 401 without one, though the client ignores the error.)

---

### US-005 - Discover content on the home page

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to see popular genres and trending artists on the home page, so that I can quickly find music to explore.

**Evidence:**
- `C:pages/HomePage/HomePage.jsx`, `C:services/homeService.js` (`GET /api/category/popular?page=1&size=50`, `GET /api/artist/popular`)
- `S:Controllers/CategoryController.cs`, `ArtistController.cs`; `S:CategoryRepository.GetCategoriesWithStreamsLast7Days`, `S:ArtistRepository` popular query (streams in the last 7 days)
- `C:components/Sidebar/Sidebar.jsx` nav item "discover" `/`

**Acceptance Criteria:**

- US-005-AC-01
  - Given popular categories exist
  - When the home page loads
  - Then a "Discover by genre" section shows at most 8 genre cards, with a "See all" link to `/genres`
- US-005-AC-02
  - Given popular artists exist
  - When the home page loads
  - Then a "Trending artists" section shows at most 10 artists, with a "See all" link to `/charts`
- US-005-AC-03
  - Given both lists are empty
  - Then an empty-state message (`empty_content`) is shown
- US-005-AC-04
  - Given the user clicks a genre card / artist card
  - Then they are taken to the genre / artist page (route pattern from `GenreCard`/`ItemCardColumn` - exact target: UNKNOWN, needs confirmation)
- US-005-AC-05 - Ordering and membership of popular lists depend on stream data in the last 7 days: UNKNOWN - requires seed data / runtime validation.
- US-005-AC-06 - A "Recommended for you" heading is rendered with an empty container (`recommendSys`): no functionality found.

**Business Rules:** BR-11 "Popular" = ordered by number of plays in the last 7 days (both categories and artists).

**Browser Validation Needed:** empty vs. populated home; data cache behavior (home data is cached client-side in `DataCacheContext`, TTL unknown); error state text on API failure; "Recommended for you" is empty.

**Open Questions:** Is the recommendation section unfinished (placeholder)? (See U-06.)

---

### US-006 - Explore all genres

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to browse songs grouped by genre, so that I can discover music in styles I like.

**Evidence:** `C:pages/ExploreCategoriesPage/ExploreCategoriesPage.jsx` (route `/genres`), `C:services/exploreCategoriesService.js` (`/category/popular`, `/song/category/popular/{id}`), `S:SongController.GetPopularSongByCategory`, `S:SongRepository` category query.

**Acceptance Criteria:**
- US-006-AC-01
  - Given genres exist
  - When the user opens `/genres` (Sidebar "Genres")
  - Then up to 6 featured genres are displayed as sections titled "Explore {genre}" each with up to 10 songs
- US-006-AC-02
  - Given the API fails or returns nothing
  - Then the empty state (`empty_content`) is shown
- US-006-AC-03
  - Given genre names are translated (`utils/genreTranslation.js`)
  - When the language changes
  - Then genre names are shown translated where a translation exists (coverage UNKNOWN)
- US-006-AC-04 - "See all" link target and other genres beyond the first 6: UNKNOWN - the page requests up to 100 categories but renders 6 sections.

**Business Rules:** none beyond BR-11.

**Browser Validation Needed:** which genres appear, count displayed, "See all" destination, song card actions (play, open song, favorite).

**Open Questions:** Why are up to 42 genres fetched when only 6 are shown?

---

### US-007 - View a genre page

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to open a genre and see its featured artists and popular songs, so that I can dive into that style.

**Evidence:** `C:pages/CategoryPage/CategoryPage.jsx` (route `/category/:id`); `GET /api/category/{id}`, `GET /api/artist/category/{id}`, `GET /api/song/category/popular/{id}`; `S:ArtistController.GetArtistByMainCategory`, `S:SongController.GetPopularSongByCategory`, `C:components/Pagination/Pagination.jsx`.

**Acceptance Criteria:**
- US-007-AC-01
  - Given a valid category id
  - When `/category/{id}` is opened
  - Then the genre name/header, a paginated "Featured artists" section and a paginated "Songs" section are displayed
- US-007-AC-02
  - Given the artist or song list has more items than one page
  - When the user changes page
  - Then the requested page is fetched and shown (page sizes: see constants `ARTIST_PAGE_SIZE`/`SONG_PAGE_SIZE` in source; values to confirm at runtime)
- US-007-AC-03
  - Given the song list is ordered by total streams (descending)
  - Then the most-streamed songs of the genre appear first
- US-007-AC-04
  - Given an artist's "main category" is the category with most of that artist's songs
  - Then that artist appears in this genre's featured artists (rule from `ArtistRepository`)
- US-007-AC-05 - Behavior for a non-existent category id: UNKNOWN - `GET /api/category/{id}` returns 200 with null body per controller; UI result requires runtime validation.

**Business Rules:** BR-12 Artist -> main category = category of the majority of the artist's songs. BR-13 Category songs sorted by total stream count desc.

**Browser Validation Needed:** invalid id; pagination controls; page size; signed-in vs guest favorited state.

**Open Questions:** In `SongRepository` the "has lyrics" filter (`LrcUrl` not empty) is applied to most lists but commented out for category songs - is it intentional? (See U-08.)

---

### US-008 - View top charts

**Status:** PARTIALLY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to see top charts of songs by genre and popular artists, so that I can see what is currently trending.

**Evidence:** `C:pages/TopChartsPage/TopChartsPage.jsx` (route `/charts`), `C:services/topChartsService.js`, `C:components/ItemTopCharts/ItemTopCharts.jsx`; `GET /api/category/popular`, `/api/artist/popular`, `/api/song/category/popular/{id}`; `S:SongController` `OutputCache` on `/api/song/popular` (600 s).

**Acceptance Criteria:**
- US-008-AC-01
  - Given popular categories exist
  - When `/charts` is opened
  - Then up to 10 category charts are shown, with categories id 10 and 26 placed first if present, each listing top songs
- US-008-AC-02
  - Given the API fails or nothing is returned
  - Then the empty state (`empty_content`) is shown; a category without songs shows `no_data`
- US-008-AC-03
  - Given a user clicks a song / artist
  - Then they navigate to `/song/{id}` / `/artist/{id}`
- US-008-AC-04 - Favoriting from the chart list (`handleToggleFavorite`, `POST /song/{id}/favorite-toggle`) and its guest behavior: UNKNOWN - handler exists but the trigger in the rendered items must be verified.

**Business Rules:** BR-14 Hard-coded ordering: category ids 10 and 26 first (data-specific, from `TopChartsPage.jsx`).

**Browser Validation Needed:** which categories are ids 10/26 in real data; whether a favorite control is rendered on chart items; whether the trending artists section is shown on this page.

**Open Questions:** Is the special ordering of ids 10 and 26 a product rule (e.g., V-Pop/K-Pop)?

---

### US-009 - View an artist page

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to open an artist's page and see their songs and related artists, so that I can listen to more of what I like.

**Evidence:** `C:pages/ArtistPage/ArtistPage.jsx` (route `/artist/:id`); `GET /api/artist/{id}`, `/api/song/artist/main/{id}`, `/api/song/artist/collab/{id}`, `/api/artist/related/{id}`; `S:SongService.GetPopularSongsAsMainArtistAsync` (main artist = the artist with the lowest `SongArtist.Id` in that song), `GetPopularSongsAsCollaboratorAsync`; `S:ArtistController.GetRelatedArtist`.

**Acceptance Criteria:**
- US-009-AC-01
  - Given a valid artist id
  - When `/artist/{id}` is opened
  - Then the artist name/avatar with a Play control, "Main songs" and "Collaboration songs" sections (each paginated) and "Related artists" (client shows 4 at a time, paginated) are shown
- US-009-AC-02
  - Given a user clicks Play on the artist
  - Then the artist's songs start playing and the button shows Pause (label toggles)
- US-009-AC-03
  - Given a signed-in user
  - Then the song lists reflect their favorite state (`isFavorited`) (server derives from JWT)
- US-009-AC-04
  - Given an artist has no main category
  - Then the related-artists API returns an empty 200 and the UI shows no related artists (exact UI: UNKNOWN)
- US-009-AC-05 - Ordering of main/collab songs and result of unknown artist id: UNKNOWN - requires runtime validation.

**Business Rules:** BR-15 A song's "main artist" = the first-linked artist (min `SongArtist.Id`); other linked artists are "collaborators". BR-16 Related artists = artists sharing the same main category, excluding the artist itself.

**Browser Validation Needed:** error messages `error_loading_artist` etc. with an invalid id; page sizes; what Play does (queue behavior).

**Open Questions:** None additional.

---

### US-010 - Search for songs and artists

**Status:** REPOSITORY-CONFIRMED (behavior against real index: UNKNOWN)

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to search by song or artist name and see suggestions as I type, so that I can quickly find something to listen to.

**Evidence:**
- `C:components/Header/Header.jsx` (search box, 300 ms debounce suggestions, `GET /api/song/search?keyword=&page=1&size=5`)
- `C:pages/SearchResult/SearchResultPage.jsx` (`/search?q=&t=&page=`), `C:components/SearchTab/SearchTab.jsx`
- `S:SongController.Search`, `S:SongService.SearchAll` (Elasticsearch: multi-match on song name^3, artists.name^2, category^1.5 with fuzziness AUTO + case-insensitive exact-name boost; artist index by name)
- `S:Models/DTO/Search/*`

**Acceptance Criteria:**
- US-010-AC-01
  - Given the user focuses the search box and types fewer than 2 characters
  - Then no suggestion request is made
- US-010-AC-02
  - Given the user types 2+ characters
  - When 300 ms pass
  - Then a suggestion box shows the top result (if any) followed by matches, each with title and artist; a "searching" indicator and a "no suggestions" message (`no_suggest`) cover loading/empty
- US-010-AC-03
  - Given a suggestion is clicked
  - Then artist suggestions open `/artist/{id}` and song suggestions open `/song/{id}`
- US-010-AC-04
  - Given the user presses Enter with a non-blank query
  - Then the app navigates to `/search?q={trimmed query}`
- US-010-AC-05
  - Given the search result page has results
  - Then tabs (All / Songs / Artists per `SEARCH_TABS`) filter the display; the All tab shows up to 10 songs (two columns) and up to 4 artists; the Songs tab is paginated (`page` in URL)
- US-010-AC-06
  - Given no matches
  - Then the message `not_found_msg` + keyword is shown
- US-010-AC-07
  - Given the user clicks the clear (X) button
  - Then the query and suggestions are cleared
- US-010-AC-08
  - Given an exact (case-insensitive) name match exists
  - Then it is returned as `TopResult` and shown in a "Top result" section
- US-010-AC-09
  - Given a server-side search: minimum page size is 10 (smaller sizes are raised to 10) - (the suggestion call requests size 5; effective size: UNKNOWN)
- US-010-AC-10 - Accent-insensitive/fuzzy matching, typo tolerance and Vietnamese diacritics handling: UNKNOWN - requires runtime validation.

**Business Rules:** BR-17 Results list artists before songs. BR-18 Only songs indexed in Elasticsearch are searchable (the index `songs` is not populated by this repo - only the `artists` index is auto-populated on first search).

**Browser Validation Needed:** whether the Elasticsearch `songs` index exists in the test environment; suggestions with 1 char; special characters; long strings; tab switching and URL params; pagination (`TotalPages` computed from songs+artists total / size).

**Open Questions:** How are songs indexed (no indexing code for `songs` found)? There is also a PostgreSQL ILIKE/unaccent search in `SongRepository` that is not used by the endpoint (possibly a fallback/legacy). See U-04.

---

### US-011 - View song details

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to open a song page and see its cover, artists, like/review counts and lyrics, so that I can learn about the song and follow the lyrics.

**Evidence:** `C:pages/SongViewPage/SongViewPage.jsx` (route `/song/:songId`); `GET /api/song/{id}/detail`, `/api/song/{id}/related`, `/api/artist/{id}/artists`; `S:SongController.GetSongDetail` (404 `Không tìm thấy bài hát`), `S:SongRepository.GetSongDetail_DTO`.

**Acceptance Criteria:**
- US-011-AC-01
  - Given a valid song id
  - When `/song/{id}` is opened
  - Then title, cover, artist links, favorite count, review count, Play and Download buttons, a lyrics panel and an artists list are shown
- US-011-AC-02
  - Given an unknown song id
  - Then the API returns 404 and the UI shows `song_not_found`
- US-011-AC-03
  - Given the song has a lyric file (LRC URL)
  - Then time-tagged lines are parsed and shown; long lyrics are collapsed with Show more / Show less; if none, `no_lyrics_yet` is shown
- US-011-AC-04
  - Given the song is currently playing
  - Then the lyric line matching the current time is highlighted
- US-011-AC-05
  - Given other songs by the same artists exist (max 30, excluding this one)
  - Then "Other songs by {artists}" table is shown; with more than 4 songs a "View more / Show less" toggle appears
- US-011-AC-06
  - Given a signed-in user who favorited/reviewed the song
  - Then heart/star icons are filled (`isFavorited`, `isReviewed`); for guests they are never filled
- US-011-AC-07
  - Given the heart and star icons on this page
  - Then they display counts only - no click handler exists on this page (favoriting and rating are done from the player bar)
- US-011-AC-08 - Lyrics are fetched from an external URL in the browser (fetch); failure/CORS behavior: UNKNOWN.

**Business Rules:** BR-19 Related songs = other songs sharing an artist, max 30. BR-20 Duration format `mm:ss`; default `00:00`.

**Browser Validation Needed:** heart/star not clickable (confirm); lyric CORS; sync of highlighted lyric with playback; behavior for a song lacking lyric/cover.

**Open Questions:** Is the non-interactive heart/star on the detail page intentional?

---

### US-012 - Download a song

**Status:** REPOSITORY-INFERRED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to download a song as an MP3 file, so that I can listen offline.

**Evidence:** `C:pages/SongViewPage/SongViewPage.jsx` `handleDownloadSong` (anchor with `download` attribute to `audioUrl`); `C:components/PlayerControl/PlayerControl.jsx` (`handleDownload`); `C:pages/FavoriteSongsPage/FavoriteSongsPage.jsx` `handleDownloadPlaylist`.

**Acceptance Criteria:**
- US-012-AC-01
  - Given a song with an audio URL
  - When the user clicks Download on the song page
  - Then the browser starts a download named from the title with non-alphanumeric characters replaced by `_` and `.mp3` extension
- US-012-AC-02
  - Given the download fails in code
  - Then a `download_error` toast is shown
- US-012-AC-03 - Whether the browser downloads or navigates (cross-origin `download` attribute is ignored by browsers for cross-origin URLs) and whether guests may download: UNKNOWN - requires runtime validation.

**Business Rules:** BR-21 Download filename sanitization `[^a-zA-Z0-9._-]` -> `_`.

**Browser Validation Needed:** actual download event; filename; player-bar download; download-playlist implementation (zip vs. sequential).

**Open Questions:** Is download intentionally available to guests?

---

### US-013 - Play songs with player controls

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a listener, I want to play a song and control playback (pause, skip, seek, volume, shuffle, repeat), so that I can listen the way I like.

**Evidence:** `C:contexts/PlayerContext.jsx` (`startNewSession`, `playSong`, `togglePlay`, `playNextSong`, `playPrevSong`, `toggleShuffle`, `toggleRepeat`, volume, queue), `C:components/PlayerControl/PlayerControl.jsx`, `C:services/PlayerControlService.js` (`GET /api/song/{id}/player`, `GET /api/song/next-batch`); `S:SongController.GetSongForPlayer`, `GetNextBatch` (random songs with lyrics).

**Acceptance Criteria:**
- US-013-AC-01
  - Given the user clicks Play on a song
  - Then the player bar becomes visible, audio starts, and the title/artist/cover are shown from the player data
- US-013-AC-02
  - Given a song is playing
  - When the user clicks Pause/Play
  - Then playback pauses/resumes and the icon toggles
- US-013-AC-03
  - Given a queue exists
  - When the user clicks Next
  - Then the next song plays; when the queue nears its end (<= 3 remaining) a new random batch is appended; Previous plays the previous queue song
- US-013-AC-04
  - Given repeat state cycles Off -> Repeat all -> Repeat one on each click
  - Then Repeat one restarts the same song at end; Repeat all restarts the queue after its last song
- US-013-AC-05
  - Given shuffle is enabled
  - Then the current song stays first and the remaining queue order is shuffled; disabling restores the original order
- US-013-AC-06
  - Given the volume slider
  - Then default volume is 70%; Mute toggle stores/restores the previous volume
- US-013-AC-07
  - Given the current song ends
  - Then the next song starts automatically
- US-013-AC-08
  - Given the player bar
  - Then the title is truncated with an ellipsis after 25 characters; clicking it opens `/song/{id}`
- US-013-AC-09
  - Given a guest presses play
  - Then playback works (no auth check in `startNewSession`) - to be confirmed at runtime
- US-013-AC-10 - Seek bar, time display, and whether playback continues across page navigation: UNKNOWN in detail; the `<audio>` element lives in a provider above the routes, so it likely persists - requires runtime validation. Autoplay policies may block play in automated browsers.

**Business Rules:** BR-22 `next-batch` returns random songs having lyrics. BR-23 The player treats `mm:ss` durations.

**Browser Validation Needed:** all player control states; Playwright/headless autoplay and audio source availability; repeat/shuffle labels; page-level duplicate `PlayerControl` rendering (layout renders it in two places when the player is visible).

**Open Questions:** Should the same song be re-queued (duplicates) by "next-batch"?

---

### US-014 - Sign-in prompt for members-only actions

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest

**User Story:**

> As a guest, I want to be told that I need to sign in when I try to use favorites or ratings, so that I understand how to unlock those features.

**Evidence:** `C:components/Modal/AuthModal.jsx` (`start_listening`, `auth_modal_desc`: "Login with your account to explore full features like favorites and song ratings.", buttons `login_now` / `maybe_later`); `C:components/Sidebar/Sidebar.jsx` (protected nav item "Favorites"); `C:components/PlayerControl/PlayerControl.jsx` (`toggleFavorite`, `toggleRating`).

**Acceptance Criteria:**
- US-014-AC-01
  - Given a guest clicks the Favorites item in the sidebar
  - Then navigation is prevented and the sign-in modal is displayed
- US-014-AC-02
  - Given a guest clicks the favorite (heart) or rate button in the player bar
  - Then the sign-in modal is displayed and no API call is made
- US-014-AC-03
  - Given the modal is open
  - When the user chooses "Login now"
  - Then the app navigates to `/auth` (music is stopped if the caller provided `onStopMusic`)
- US-014-AC-04
  - Given the modal is open
  - When the user chooses "Maybe later", the X, or clicks the overlay
  - Then the modal closes
- US-014-AC-05
  - Given the modal is open
  - Then page scrolling is locked (`body.style.overflow='hidden'`) and restored on close

**Business Rules:** BR-24 Favorites page and favorite/rating/stream actions require authentication.

**Browser Validation Needed:** whether the player-bar stops when the modal's "Login now" is used from the player (no `onStopMusic` passed there).

**Open Questions:** None.

---

### US-015 - Favorite and unfavorite a song

**Status:** REPOSITORY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want to mark songs as favorites and remove them, so that I can keep the songs I love in one place.

**Evidence:** `C:components/PlayerControl/PlayerControl.jsx` `toggleFavorite`; `C:contexts/DataCacheContext.jsx` (`updateSongFavoriteStatus`, `lastFavoriteUpdate`); `S:SongController.ToggleFavorite` (`[Authorize]`, POST `/api/song/{id}/favorite-toggle`); `S:SongRepository.ToggleFavorite`; `S:Models/Entities/Favorite.cs` (composite key UserId+SongId, `IsFavorite` flag).

**Acceptance Criteria:**
- US-015-AC-01
  - Given a signed-in user is playing a song that is not a favorite
  - When they click the heart
  - Then the API responds `Đã thêm vào yêu thích` with `isFavorited:true`, the heart is filled and the like count increases by 1
- US-015-AC-02
  - Given the song is a favorite
  - When they click the heart again
  - Then the API responds `Đã bỏ yêu thích` with `isFavorited:false`, the heart is cleared and the count decreases (never below 0)
- US-015-AC-03
  - Given a request is in flight
  - Then the heart is disabled (`updatingFavorite`) to prevent double toggles
- US-015-AC-04
  - Given the favorite state changes
  - Then the favorites cache is cleared so `/favorites` reflects the change on next visit
- US-015-AC-05
  - Given a favorite exists in the DB with `IsFavorite=false`
  - Then it is treated as not favorited (soft toggle; re-toggling flips the same record)
- US-015-AC-06 - Favorite state visible on cards/rows elsewhere (Top charts, artist page, category page) and the tooltip labels `add_favorite`/`remove_favorite`: requires runtime validation.
- US-015-AC-07 - Toggling a non-existent song id via the API: UNKNOWN (likely FK error -> 400 `Lỗi xử lý: ...`).

**Business Rules:** BR-25 One favorite record per (user, song); toggled by a boolean. BR-26 Like count = count of favorites with `IsFavorite = true`.

**Browser Validation Needed:** UI sync across player bar, song page and lists; multi-tab; counter accuracy.

**Open Questions:** None.

---

### US-016 - View and manage my favorites playlist

**Status:** PARTIALLY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want to see all my favorite songs in one playlist and play or reorder them, so that I can enjoy my collection easily.

**Evidence:** `C:pages/FavoriteSongsPage/FavoriteSongsPage.jsx` (route `/favorites`, `GET /api/song/favorites`, drag-and-drop via `@hello-pangea/dnd`, `playPlaylist`, `handleDownloadPlaylist`), `C:components/NoFavoriteState/NoFavoriteState.jsx`, `C:components/UserDropdown/UserDropdown.jsx` (link to favorites); `S:SongController.GetFavoriteSongs`.

**Acceptance Criteria:**
- US-016-AC-01
  - Given a signed-in user with favorites
  - When they open `/favorites`
  - Then the playlist page lists their favorite songs (title, artists, duration) with "Featured artist" line summarizing the top artists (the 1-3 most frequent artists, then "& N others")
- US-016-AC-02
  - Given the user has no favorites
  - Then `NoFavoriteState` (`no_favorite_msg`) is shown
- US-016-AC-03
  - Given the user clicks "Play all"
  - Then the playlist plays; the button shows Pause while a playlist song is playing
- US-016-AC-04
  - Given the user drags a song row to another position
  - Then the displayed order and current play queue update (client-side only)
- US-016-AC-05
  - Given more songs than the default visible count
  - Then a "show more/less" toggle expands/collapses the list
- US-016-AC-06
  - Given the user clicks Download playlist
  - Then songs are downloaded (`downloading_playlist` indicator) - mechanism UNKNOWN
- US-016-AC-07
  - Given a guest opens `/favorites` directly
  - Then they are redirected to `/auth` (see US-003)

**Business Rules:** BR-27 Reordering is not persisted to the server (no API); after reload the order comes from the server (no explicit order key in `Favorite`).

**Browser Validation Needed:** whether the order after reload is stable; the caching behavior (favorites list cached client-side until cleared); size threshold for "show more"; unfavoriting from this page (a heart control exists in the player, not confirmed on rows).

**Open Questions:** Should reordering persist? (See U-07.)

---

### US-017 - Rate and review a song

**Status:** PARTIALLY-CONFIRMED

**Actor:** Registered user

**User Story:**

> As a registered user, I want to rate a song with stars and an optional comment and read other people's reviews, so that I can share my opinion and see what others think.

**Evidence:** `C:components/Modal/RatingModal.jsx`, `C:components/PlayerControl/PlayerControl.jsx` (`toggleRating`, rating button); `S:Controllers/RatingController.cs` (`GET /api/rating/{songId}/reviews`, `POST /api/rating/{id}/add-review` `[Authorize]`); `S:RatingRepository`; `S:Models/DTO/Rating/RatingDTO.cs`, `Models/Entities/Rating.cs`.

**Acceptance Criteria:**
- US-017-AC-01
  - Given a signed-in user who has not rated the song
  - When the rating modal opens
  - Then a 1-5 star selector (with hover highlight), an optional comment field and a submit button are shown, and the submit button is disabled until at least one star is selected
- US-017-AC-02
  - Given a star selection
  - When the user submits
  - Then the review is posted (`Đánh giá thành công!`), the new review appears at the top of the list, the song's review count increases, and the form resets
- US-017-AC-03
  - Given the comment is left empty
  - Then it is submitted as `(Không có bình luận)` (client default)
- US-017-AC-04
  - Given the user has already reviewed the song (by `isReviewed` or a review with their username in the list)
  - Then the form is hidden and only the reviews list is shown, with the user's own review styled distinctly
- US-017-AC-05
  - Given reviews exist
  - Then each shows user display name, stars, comment; server returns newest first with date `yyyy-MM-dd`
- US-017-AC-06
  - Given a submit failure
  - Then a toast "Không thể gửi đánh giá. Vui lòng thử lại." is shown
- US-017-AC-07
  - Given a guest clicks the rate button
  - Then the sign-in modal appears (see US-014)
- US-017-AC-08 - Empty-reviews text, close behavior (X / overlay click), and what happens when submitting star = 0 (toast "Vui lòng chọn số sao để đánh giá!" exists in code, but the button is disabled): requires runtime validation.

**Business Rules:**
- BR-28 One rating per user per song is enforced **only on the client**; the server has no uniqueness or range check (Value 1-5 not validated, comment length not validated). See U-05.
- BR-29 Reviewer name shown is `DisplayName`, but the client compares reviews with `user.username`; for registrations these are equal (BR-03), but may diverge.

**Browser Validation Needed:** duplicate-submit protection; rating persistence after reload; comment max length / HTML injection rendering; review count in player vs. song page.

**Open Questions:** Is a second review from the same user allowed by design? Can users edit/delete reviews (no API found)?

---

### US-018 - Change interface language

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a user, I want to switch the interface language, so that I can use the app in the language I prefer.

**Evidence:** `C:components/LanguageSwitcher/LanguageSwitcher.jsx` (vi, en, jp, ru, ger), `C:i18n.js` (`i18next-browser-languagedetector`, fallback `en`, loads `/locales/{lng}/translation.json`), `C:App.jsx` (`<html lang>` mapping: ger -> de, jp -> ja), `public/locales/{en,ger,jp,ru,vi}`; also available on the auth page.

**Acceptance Criteria:**
- US-018-AC-01
  - Given the language dropdown is opened
  - Then five languages are listed (Tiếng Việt, English, 日本語, Русский, Deutsch) with a check mark on the current one
- US-018-AC-02
  - Given the user selects a language
  - Then UI texts switch immediately and `document.documentElement.lang` is updated (vi, en, de, ja, ru)
- US-018-AC-03
  - Given a first visit with no stored preference
  - Then the language is detected by the browser detector; unsupported languages fall back to English
- US-018-AC-04 - Persistence of the chosen language across reloads (detector caches in localStorage by default; not configured explicitly) and completeness of all five translation files: UNKNOWN - requires runtime validation.

**Business Rules:** BR-30 `debug: true` for i18next (console output).

**Browser Validation Needed:** missing translation keys per language; genre names translation; persistence; server error messages remain Vietnamese regardless of UI language (inferred from controllers).

**Open Questions:** None.

---

### US-019 - Change color theme

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a user, I want to choose a color theme, so that I can personalize the look of the app.

**Evidence:** `C:components/SettingsDropdown/SettingsDropdown.jsx` (themes: ruby, amethyst, sapphire, emerald, topaz, aquamarine; `localStorage['selectedTheme']`).

**Acceptance Criteria:**
- US-019-AC-01
  - Given the settings dropdown is opened
  - Then six themes with previews are listed and the active one is marked
- US-019-AC-02
  - Given a theme is selected
  - Then CSS variables change immediately and the choice is saved to `localStorage`
- US-019-AC-03
  - Given a saved theme
  - When the app reloads
  - Then the saved theme is re-applied
- US-019-AC-04 - Default theme when nothing is saved and the visual results of each theme: UNKNOWN - requires runtime validation.

**Business Rules:** BR-31 Theme stored client-side per browser, not per account.

**Browser Validation Needed:** persistence across reload and after logout; theme applies on the auth page (settings dropdown is not rendered on `/auth`; the saved theme may still apply).

**Open Questions:** None.

---

### US-020 - Move around the app with navigation and layout

**Status:** REPOSITORY-CONFIRMED

**Actor:** Guest, Registered user

**User Story:**

> As a user, I want a consistent navigation (sidebar, header back/forward, user menu), so that I can move between the main areas of the app easily.

**Evidence:** `C:components/Sidebar/Sidebar.jsx` (Discover `/`, Genres `/genres`, Charts `/charts`, Favorites `/favorites`), `C:components/Header/Header.jsx` (back/forward arrows via `navigate(-1)/(1)`), `C:components/UserDropdown/UserDropdown.jsx`, `C:layouts/ClientLayout/ClientLayout.jsx`, `C:components/Footer/Footer.jsx`, `C:App.jsx`.

**Acceptance Criteria:**
- US-020-AC-01
  - Given any main page
  - Then a sidebar with Discover, Genres, Charts, Favorites, a header with back/forward, search, language switcher, settings, and a Login button (guests) or user avatar menu (signed in), and a footer are shown
- US-020-AC-02
  - Given the current route is a sidebar item's path
  - Then that item is highlighted (`/` also matches `/discover`)
- US-020-AC-03
  - Given the user opens the user dropdown
  - Then options include the favorites playlist and Logout
- US-020-AC-04
  - Given the route `/recent`
  - Then only the text "Nghe Gần Đây" is shown (placeholder); no sidebar link to it
- US-020-AC-05 - 404/unknown routes: no catch-all route found in `App.jsx` (inferred: blank content or server fallback) - requires runtime validation.

**Business Rules:** none.

**Browser Validation Needed:** avatar fallback when `avatarUrl` is missing/broken (`avatarError` state); unknown route behavior; toast host position; responsive layout (README claims responsive design).

**Open Questions:** Is `/recent` (recently played) a planned feature?

---

### US-021 - Popular content reflects real listening

**Status:** REPOSITORY-INFERRED

**Actor:** Registered user (as the source of the data); all users (as consumers)

**User Story:**

> As a listener, I want trending songs, artists and genres to reflect what people actually listen to, so that the charts are meaningful.

**Evidence:** `C:contexts/PlayerContext.jsx` (a stream is recorded once per playback when a signed-in user has played >= 20 seconds -> `POST /api/song/stream/{id}`); `S:SongController.AddStream` (`[Authorize]`), `S:SongRepository.AddStream`, `Stream` entity; popularity queries in `SongRepository`, `ArtistRepository`, `CategoryRepository` (streams in last 7 days); `S:StatsController` heartbeat/active-users.

**Acceptance Criteria:**
- US-021-AC-01
  - Given a signed-in user plays a song for at least 20 seconds
  - Then exactly one stream is recorded for that playback (guard `hasStreamed`; reset on each new song)
- US-021-AC-02
  - Given a guest plays a song
  - Then no stream is recorded (client guard on `user`; API requires auth)
- US-021-AC-03
  - Given recorded streams
  - Then the "popular" lists (songs, artists, categories) are ordered by streams in the last 7 days
- US-021-AC-04 - Cache effects: `/api/song/popular` is output-cached for 10 minutes, and home/charts data is cached client-side, so new streams may not show up immediately: UNKNOWN timing.
- US-021-AC-05 - Active-user counter (heartbeat every 45 s while the tab is visible; `GET /api/stats/active-users?windowSeconds=120`) - no UI consumer found in the client; API-only.

**Business Rules:** BR-32 Stream threshold 20 seconds, once per song session. BR-33 Popularity window 7 days (UTC).

**Browser Validation Needed:** verify the network call `stream/{id}` at 20 s; replay of the same song counts again?; cache delay.

**Open Questions:** Are repeated plays of the same song counted (`hasStreamed` resets on `playSong`)?

---

## 4. Technical Behaviors Supporting User Stories

| ID | Technical Behavior | Evidence | Related User Story |
|---|---|---|---|
| TB-01 | Every `/api/*` request must carry header `X-App-Service-Key` equal to configured `ApiSecurity:SecretValue`; otherwise 401 `{message:"Unauthorized Access"}`. The client sends it from `VITE_API_SIGNATURE` (fallback literal `this-is-secret`). | `S:Middlewares/ApiAuthMiddleware.cs`, `C:services/axiosInstance.js` | All |
| TB-02 | JWT bearer auth (issuer/audience/lifetime validated); access token 60 min; refresh token in HttpOnly cookie with `token_type=refresh` claim, default 7 days | `S:Program.cs`, `S:TokenGenerator.cs`, `S:appsettings.json` | US-002, US-003 |
| TB-03 | Auth API contract: `POST /api/auth/register|login|refresh|logout`, `GET /api/auth/me`; responses carry `IsSuccess`, `Message`, `Token`, `User` | `S:AuthController.cs` | US-001..004 |
| TB-04 | Login/refresh return HTTP 200 with `IsSuccess:false` for refresh failure but 400 for login failure | `S:AuthController.cs` | US-002, US-003 |
| TB-05 | CORS allows specific origins (dev: localhost:5173/5174; prod: Netlify hosts) with credentials | `S:Program.cs` | All |
| TB-06 | Password hashing BCrypt; `Password` never returned in DTOs | `S:User.cs`, `S:UserDTO.cs` | US-001 |
| TB-07 | Elasticsearch is a hard startup dependency (`Elasticsearch` config required, app throws if missing); indices `songs`, `artists`; artist index auto-built on first search | `S:Program.cs`, `S:SongService.EnsureArtistsIndexed` | US-010 |
| TB-08 | Paged API responses use `PagedResult<T>` with `page`, `size` (minimums enforced in some endpoints: size >= 10 for `GetAll`, `SearchAll`, artist song lists) | `S:Helpers/PagedResult.cs`, `S:PaginationHelper.cs`, `S:SongService` | US-007, US-009, US-010 |
| TB-09 | `GET /api/song/popular` output cached 600 s varying by `page,size` | `S:SongController.cs` | US-008, US-021 |
| TB-10 | Songs without lyric URL are excluded from most listings, random batch and search (repo filter `!string.IsNullOrEmpty(LrcUrl)`), except category-popular songs and detail | `S:SongRepository.cs` | US-006..013 |
| TB-11 | Client data cache (`DataCacheContext`) for home, charts, explore, favorites; cleared on logout and favorite changes | `C:contexts/DataCacheContext.jsx` | US-005, US-008, US-016 |
| TB-12 | Heartbeat `POST /api/stats/heartbeat` every 45 s (visible tab) for signed-in users; token validation also marks user active; `GET /api/stats/active-users` open to all | `C:AuthContext.jsx`, `S:StatsController.cs`, `S:ActiveUserTracker.cs` | US-021 |
| TB-13 | Swagger UI available only in Development | `S:Program.cs` | - |
| TB-14 | Unused/unfinished server surface: `Playlist`, `SongPlaylist` entities and DB sets exist but no controller/service/UI; `GET /api/user/{id}` (any signed-in user can read any user's profile, incl. email) and client `userService.getUserById` | `S:Models/Entities/Playlist.cs`, `S:UserController.cs`, `C:services/userService.js` | U-06, U-09 |
| TB-15 | DB: PostgreSQL via EF Core; unique indexes User.Email, User.Username; Favorite PK (UserId, SongId); Rating cascade delete on Song; Song.Name, Artist.Name, Category.Name required | `S:Data/DBContext.cs` | US-001, US-015, US-017 |
| TB-16 | Server-side user-facing messages are hard-coded in Vietnamese | `S:Controllers`, `S:AuthService.cs` | US-002, US-015, US-017, US-018 |

---

## 5. Repository-Derived Business Rules

| Rule ID | Business Rule | Evidence | Related User Story | Confidence |
|---|---|---|---|---|
| BR-01 | Username and email must be unique | `AuthService.Register`, `DBContext` unique indexes | US-001 | REPOSITORY-CONFIRMED |
| BR-02 | Password minimum length 8 (client and server) | `SignIn.jsx`, `SignUp.jsx`, `AuthReqDTO`, `CreateUserDTO` | US-001, US-002 | REPOSITORY-CONFIRMED |
| BR-03 | DisplayName = username on registration; max 30 chars server-side | `SignUp.jsx`, `CreateUserDTO` | US-001 | REPOSITORY-INFERRED |
| BR-04 | Only Gmail addresses accepted by sign-up UI (after external validation) | `SignUp.jsx`, `emailValidationService.js` | US-001 | PARTIALLY-CONFIRMED (server has no such rule) |
| BR-05 | Access token 60 min; refresh token 7 days | `appsettings.json`, `TokenGenerator.cs`, `AuthController.cs` | US-002, US-003 | REPOSITORY-CONFIRMED |
| BR-06 | Distinct errors for unknown user vs wrong password | `AuthService.Login` | US-002 | REPOSITORY-CONFIRMED |
| BR-07 | Refresh cookie HttpOnly/Secure/SameSite=None | `AuthController.SetRefreshTokenCookie` | US-002 | REPOSITORY-CONFIRMED |
| BR-08 | Refresh token rotated on refresh | `AuthController.Refresh` | US-003 | REPOSITORY-CONFIRMED |
| BR-09 | Access token held in memory only | `AuthContext.jsx` | US-003 | REPOSITORY-CONFIRMED |
| BR-10 | Logout does not revoke access tokens | `AuthController.Logout` | US-004 | REPOSITORY-INFERRED |
| BR-11 | "Popular" = plays in last 7 days | `*Repository` popular queries | US-005, US-008 | REPOSITORY-CONFIRMED |
| BR-12 | Artist's main category = category with the most of the artist's songs | `ArtistRepository` (line ~73-77) | US-007, US-009 | REPOSITORY-INFERRED |
| BR-13 | Category songs sorted by total streams desc | `SongRepository` category query | US-007 | REPOSITORY-CONFIRMED |
| BR-14 | Charts show category ids 10 and 26 first | `TopChartsPage.jsx` | US-008 | REPOSITORY-CONFIRMED (intent unknown) |
| BR-15 | Main artist of a song = lowest `SongArtist.Id` | `SongService.GetPopularSongsAsMainArtistAsync` | US-009 | REPOSITORY-CONFIRMED |
| BR-16 | Related artists = same main category, excluding self | `ArtistController.GetRelatedArtist` | US-009 | REPOSITORY-CONFIRMED |
| BR-17 | Search results list artists first | `SongService.SearchAll` | US-010 | REPOSITORY-CONFIRMED |
| BR-18 | Only indexed songs are searchable | `SongService.SearchAll` | US-010 | REPOSITORY-INFERRED |
| BR-19 | Related songs limited to 30, sharing an artist | `SongRepository.GetRelatedSongs` | US-011 | REPOSITORY-CONFIRMED |
| BR-20 | Duration format `mm:ss`, default `00:00` | `SongRepository` | US-011, US-013 | REPOSITORY-CONFIRMED |
| BR-21 | Download filename sanitization | `SongViewPage.jsx` | US-012 | REPOSITORY-CONFIRMED |
| BR-22 | Next batch = random songs with lyrics | `SongRepository.GetRandomSongsAsync` | US-013 | REPOSITORY-CONFIRMED |
| BR-24 | Favorites page, favorite toggle, rating, stream require login | `App.jsx`, `[Authorize]` attributes | US-014..017, US-021 | REPOSITORY-CONFIRMED |
| BR-25 | One Favorite record per (user, song), soft-toggled | `Favorite.cs`, `SongRepository.ToggleFavorite` | US-015 | REPOSITORY-CONFIRMED |
| BR-26 | Like count counts `IsFavorite=true` only | `SongRepository` | US-015 | REPOSITORY-CONFIRMED |
| BR-27 | Favorites reorder is client-only | `FavoriteSongsPage.jsx` (no API) | US-016 | REPOSITORY-CONFIRMED |
| BR-28 | One rating per user per song enforced on client only; no server check/range validation | `RatingModal.jsx`, `RatingService.cs`, `RatingRepository.cs` | US-017 | REPOSITORY-CONFIRMED (absence of a server check) |
| BR-29 | Reviewer identity compared by username on client, shown by DisplayName | `RatingModal.jsx`, `RatingRepository.cs` | US-017 | REPOSITORY-INFERRED |
| BR-31 | Theme stored per browser (localStorage `selectedTheme`) | `SettingsDropdown.jsx` | US-019 | REPOSITORY-CONFIRMED |
| BR-32 | Stream counted once per playback after 20 s, signed-in only | `PlayerContext.jsx` | US-021 | REPOSITORY-CONFIRMED |
| BR-33 | Popularity window 7 days UTC | `*Repository` | US-021 | REPOSITORY-CONFIRMED |

(BR-23, BR-30 are minor and captured in the story text.)

---

## 6. Unknowns and Assumptions

| ID | Unknown | Why It Matters | How to Validate |
|---|---|---|---|
| U-01 | State of the environment: Elasticsearch `songs` index population, seed data volume, presence of songs without lyric | Search, charts, home and player results depend on data; empty-state tests need a known dataset | Inspect the running instance and DB/Elastic; capture a seed baseline |
| U-02 | Behavior after successful registration (auto-login / redirect / panel switch) | Determines the sign-up -> sign-in journey | Register in the browser; observe |
| U-03 | Gmail-only sign-up and external email-reputation dependency (server accepts any valid email) | CONFLICTING between client and server; blocks/complicates sign-up in test env | Try non-Gmail emails; check whether the validation service is reachable/mocked; test the API directly |
| U-04 | How songs get indexed into Elasticsearch; whether PostgreSQL ILIKE search is a fallback | Search reliability and freshness of new songs | Observe runtime; search newly added data |
| U-05 | Server-side rating rules (range 1-5, one per user, comment length) - none found | Data integrity risk; client-only protection | Send direct API calls with value 0/99/duplicate; observe |
| U-06 | Placeholder features: "Recommended for you", `/recent`, playlists (entities only), profile page | Determines what is in scope for coverage | Confirm with product owner / runtime |
| U-07 | Whether favorites ordering should persist; `Favorite` has no order column | Expected outcome after reload | Reorder, reload, compare |
| U-08 | Inconsistent "has lyrics" filter across queries (commented out for category songs) | May show songs that cannot be played/searched in some lists | Compare lists at runtime |
| U-09 | Authorization on `GET /api/user/{id}` (any signed-in user can read any profile incl. email) | Security/privacy concern | API test with two accounts |
| U-10 | Default and persisted language; completeness of the 5 translations | Localization test scope | Switch languages; compare keys |
| U-11 | Error/edge behavior for invalid ids (song/artist/category), negative or huge page/size | API returns 200 with null for category/artist by id | Runtime probe |
| U-12 | Autoplay/audio availability in automated browsers; real MP3/LRC hosting and CORS | Playback stories may not be verifiable headlessly | Try in headless Chromium |
| U-13 | Session cookie behavior on HTTP hosts (Secure + SameSite=None) | Session persistence tests in local/CI env | Run over HTTP vs HTTPS |
| U-14 | Behavior of the `AccessToken` cookie path (`OnMessageReceived`) | Possible alternate auth path | Check whether any response sets it |
| U-15 | Responsive design (README claims responsive UI) | Mobile viewport coverage | Resize/inspect |
| U-16 | Password change, forgot password (commented "Quên mật khẩu?" link), profile edit, avatar upload | Absent - confirm they truly do not exist | Runtime exploration |

---

## 7. Browser Exploration Candidates

Priority is by dependency and risk.

1. **Environment baseline (U-01, U-12, U-13):** confirm the API key header, Elasticsearch index state, seed data, audio playback in headless mode, HTTP vs HTTPS cookie behavior.
2. **Auth flows (US-001..004):** sign-up messages, post-registration behavior, Gmail restriction and external validation dependency, login errors, session restore on reload, logout, `/favorites` redirect.
3. **Members-only gating (US-014, US-015, US-017):** sign-in modal from the sidebar and player; favorite toggle and counters; rating modal rules and duplicates.
4. **Discovery and navigation (US-005..009, US-020):** home, genres, charts, category page, artist page (pagination, empty states, invalid ids, layout).
5. **Search (US-010):** suggestion thresholds, top result, tabs, pagination, no-result messages, special characters.
6. **Playback (US-013, US-021):** player controls, queue, shuffle/repeat, stream call at 20 s, lyric highlight.
7. **Song page (US-011, US-012):** detail elements, lyrics states, related songs toggle, download.
8. **Favorites playlist (US-016):** empty vs. filled, play all, reorder + reload, download.
9. **Preferences (US-018, US-019):** language switching/persistence, themes/persistence.
10. **API-level exploration (probe with Postman/curl):** validation gaps (U-05, U-09, U-11), status codes vs. bodies (TB-04), header requirement (TB-01), pagination minimums (TB-08).

Repository functionality worth exploring that has no clean story: heartbeat/active-user stats (TB-12), `playlist` data model (TB-14), `GET /api/user/{id}`, unused ILIKE search, "Recommended for you" placeholder, `/recent` route.

---

## 8. Coverage Summary

- **Number of user stories:** 21 (US-001 ... US-021).
- **By capability:**
  - Authentication: 4 (US-001..004)
  - Discovery/browse: 5 (US-005..009)
  - Search: 1 (US-010)
  - Song details / download: 2 (US-011, US-012)
  - Playback: 2 (US-013, US-021 popularity counting)
  - Personalization: 4 (US-014..017)
  - Preferences / layout: 3 (US-018..020)
- **By confidence:**
  - REPOSITORY-CONFIRMED: 13 (US-002, 003, 005, 006, 007, 009, 011, 013, 014, 015, 018, 019, 020)
  - REPOSITORY-INFERRED: 2 (US-012, US-021)
  - PARTIALLY-CONFIRMED: 5 (US-001, 004, 008, 016, 017)
  - REPOSITORY-CONFIRMED with runtime-dependent behavior: 1 (US-010)
  - UNKNOWN: 0; CONFLICTING: 0 at story level (the client/server Gmail conflict is preserved as U-03 within US-001)
- **Stories requiring browser validation:** all 21 (every story lists validation items; the highest-uncertainty ones are US-001, 008, 010, 012, 013, 016, 017).
- **Unsupported/inconclusive areas:** actual data (seed/Elastic), audio/lyrics hosting, download mechanics, cache timing, exact UI text under each language, behavior on invalid ids, responsive layout.
- **Potential missing functionality (not found in repo; do not assume it exists):** playlists (only entities), recently played (placeholder route), recommendations (placeholder section), forgot/reset password (commented-out link), profile/avatar editing, review edit/delete, admin/content management, account deletion, server-side persistence of favorites order, roles/permissions.
