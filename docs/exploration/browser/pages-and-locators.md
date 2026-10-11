# PSMusic - Pages and Locators (Browser Runtime Exploration)

All locators below were **verified against the rendered DOM / accessibility tree** on 2026-09-30 in English UI (`i18nextLng=en`) unless stated. Labels: see `application-overview.md`.

## 0. Global DOM facts that drive locator strategy (RUNTIME-OBSERVED)

1. **No test ids.** `document.querySelectorAll('[data-testid],[data-test],[data-cy]')` returned 0 on every page checked.
2. **Almost no `id` attributes.** The only app-level ids seen were `root`, `_goober` (toast lib), and third-party `recsys-*` ids.
3. **CSS Modules hashed class names** (`_nav-item_b9zro_43`, `_play-pause-btn_5mrne_341`). The readable prefix is stable in the source, but the hash suffix can change between builds. If CSS is used at all, prefer `[class*="play-pause-btn"]`-style partial matches, and treat them as **fragile**.
4. **Accessible names are translated.** Every text-based locator depends on the pinned language. Pin `localStorage.i18nextLng` before page load.
5. **Many icon-only controls have no accessible name** (header arrows, theme button, all player buttons, password eye toggles, modal close buttons).
6. **Player controls are rendered 2-3 times** at identical fixed positions while a song plays (`[class*=player-controls-new]`: 2 on `/`, 3 on `/song/:id`). Only the copy under `[class*=playerWrapper]` is reliably scoped. See `automation-considerations.md` AC-3.
7. **Third-party overlays** (`#recsys-privacy-banner`, `[id^="recsys-popup-host"]`) can intercept clicks.

Stability legend: **S** stable (role/name/placeholder/href), **M** medium (depends on language or structure), **F** fragile (hashed class, index).

---

## 1. Sidebar (all pages except `/auth`)

| Element | Purpose | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|---|
| Logo | Go home | role link | `getByRole('link', { name: 'PS music MUSIC SOCIAL NETWORK' })` | M | Same link also exists in the footer, so scope it to `complementary` |
| Discover | Nav -> `/` | role link | `getByRole('complementary').getByRole('link', { name: 'Discover' })` | M | VI: "Khám Phá" |
| Genres & Topics | Nav -> `/genres` | role link | `getByRole('link', { name: 'Genres & Topics' })` | M | VI: "Chủ Đề & Thể Loại" |
| Charts | Nav -> `/charts` | role link | `getByRole('link', { name: 'Charts' })` | M | VI: "Bảng Xếp Hạng" |
| Favorites | Nav -> `/favorites` (guest: opens auth modal instead) | role link | `getByRole('link', { name: 'Favorites' })` | M | `href="/favorites"`; alt: `aside a[href="/favorites"]` (S) |
| Active nav marker | Current route | class | `[class*="_active"]` on the nav link | F | |

## 2. Header (`banner`)

| Element | Purpose | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|---|
| Back / forward arrows | History navigation | CSS | `header [class*="nav-arrow"]` (nth 0 / 1) | F | No accessible name. Behavior NOT TESTED |
| Search box | Search input | placeholder / role | `getByPlaceholder('Search songs, artists, ...')` or `getByRole('textbox', { name: 'Search songs, artists, ...' })` | M | VI placeholder "Tìm kiếm bài hát, nghệ sĩ, ..."; Enter navigates to `/search?q=` |
| Language button | Opens language menu | role button | `getByRole('button', { name: 'Language' })` | M | Has `title="Language"` (translated) |
| Language options | Change language | role button | `getByRole('button', { name: 'English' })`, `'Tiếng Việt'`, `'日本語'`, `'Русский'`, `'Deutsch'` | S | Native names, so they don't change with language |
| Theme button | Opens theme menu | CSS | `header [class*="icon-button"]` without `title` (2nd icon button) | F | No accessible name |
| Theme options | Pick theme | role button | `getByRole('button', { name: 'Sapphire' })` (Ruby, Amethyst, Sapphire, Emerald, Topaz, Aquamarine) | S | Menu heading "Theme Color" |
| Login button (guest) | Go to `/auth` | role button | `getByRole('banner').getByRole('button', { name: 'Login' })` | M | Absent while logged in |
| User avatar (logged in) | Opens user menu | CSS | `header [class*="user-avatar"]` | F | No accessible name |
| User menu: display name | Shows display name | text | `getByRole('banner').getByText('<displayName>')` | M | |
| User menu: Favorite Playlist | -> `/favorites` | role link | `getByRole('link', { name: 'Favorite Playlist' })` | M | |
| User menu: Logout | Logout | role button | `getByRole('button', { name: 'Logout' })` | M | |

## 3. Privacy banner (third-party, first visit)

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Banner | id | `#recsys-privacy-banner` | S (3rd party) | Heading "We respect your privacy" |
| Decline | id / role | `#recsys-decline` / `getByRole('button', { name: 'Decline' })` | S | Stores `recsys_consent_status` in localStorage |
| Accept all | id / role | `#recsys-accept` / `getByRole('button', { name: 'Accept all' })` | S | Not clicked this session |

## 4. Home `/`

| Element | Strategy | Value | Stab. |
|---|---|---|---|
| "Discover by Genre" section | heading | `getByRole('heading', { name: 'Discover by Genre', level: 2 })` | M |
| Genre tile | link by href | `main a[href="/category/10"]` (tile contains `img` + `h3` with genre name) | S (href), M (name) |
| See all (genres) | link | `getByRole('link', { name: 'See all' })` - 2 on page (`/genres`, `/charts`); scope to the section | M |
| "Trending Artists" section | heading | `getByRole('heading', { name: 'Trending Artists' })` | M |
| Artist card | link by href | `main a[href="/artist/166"]` (2 links per card: avatar and name) | S |
| "Recommends for you" | heading | `getByRole('heading', { name: 'Recommends for you' })` | M; content comes from the third-party service (empty for guest on first load) |

## 5. Genres `/genres`

| Element | Strategy | Value | Stab. |
|---|---|---|---|
| Genre section heading | heading | `getByRole('heading', { name: 'Discover Pop Genre' })` (pattern `Discover <Genre> Genre`) | M |
| Song card title | link by href | `a[href="/song/539"]` | S |
| Song card artist | link by href | `a[href="/artist/69"]` | S |
| Card Play button | role | `getByRole('button', { name: 'Play' })` scoped to the card | M; ~40 identical "Play" buttons per page, so always scope |

## 6. Charts `/charts`

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Chart heading | heading | `getByRole('heading', { name: 'Top Western Music' })` (`Top <Genre>`) | M | Order observed: Vietnamese Music, Western Music, Vietnamese Youth Music, Pop |
| See all | link | `a[href="/category/26"]` inside the section | S | |
| Row | CSS | `[class*="_row_"]` | F | Rank cell `[class*="rankColumn"]`, top ranks get `rank-1`… classes |
| Song title | role button | `getByRole('button', { name: 'Starboy' })` | M | Click navigates to `/song/:id`; **no href**, so the song id is not in the DOM |
| Artist names | text | `span[class*="artistName"]` | F | Plain spans, **not links** |
| Duration | CSS | `[class*="sr-duration"]` | F | Only in single-column charts (Youth, Pop); the first two side-by-side charts show no duration |

## 7. Category `/category/:id`

| Element | Strategy | Value | Stab. |
|---|---|---|---|
| Title | heading h1 | `getByRole('heading', { level: 1 })` (e.g. "Pop") | S |
| Featured Artists | heading + buttons | `getByRole('heading', { name: 'Featured Artists' })`; artist entries are **buttons** with the artist name | M |
| Songs | heading | `getByRole('heading', { name: 'Songs', exact: true })` | M |
| Song link | href | `main a[href^="/song/"]` | S |
| Pagination (x2: artists, songs) | role button | `getByRole('button', { name: 'Previous' })`, `'Next'`, numeric `'2'`; active page class `page-button-active`; `Previous` is `disabled` on page 1 | M; two pagers per page, so scope by section. **Page is not reflected in the URL** |

## 8. Artist `/artist/:id`

| Element | Strategy | Value | Stab. |
|---|---|---|---|
| Artist name | h1 | `getByRole('heading', { level: 1 })` | S |
| Play | role | `getByRole('main').getByRole('button', { name: 'Play' })` | M |
| Main Songs / Collaboration Songs / Related Artists | h2 | `getByRole('heading', { name: 'Main Songs' })` etc. | M |
| Song title | role button | `getByRole('button', { name: '<song title>' })` | M (no href) |
| Pagination | role button | `Previous` / `1` / `2` / `Next` | M |

## 9. Song detail `/song/:id`

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Label "Song" + title | h1 | `getByRole('heading', { level: 1 })` | S | |
| Artist line | paragraph under h1 | text e.g. "Hoàng Dũng, Hoàng Rob" | M | |
| Favorite / review counters | CSS | `main [class*="action-buttons"] [class*="icon-button"] span` (1st = favorites, 2nd = reviews) | F | Non-interactive `div`s; values do not update live after favoriting |
| Play | role | `getByRole('main').getByRole('button', { name: 'Play' }).first()` | M | |
| Download | role | `getByRole('button', { name: 'Download' })` | M | NOT TESTED |
| Lyrics block | text | label "Lyrics", lines as `paragraph`s; `getByRole('button', { name: 'Show More' })` | M | |
| Artists list | h2 + rows | `getByRole('heading', { name: 'Artists' })`; rows are `div[class*="artist-row"]` with `cursor:pointer` (not links) | F | |
| Other songs by … | h2 | `getByRole('heading', { name: /^Other songs by/ })`; `getByRole('button', { name: 'View More' })` | M | Up to 30 rows |
| Recommends for you | h2 + shadow DOM | cards: `[class*="recommendSongDetails"] .recsys-item` (inside an open shadow root; `.recsys-name`, `.recsys-value`, `data-id` = recsys id, not song id). Click -> `/song/{DomainItemId}` | F (3rd party) | See `recommendations.md` |
| Recommendation popup cards | shadow DOM | `[id^="recsys-popup-host"] .recsys-item` (50 items); close `button.recsys-close` | F (3rd party) | Blocks clicks while open |
| Not-found state | text | `getByText('Song not found')` | M | Shown for `/song/99999999` |

## 10. Player bar (after playback starts)

Scope all player locators to **`[class*="playerWrapper"] [class*="player-controls-new"]`**, because unscoped matches return 2-3 copies.

| # | Control | Verified locator | Stab. | Notes |
|---|---|---|---|---|
| 0 | Shuffle | `button:has(svg.lucide-shuffle)` / `[class*="shuffle-btn"]` | M/F | |
| 1 | Previous | `button` index 1 (svg polygon, no class) | F | No accessible name |
| 2 | Play / Pause | `[class*="play-pause-btn"]` | F | |
| 3 | Next | `button` index 3 | F | |
| 4 | Repeat | `button:has(svg.lucide-repeat)` / `[class*="repeat-btn"]` | M/F | |
| 5 | Rate | `[class*="rating-btn"]`; gets extra class `_rated_…` when the user already reviewed | F | Guest: opens auth modal |
| 6 | Download | `button` index 6 | F | NOT TESTED |
| 7 | Mute / Unmute | `[class*="volume-control-container"] button`; `data-tooltip` is the translated "Mute" / "Unmute" (EN) | F | No accessible name (icon only). Verified at runtime 2026-10-09 |
| - | Favorite (heart) | `[class*="player-main-row"] [class*="icon-button"]:has(svg.lucide-heart)` | M | **A `div`, not a button.** Favorited state: `svg[fill="white"]`, not favorited: `fill="transparent"` |
| - | Volume slider | `input[type=range][class*="volume-range-input"]` (min 0, max 1, step 0.01, default 0.7) | F | The song page renders the volume container **3 times**: scope to the player bar. Runtime 2026-10-09 (guest, song 1): default `audio.volume` 0.7 / slider 0.7; slider 0.3 → audio 0.3; Mute → 0 and tooltip "Unmute"; Unmute → 0.3 and tooltip "Mute". Matches `PlayerControl.jsx` `toggleMute` (restores the last non-zero volume, fallback 0.5) |
| - | Seek slider | `input[type=range][class*="seek-range-input"]` (max = duration in s) | F | |
| - | Title / artist / time | `[class*="player-main-row"]` text: title, artists, `mm:ss` elapsed, `mm:ss` total | F | |
| - | Audio element | `audio` (single element; `currentTime`, `paused`) | S | Best oracle for "is playing" |

## 11. Auth modal (guest hitting a member action)

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Modal | CSS | `[class*="modalContent"]` | F | **No `role="dialog"`** |
| Heading | role | `getByRole('heading', { name: 'Start Listening' })` | M | |
| Login Now | role | `getByRole('button', { name: 'Login Now' })` | M | Rendered uppercase via CSS |
| Maybe Later | role | `getByRole('button', { name: 'Maybe Later' })` | M | Closes modal |
| Close X | CSS | first `button` in the modal | F | No name |

## 12. Rating modal (logged in, player "Rate")

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Modal | CSS | `[class*="rating-modal"]` (+ `[class*="modal-overlay"]`) | F | No `role="dialog"`; **Vietnamese-only text** |
| Heading | role | `getByRole('heading', { name: /^Đánh Giá và Bình luận về/ })` | M | |
| Stars | CSS | 5 clickable `svg[aria-hidden=true]` in the first row | F | Clicking `[class*=star]` nth(3) produced `rating: 3`, so the index-to-value mapping needs care |
| Comment | placeholder | `getByPlaceholder('Viết bình luận của bạn (Không bắt buộc)...')` | M | Optional |
| Submit | role | `getByRole('button', { name: 'Gửi đánh giá' })` | M | Disabled until a star is chosen; **absent** once the user has reviewed |
| Community list | heading | `getByRole('heading', { name: 'Bình luận từ cộng đồng' })`; item = `strong` (author) + `paragraph` (comment) + "Ngày: <date>" | M | |

## 13. Favorites `/favorites` (logged in)

| Element | Strategy | Value | Stab. |
|---|---|---|---|
| Empty state | text | `getByText('Add your favorite songs to see them here!')` | M |
| Title | h1 | `getByRole('heading', { name: 'Favorite Playlist' })` | M |
| Featured artist line | text | "Featured Artist: <names>" | M |
| Play All | role | `getByRole('button', { name: 'Play All' })` | M |
| Download Playlist | role | `getByRole('button', { name: 'Download Playlist' })` (NOT TESTED) | M |
| Reorder hint | h2 | "Drag and drop to reorder" (drag NOT TESTED) | M |
| Row | role button | `getByRole('button', { name: /^1 Chờ Anh Nhé/ })`, containing a nested title button | M |

## 14. Auth page `/auth`

Both forms are **always in the DOM**, and both count as "visible" by bounding box even though one is covered (see `evidence/psmusic-auth-default.png`). Always scope to a form.

| Element | Strategy | Value | Stab. | Notes |
|---|---|---|---|---|
| Login form | form filter | `page.locator('form').filter({ has: getByRole('heading', { name: 'Login' }) })` | M | Shown by default |
| Login username | placeholder in form | `loginForm.getByPlaceholder('Username')` | M | `input[name="name"]` (**same name in both forms**) |
| Login password | placeholder in form | `loginForm.getByPlaceholder('Password')` | M | `input[name="password"][type=password]` |
| Password eye toggle | CSS in form | `loginForm.locator('button[type=button]')` | M | Toggles `type` password <-> text |
| Login submit | role in form | `loginForm.getByRole('button', { name: 'Login' })` | M | A second "Login" button exists in the overlay panel |
| Register form | form filter | heading "Create Account" | M | |
| Register fields | placeholders | `Username`, `Email` (`type=email`, `name=email`), `Password` | M | |
| Register submit | role in form | `registerForm.getByRole('button', { name: 'Register' })` | M | |
| Switch to Register | overlay button | `getByRole('button', { name: 'Register' }).last()` | F | Overlay "Welcome Back!" panel |
| Switch to Login | overlay button | overlay "Welcome!" panel `Login` button | F | |
| Inline message | tag in form | `loginForm.locator('small')` | M | Used for client validation, server errors and the success text; persists (>15 s) |
| Language | role | `getByRole('button', { name: 'Language' })` | M | Only header control on `/auth` |

## 15. Findings from the Song Details automation run (2026-10-06)

Observed while implementing and running `tests/song/song-details.spec.ts` and `tests/shared/not-found.spec.ts` against `https://localhost:5174` / `https://localhost:7215` (dev build), and in `SongViewPage.jsx`. Locators used are in `src/pages/song.page.ts`.

| # | Observation | Evidence |
|---|---|---|
| S-1 | The no-lyrics text is **"No lyrics available :("** (`no_lyrics_yet`), not "no lyrics yet" as written in TS-SONG-03 | RUNTIME-OBSERVED (song 933) + `translation.json` |
| S-2 | When the LRC request fails, the page shows the same "No lyrics available :(" message; title, artists and Play keep working, and Play starts playback. This answers the open question of US-011-AC-08 with the current behavior (pending decision) | RUNTIME-OBSERVED (TS-SONG-07, aborted LRC) + source (`.catch(() => [])`) |
| S-3 | Artist names under the title are `span[class*="artist-link"]` with an onClick handler: no `href`, no link role. The artist names and the Artists rows come from `GET /api/artist/{songId}/artists`; `detail.artist` is the same names joined with ", " | RUNTIME-OBSERVED (TS-SONG-01) + source |
| S-4 | Collapsed lyrics and "Other songs" lists keep every row in the DOM (CSS `max-height`), so `toBeVisible()` cannot tell collapsed from expanded. The state is read from the container class (`lyrics-collapsed`/`lyrics-expanded`, `songs-collapsed`/`songs-expanded`) and the list height | RUNTIME-OBSERVED (TS-SONG-03, TS-SONG-05) |
| S-5 | Other-song rows: one `button[class*="sr-title-songtab"]` per row holds the title. The related list has no defined order, so tests compare titles as sets. View More appears only for more than 4 rows (song 1129 with 4 shows none); with 0 rows the section is not rendered (song 1349) | RUNTIME-OBSERVED (TS-SONG-05) |
| S-6 | The page heart and star have no click handler: clicking them sends no `favorite-toggle` or `add-review` request (US-011-AC-07 holds) | RUNTIME-OBSERVED (TS-SONG-01) |
| S-7 | F-5 reconfirmed for the heart: after in-app navigation from `/favorites` the heart is filled (`svg fill="white"`); after a hard reload it is empty while `/player` returns `isFavorited:true` (known defect US-011-AC-06) | RUNTIME-OBSERVED (TS-SONG-06) |
| S-8 | Unknown song: `GET /api/song/99999999/detail` returns **404** `{"message":"Không tìm thấy bài hát"}`; `/song/99999999` shows "Song not found" | RUNTIME-OBSERVED (TS-SONG-02) |
