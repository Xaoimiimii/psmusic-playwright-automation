# PSMusic - User Flows

Only flows evidenced by source code are listed. Sequence steps come from reading components/services; "State changes" refer to client state (React contexts, localStorage) and persisted server data. No flow was executed. API paths are relative to `/api` and require the `X-App-Service-Key` header (added automatically by the SPA).

Not present in the repository (no flows can be described): checkout/payment/orders/cart (not applicable - this is a music app), playlists (entities only), password reset, profile editing, account deletion, admin actions.

---

## F-01 Register account
- **Start:** `/auth`, click right-panel "Register" button (`register_btn`) to reveal the sign-up form. CONFIRMED.
- **Steps:**
  1. Enter Username, Email, Password (placeholders) and submit (Enter or "Register").
  2. Client: empty check -> `error_fill_info`; password < 8 -> `error_password_length`.
  3. Client: external email reputation call (`emailreputation.abstractapi.com`) -> checks SMTP, format, deliverable, Gmail in that order, each with its own error.
  4. `POST /auth/register {username,password,email,displayName=username,avatarURL=null}`.
  5. Success: green text `register_success`; form cleared. Failure: red text `response.data.message`.
- **Pages/components:** `AuthPage`, `SignUp.jsx`, `emailValidationService`, `authService.register`, `LoadSpinner`.
- **State changes:** DB row in `User` (BCrypt password). No client auth state change; no auto-login. CONFIRMED.
- **Alternatives:** duplicate email (`Email đã tồn tại`), duplicate username (`Tài khoản đã tồn tại`), model-validation failures (`Dữ liệu không hợp lệ.` or automatic 400), external service failure (falls to `error_smtp` key - missing translation), display name > 30 chars (server rejects; client sends username as display name).
- **Rules:** BR-A1..A4 in `business-rules.md`.

## F-02 Log in
- **Start:** `/auth` (default panel) or Header "Login" button (`navigate('/auth')`) or AuthModal "Login Now".
- **Steps:** enter Username + Password -> client empty/length checks -> `POST /auth/login` -> on success store token in memory, set `user`, show `login_success`, after 1 s `navigate('/')`.
- **API:** `POST /auth/login` (+ `Set-Cookie: RefreshToken`).
- **State changes:** `AuthContext` (`user`, `accessToken`), axios default header; heartbeat interval starts (`POST /stats/heartbeat` immediately and every 45 s); `Header` swaps Login button for avatar button.
- **Alternatives:** `Tài khoản không tồn tại`, `Sai mật khẩu`, empty fields, password < 8 (client-side), password visibility toggle, panel switch resets fields, network error -> generic message.
- CONFIRMED (behavior after render UNKNOWN).

## F-03 Restore session on load / silent refresh
- **Start:** any page load.
- **Steps:** `AuthProvider` -> `POST /auth/refresh` (cookie) -> if response has `token` and `user` -> logged in. Any later 401 -> refresh once and retry; refresh failure -> logout.
- **State changes:** `loading` true -> false; new refresh cookie (rotation).
- **Alternatives:** no cookie (200 `isSuccess:false`), expired cookie, server down (catch -> guest).

## F-04 Log out
- **Start:** signed in; click avatar button -> "Logout" option.
- **Steps:** `POST /auth/logout` (errors swallowed) -> clear user/token/header -> `clearCache()` -> `navigate('/')`.
- **State changes:** refresh cookie deleted (server), client caches cleared. Player state (`PlayerContext`) is **not** reset by logout (no code) - the current song may continue. UNKNOWN at runtime.

## F-05 Browse Home -> Genre -> Song/Artist
- **Start:** `/`.
- **Steps:** `GET /category/popular?page=1&size=50`, `GET /artist/popular` (cached in `DataCacheContext`) -> click a genre card -> `/category/{id}` (`GET /category/{id}`, `/artist/category/{id}?page&size=10`, `/song/category/popular/{id}?page&size=12`) -> paginate -> click a song card title -> `/song/{id}`; click artist -> `/artist/{id}`.
- **Alternatives:** empty data -> `EmptyState`; API failure -> empty/err state; "See all" links to `/genres` and `/charts`.
- **Rules:** popular = streams in last 7 days; only categories/artists with >= 1 recent stream are listed.

## F-06 Explore genres and charts
- **Start:** sidebar "Genres & Topics" (`/genres`) or "Charts" (`/charts`).
- **Steps:** load categories then per-category top songs (10) -> click song title/artist -> detail pages; "See all" -> `/category/{id}`; rows can be played by clicking.
- **Rules:** charts order puts category ids 10 and 26 first; first two charts use dual-column layout.
- **Note:** no favorite control on charts (F-11 only from player bar).

## F-07 Search
- **Start:** header search box (any layout page).
- **Steps (suggestions):** focus + type >= 2 chars (trimmed) -> after 300 ms `GET /song/search?keyword&page=1&size=5` (server raises size to 10) -> suggestion box (top result first, then results) -> click item -> `/artist/{id}` or `/song/{id}` (navigation on mousedown).
- **Steps (results):** press Enter with non-blank query -> `/search?q=<trimmed>`; page loads `GET /song/search?keyword&page&size=12` -> tabs All / Songs / Artists update `t` param and reset `page=1`; pagination updates `page` param (Songs tab only shows Pagination in code read; Artists tab shows all artists returned).
- **Alternatives:** no results -> `not_found_msg "keyword"`; empty keyword -> nothing loaded; clear button resets input and suggestions; box closes 150 ms after blur.
- **Business rules:** exact (case-insensitive) name match = Top result; artists precede songs.
- **Dependencies:** Elasticsearch `songs` and `artists` indices.

## F-08 View song detail and lyrics
- **Start:** `/song/{id}` from a link/suggestion/player title click.
- **Steps:** `GET /song/{id}/detail`; then in parallel `GET /song/{id}/related`, `GET /artist/{id}/artists` (song id), and `fetch(lyricUrl)` (LRC). Lyrics parsed and rendered; current line highlight follows player time if the same song is playing; "Show more/less" toggles collapsed lyric height; related table max 30 with "View more/Show less" if > 4.
- **Alternatives:** 404 -> `song_not_found`; missing lyrics -> `no_lyrics_yet`; lyric fetch failure -> empty lyrics; related failure -> empty.
- **Actions:** Play/Pause (`btn-play`), Download (`btn-download`); heart/star on this page are display-only.

## F-09 Play music with player controls
- **Start:** any Play affordance: song card play button (`ItemCardColumn`/`ItemCardRow`), row click/hover play (`TrackTable`), song detail Play, artist Play, favorites "Play All".
- **Steps:** `startNewSession(song)` (or `playPlaylist`) -> set `currentSong`, show player bar, `isPlaying=true` -> `GET /song/{id}/player` for audio URL, likes, favorite/review flags -> `GET /song/next-batch` (size default 10) to fill the queue after the current song -> `<audio>` plays `playerData.audioUrl`.
- **Controls (PlayerControl):** play/pause; previous/next (next auto-appends another batch when <= 3 songs remain); shuffle (current first, others shuffled; toggling off restores the original queue); repeat cycle Off(0) -> All(1) -> One(2); seek slider; volume slider (default 0.7); mute (stores last volume); download (anchor download); rate; favorite; title click -> `/song/{id}`.
- **On song end:** `onEnded = playNextSong` (repeat One restarts the same audio).
- **Streaming stat:** after `currentTime >= 20` s and only if signed in and not yet counted for this play, `POST /song/stream/{id}`; `hasStreamed` resets in `playSong`/`startNewSession` (so re-selecting the same song counts again).
- **Alternatives/edge:** guest can play; `PlayerControl` shows "Loading song data..." until player data arrives; queue begins with history `queue.slice(0, queueIndex+1)`.
- **Uncertain (runtime):** duplicated player bar rendering, autoplay policy, audio source availability.

## F-10 Guest hits a members-only action
- **Start:** guest clicks sidebar "Favorites", player heart, or player star.
- **Steps:** navigation/action prevented -> `AuthModal` (title "Start Listening") -> "Login Now" -> `/auth` (from the player it also pauses audio) or "Maybe Later"/X/overlay -> close.
- **Direct URL:** `/favorites` as guest -> redirect `/auth` (after spinner).

## F-11 Favorite / unfavorite a song
- **Start:** signed-in user with a song loaded in the player bar (heart `div` with tooltip "Add Favorite"/"Remove Favorite").
- **Steps:** click -> `POST /song/{id}/favorite-toggle` -> `{isFavorited}` -> update local `playerData` (`isFavorited`, `likes` +/-1), `updateSongFavoriteStatus` (DataCache broadcast `lastFavoriteUpdate`), `clearCache('favorites')`. Concurrent clicks blocked by `updatingFavorite`.
- **Alternatives:** guest -> AuthModal; API error swallowed (state unchanged).
- **Rules:** one `Favorite` row per (user,song), flag toggled; like count counts `IsFavorite` rows.

## F-12 View favorites playlist
- **Start:** sidebar Favorites (signed in) or avatar menu "Favorite Playlist" -> `/favorites`.
- **Steps:** cached list or `GET /song/favorites` -> shows playlist header, featured artists (top 3 by frequency + "& N others"), table of songs; "Play All"/"Pause"; drag to reorder (client-only; also updates current play queue); "Show More/Less"; "Download Playlist" (sequential anchor downloads with 1 s delay).
- **Empty:** `NoFavoriteState` (`no_favorite_msg`).
- **State changes:** `DataCache.favorites` cached until cleared; reorder is not persisted.

## F-13 Rate and review a song
- **Start:** signed-in user, song in player, star button (`data-tooltip="Rate Song"`).
- **Steps:** open `RatingModal` -> `GET /rating/{songId}/reviews` -> if the user has not reviewed: choose 1-5 stars (click; hover preview), optional comment -> submit -> `POST /rating/{songId}/add-review {rating, comment, user}` (`user` = `user?.username`; corrected 2026-09-30 from `{rating, comment}` after rereading `RatingModal.jsx` lines 112-116 and the runtime request body. The server DTO ignores `user`) (comment defaults to `(Không có bình luận)` when empty) -> prepend synthesized review, reset form; player `reviews` +1 and `isReviewed` true.
- **Alternatives:** already reviewed -> only the list is shown; server/network error -> toast "Không thể gửi đánh giá. Vui lòng thử lại."; guest -> AuthModal.
- **Rules:** duplicate prevention client-only; server has none.

## F-14 Artist page and playing an artist
- **Start:** `/artist/{id}`.
- **Steps:** `GET /artist/{id}`, `/song/artist/main/{id}`, `/song/artist/collab/{id}` (page size 10 each, independent pagination), `/artist/related/{id}` (client-side 4 per page). "Play" -> if current song belongs to the artist's loaded songs toggles pause/play, else `playPlaylist(mainSongs, 0)` (or collab list if no main songs).
- **Alternatives:** API errors -> red error text; related failure -> empty.

## F-15 Change language / theme
- **Language:** open language dropdown -> choose native-name option -> `i18n.changeLanguage`, `<html lang>` updated (vi, en, de, ja, ru); fetches `/locales/{lng}/translation.json`. Available on layout header and on `/auth`.
- **Theme:** open settings dropdown -> choose theme -> CSS variables applied on `<html>` and `localStorage.selectedTheme` set; restored on load.
- Persistence of language: default `i18next-browser-languagedetector` order/caching (localStorage `i18nextLng` by library default - not in source, INFERRED).

## F-16 Recently played / Recommendations (not implemented)
- `/recent` renders a placeholder; "Recommends for you" sections are empty containers; external tracking SDK is loaded but no consumer code was found. No flow can be established **from the repository**.
- Validation note (2026-09-30): at runtime the third-party tracker fills these containers and shows a popup (`../browser/recommendations.md`, user story US-022). "Not implemented" is true only of this repository. The feature exists at runtime and is delivered by another team's service.
