# PSMusic - Pages, Features and Locator Candidates

Source: `PSMusic/psmusic.client/src` (`C:`). No browser was used. Every locator below is **SOURCE-INFERRED - REQUIRES BROWSER VALIDATION** unless stated otherwise.

## 0. Key facts about the DOM that drive locator choice

| Fact | Evidence | Confidence |
|---|---|---|
| **No `data-testid`, `data-test`, `data-cy` anywhere** in `.jsx` | grep over `C:` | CONFIRMED |
| **No `id=` attributes** in any component | grep over `C:` | CONFIRMED |
| **No `<label>` elements**; inputs use `placeholder` only | `SignIn.jsx`, `SignUp.jsx`, `Header.jsx` | CONFIRMED |
| Few ARIA attributes: `role="tablist/tab"` + `aria-selected` (search tabs), `aria-label="Play"` (card/row play buttons), `aria-label="Like"` (unused component), `aria-label="Search categories"` | `SearchTab.jsx`, `ItemCardColumn.jsx`, `ItemCardRow.jsx`, `ItemTopCharts.jsx` | CONFIRMED |
| Player-bar buttons have **no accessible name**: they are icon-only `<button>`s with a `data-tooltip` attribute (localized text) | `PlayerControl.jsx` | CONFIRMED |
| CSS class names are **CSS-Modules-hashed** at build time (`styles["name"]`), so class names in source are not stable selectors | all `*.module.css` usage | CONFIRMED (hash format UNKNOWN) |
| UI text is localized via i18next; language chosen by browser detector (fallback `en`), so role+name locators depend on language | `C:i18n.js` | CONFIRMED |
| Both Sign-In and Sign-Up forms are **mounted at the same time** on `/auth` (CSS toggles which is visible), so `input[name=name]` / `input[name=password]` occur twice | `AuthPage.jsx` renders `<SignUpForm/>` and `<SignInForm/>` unconditionally | CONFIRMED |
| Player bar can be rendered **twice** while visible (`ClientLayout` renders `<PlayerControl/>` inside `appBody` and again in `playerWrapper`); some pages also render `<PlayerControl/>` themselves (SongViewPage, FavoriteSongsPage) | `C:layouts/ClientLayout/ClientLayout.jsx`, pages | CONFIRMED (duplicate visibility at runtime UNKNOWN) |
| A single hidden `<audio>` element is rendered by `PlayerProvider` (no controls, no id) | `PlayerContext.jsx` | CONFIRMED |
| Toasts via `react-hot-toast` `<Toaster>` in the layout | `ClientLayout.jsx` | CONFIRMED (DOM role of toast UNKNOWN) |

**Recommended locator order (given the above):** `getByRole` with localized names (pin the language, see `automation-considerations.md`) -> `getByPlaceholder` for inputs -> `getByRole('tab')` for search tabs -> `getByAltText` for images with meaningful alt -> scoped structural locators (e.g. within `header`, `aside`, `footer`, `main`, `form`) -> CSS-module class **substring** selectors (`[class*="..."]`) as last resort. Ask the SUT team to add `data-testid` if automation is to be stable (out of scope here; SUT is read-only).

Semantic containers present (CONFIRMED): `<aside>` sidebar, `<header>` header, `<main>` main content, `<footer>` footer, `<nav>` inside sidebar, `<form>` on auth forms and rating modal.

---

## 1. Route table

| Route | Page/feature | Component (entry) | Auth |
|---|---|---|---|
| `/auth` | Sign in / Sign up (sliding panels) | `C:pages/Auth/AuthPage.jsx` | public, **outside** `ClientLayout` (no sidebar/header/player) |
| `/` | Home ("Discover") | `C:pages/HomePage/HomePage.jsx` | public |
| `/genres` | Explore genres | `C:pages/ExploreCategoriesPage/ExploreCategoriesPage.jsx` | public |
| `/charts` | Top charts | `C:pages/TopChartsPage/TopChartsPage.jsx` | public |
| `/song/:songId` | Song detail | `C:pages/SongViewPage/SongViewPage.jsx` | public |
| `/artist/:id` | Artist page | `C:pages/ArtistPage/ArtistPage.jsx` | public |
| `/category/:id` | Genre page | `C:pages/CategoryPage/CategoryPage.jsx` | public |
| `/search?q=&t=&page=` | Search results | `C:pages/SearchResult/SearchResultPage.jsx` | public |
| `/favorites` | Favorite playlist | `C:pages/FavoriteSongsPage/FavoriteSongsPage.jsx` | `PrivateRoute` -> redirect `/auth` |
| `/recent` | Placeholder `<div>Nghe Gần Đây</div>` (hard-coded Vietnamese) | inline in `App.jsx` | `PrivateRoute`; not linked from any nav |
| (no catch-all) | unknown paths | none in `App.jsx` | UNKNOWN runtime result |

`/player` is referenced in `ClientLayout` (`pathname.startsWith('/player')`) but no such route exists in `App.jsx` (dead code). CONFIRMED.

All routes CONFIRMED in `C:App.jsx`.

---

## 2. Shared layout (ClientLayout)

Source: `C:layouts/ClientLayout/ClientLayout.jsx`. Renders `Toaster`, `Sidebar`, `Header`, `<main><Outlet/></main>`, `Footer`, and `PlayerControl` when `isPlayerVisible`.

### 2.1 Sidebar (`C:components/Sidebar/Sidebar.jsx`)
| Element | Type | Attributes / text (en) | Locator candidate |
|---|---|---|---|
| Logo link | `<a href="/">` containing "PS" + "music" + subtitle `logo_subtitle` ("MUSIC SOCIAL NETWORK") | | `getByRole('link', {name: /PS\s*music/i})` scoped to `aside` |
| Discover | `<a href="/">` inside `nav > ul > li` | `discover` -> "Discover" | `aside`.getByRole('link',{name:'Discover'}) |
| Genres | `<a href="/genres">` | `genres` -> "Genres & Topics" | ...name 'Genres & Topics' |
| Charts | `<a href="/charts">` | "Charts" | |
| Favorites | `<a href="/favorites">` with click guard | "Favorites"; for guests `preventDefault` + opens AuthModal | |
Stability: text depends on language; `href` values are stable (CONFIRMED in source) -> `aside a[href="/genres"]` is language-independent (SOURCE-INFERRED).
Active item gets an `active` CSS-module class (hashed).

### 2.2 Header (`C:components/Header/Header.jsx`)
| Element | Type | Stable attributes | Notes |
|---|---|---|---|
| Back / forward | two `<button>` with lucide `ChevronLeft/Right` icons, no text/label | none | `header` first two buttons; call `navigate(-1)/(1)` |
| Search input | `<input type="text">` | `placeholder` = `search_placeholder` ("Search songs, artists, ...") | `getByPlaceholder`; no name/id |
| Search clear | `<button type="button">` with `X` icon, rendered only when query non-empty | none | |
| Suggestion box | `<div>` (hashed class `suggestBox`) shown when focused and query non-empty | items are `<button type="button">` containing title `div` + subtitle `div` | items navigate on **`onMouseDown`** (not click) - CONFIRMED; automation should use `click()` which also fires mousedown, but be aware blur closes box after 150 ms |
| Suggestion states | text `searching_suggest` ("Searching suggestions..."), `no_suggest` ("No suitable suggestions") | | |
| Language switcher | button with `title` = `language_switcher` ("Language") | `title` attribute | `getByTitle('Language')` |
| Settings | `SettingsDropdown` button (icon) | none found besides classes | |
| Login button (guest) | `<button>` text `login` ("Login") | | `header`.getByRole('button',{name:'Login'}) |
| User avatar button (signed in) | `<button>` containing `<img alt="User avatar">` or an icon placeholder | `alt="User avatar"` (only when avatar URL exists and loads) | else icon only |
Header is hidden while `loading` (auth init) - neither Login nor avatar rendered until refresh finishes. CONFIRMED (`loading ? null : ...`).

### 2.3 User dropdown (`C:components/UserDropdown/UserDropdown.jsx`)
Opens on avatar click; closes on outside `mousedown`. Contains display name `<span>` (`user.displayName || 'User'`), `<a href="/favorites">` "Favorite Playlist" (`favorite_playlist_title`), `<button>` "Logout" (`logout`). Locators: `getByRole('link',{name:'Favorite Playlist'})`, `getByRole('button',{name:'Logout'})`. Href `/favorites` is stable.

### 2.4 Language switcher (`C:components/LanguageSwitcher/LanguageSwitcher.jsx`)
Button (title "Language") toggles a dropdown listing options `Tiếng Việt` (vi), `English` (en), `日本語` (jp), `Русский` (ru), `Deutsch` (ger); active has a check icon. Option labels are **fixed native names, not localized** -> language-independent locators: `getByText('English')` etc. (SOURCE-INFERRED; options are `<button>`/`<div>` - element type UNKNOWN without reading markup; class `dropdown-option`).

### 2.5 Settings dropdown (`C:components/SettingsDropdown/SettingsDropdown.jsx`)
Themes: ruby, amethyst, sapphire, emerald, topaz, aquamarine (each option shows a colour preview `div`); heading text `theme_color` ("Theme Color"). Selected theme persisted in `localStorage['selectedTheme']`. There is no visible theme name text in the option per source read (names are keys only) -> locate by order/position (fragile). UNKNOWN whether options have text.

### 2.6 Auth modal (`C:components/Modal/AuthModal.jsx`)
Overlay `div` (click closes) > content `div` (click stopped) with: close `X` button (no label), icon, `<h1>` `start_listening` ("Start Listening"), `<p>` `auth_modal_desc`, buttons `login_now` ("Login Now") and `maybe_later` ("Maybe Later"). Locators: `getByRole('heading',{name:'Start Listening'})`, `getByRole('button',{name:'Login Now'})`, `getByRole('button',{name:'Maybe Later'})`. Body scroll locked (`body.style.overflow`). Used from Sidebar (Favorites) and PlayerControl (favorite / rate). In PlayerControl it also pauses audio (`onStopMusic` pauses `audioRef`) - CONFIRMED.

### 2.7 Footer (`C:components/Footer/Footer.jsx`)
Logo, `footer_desc`, `connect_with_us`, three social `<a title="Facebook|Instagram|YouTube">` all pointing at the same external YouTube URL, `copyright`, `developed_by`. Low automation value.

### 2.8 Player bar (`C:components/PlayerControl/PlayerControl.jsx`)
Container class `player-controls-new` (hashed). Contents (all CONFIRMED in source; runtime DOM UNKNOWN):

| Element | DOM type | Stable attribute | Notes |
|---|---|---|---|
| Loading state | `div` text `loading_song_data` ("Loading song data...") | | shown until player data arrives |
| Cover/singer image | `<img alt={artist names}>` | `alt` = artists joined ", " | |
| Song title | `<span>` clickable -> `/song/:id`; truncated at 25 chars + "..." | text | not a link/button element |
| Artist text | `<span>` | | |
| Favorite (heart) | **`<div onClick>`** (not a button) with `data-tooltip` = "Add Favorite"/"Remove Favorite"; class `icon-button` (`disabled` class while in flight) | `data-tooltip` | not keyboard-accessible; locate `[data-tooltip="Add Favorite"]` (language-dependent) |
| Shuffle | `<button>` `data-tooltip` "Enable Shuffle"/"Disable Shuffle"; active class + green icon | `data-tooltip` | |
| Previous | `<button data-tooltip="Previous Song">` | | |
| Play/Pause | `<button class play-pause-btn>` with inline SVG; **no `data-tooltip`, no aria-label** | none | icon differs: pause = two rects, play = one polygon (`points="5 3 19 12 5 21 5 3"`) |
| Next | `<button data-tooltip="Next Song">` | | |
| Repeat | `<button data-tooltip>` = "Repeat Off" / "Repeat All" / "Repeat One" per state 0/1/2 | | |
| Rate | `<button data-tooltip="Rate Song" disabled={!currentSong}>` star SVG; `rated` class when reviewed | | |
| Download | `<button data-tooltip="Download Song" disabled={!audioUrl}>` | | |
| Mute | `<button data-tooltip="Mute"/"Unmute">` | | |
| Volume | `<input type="range" min=0 max=1 step=0.01>` | class `volume-range-input` | default value 0.7 |
| Seek | `<input type="range" min=0 max=duration step=0.1>` | class `seek-range-input` | current/total time in two `<span>` (`formatTime`) |
Recommended locator: `page.locator('[data-tooltip="Next Song"]')` (language pinned) - **SOURCE-INFERRED**; the tooltip may be applied via CSS `::after` using `attr(data-tooltip)` (not verified).

### 2.9 Rating modal (`C:components/Modal/RatingModal.jsx`)
**All text is hard-coded Vietnamese (not translated).**
- Overlay click and X button (`close-btn`, no label) close it.
- `<h3>` `Đánh Giá và Bình luận về "{songTitle}"`.
- If user has not rated: `<form>` with 5 lucide `Star` SVGs (`star-icon-input`, click sets rating, hover highlights), `<textarea placeholder="Viết bình luận của bạn (Không bắt buộc)...">`, submit `<button type="submit">` "Gửi đánh giá" / "Đang gửi..." disabled until >=1 star or while submitting.
- List heading `<h4>` "Bình luận từ cộng đồng"; loading text "Đang tải đánh giá..."; each review: `<strong>` username, star display (SVG, no text), `<p>` comment, `<span>` "Ngày: ...". User's own review has `user-review` class.
- Toasts: "Vui lòng chọn số sao để đánh giá!" (unreachable while submit disabled), "Không thể gửi đánh giá. Vui lòng thử lại.".
Locators: `getByPlaceholder(/Viết bình luận/)`, `getByRole('button',{name:'Gửi đánh giá'})`, `getByRole('heading',{name:/Đánh Giá và Bình luận/})`. **Stars have no role/label**: locate as the 5 SVGs with class containing `star-icon-input` (hashed). Empty-reviews text: UNKNOWN (rendered in lines not inspected).

---

## 3. Pages

### 3.1 Auth page - `/auth` (`C:pages/Auth/AuthPage.jsx`, `C:components/Auth/SignIn.jsx`, `SignUp.jsx`)
- Layout: `LanguageSwitcher` top; container with two form panels + overlay with two ghost buttons: left panel (`welcome_msg` "Welcome!", `welcome_desc`, button `login_btn` "Login") switches to sign-in; right panel (`welcome_back_msg` "Welcome Back!", `welcome_back_desc`, button `register_btn` "Register") switches to sign-up. State `signIn` default.
- **Sign-in form** (`<form>`): `<h1>` "Login" (`login_title`); `<input type="name" name="name" placeholder="Username">` (type "name" is invalid HTML -> behaves as text); password `<input name="password" placeholder="Password" type=password|text>`; eye toggle `<button type="button">` (no label; icon `Eye`/`EyeOff`); error `<small>` (inline style red); success `<small>` (green); submit `<button class submit-btn>` "Login" (`login_btn`). `LoadSpinner` overlay while loading.
- **Sign-up form** (`<form>`): `<h1>` "Create Account"; `<input type="text" name="name" placeholder="Username">`; `<input type="email" name="email" placeholder="Email">`; password input + eye toggle; error/success `<small>`; submit "Register" (`register_btn`).
- Toggling panels resets fields/messages (effect on `activeType`).
- **Locator caution:** placeholders "Username"/"Password" exist in both forms; scope by the visible form (`form:visible`) or by `<h1>` proximity. Sign-in submit and left-overlay "Login" share the same text -> disambiguate by container. SOURCE-INFERRED.
- Post-login: success text then `navigate('/')` after 1000 ms `setTimeout`.
- APIs: `POST /api/auth/login`, `POST /api/auth/register`, external email validation.
- State: `AuthContext` (user, accessToken, loading).

### 3.2 Home - `/` (`HomePage.jsx`)
- Sections: **Discover by Genre** (`discover_by_genre`; up to 8 `GenreCard`, "See all" -> `/genres`), **Trending Artists** (`trending_artists`; up to 10 `ItemCardColumn type="artist"`; "See all" -> `/charts`), **Recommends for you** (`rcm_for_you`; empty container). Commented-out song sections.
- `GenreCard`: `<div><a href="/category/{id}"><img alt={genre title}><h3>title</h3></a></div>` -> `a[href^="/category/"]`, `getByAltText(title)` (CONFIRMED structure; alt = translated genre name).
- Artist card: `<a href="/artist/{id}"><img alt={name}></a>` + `<a href="/artist/{id}">name</a>`; no play button for artists.
- States: `LoadSpinner`, `EmptyState` (`<img alt="No data">` + message `empty_content` "Sorry :( No content available at the moment"), error message `error_fetching_data` is set but the render path shows EmptyState/spinner (error text display UNKNOWN).
- APIs: `GET /api/category/popular?page=1&size=50`, `GET /api/artist/popular`. State: `DataCacheContext` (cached home data).
- `window.scrollTo(0,0)` runs during render.

### 3.3 Genres - `/genres` (`ExploreCategoriesPage.jsx`)
Fetches categories (page 1, size 100), keeps up to 42, first 6 featured -> per-category songs (page 1, size 10); each section title `explore_genre_title` ("Discover {name} Genre") with "See all" (`see_all`) and up to 10 song cards (`ItemCardColumn`-style, INFERRED). Empty/error -> `EmptyState`. APIs: `/category/popular`, `/song/category/popular/{id}`.

### 3.4 Charts - `/charts` (`TopChartsPage.jsx`)
Popular categories (page 1 size 10), popular artists (page 1 size 10), per-category top songs (page 1 size 10). Categories with id 10 and 26 are sorted first; first two categories rendered in a dual-column layout (`popularCategories.slice(0,2)`, `isDualColumn`), rest single. Each section: `<h2>` `top_chart_title` ("Top {name}"), link `/category/{id}` "See all", `TrackTable` (header `#`, `Song`, `Artist`, clock icon; rows with rank). `no_data` when a category has no songs. **`ItemTopCharts` (with "Like" `aria-label`) is not imported anywhere** and `handleToggleFavorite` is defined but not passed to `TrackTable`, and `SongRow` renders no favorite control -> **no favorite control on this page** (CONFIRMED by grep). Whether a "Trending artists" block is rendered is partly UNKNOWN (lines 176+ not fully read; `popularArtists` state exists).

### 3.5 Song detail - `/song/:songId` (`SongViewPage.jsx`)
- Header: `<img alt="">` cover, subtitle `song` ("Song"), `<h1>` title, artist names as clickable `<span>`s (navigate `/artist/{id}`), heart + count and star + count as static `div.icon-button` (**no onClick**), buttons `btn-play` (text `play`/`pause`) and `btn-download` (`download`/`downloading`, disabled while downloading).
- Lyrics card: header `lyrics`; `<hr>`; scroller with `<p>` per LRC line (`lyric-line`, current has `active-lyric`); or `<p>` `no_lyrics_yet`; toggle button `show_more`/`show_less` (only if lyrics). Lyrics parsed with regex `\[(\d+):(\d+\.\d+)\](.*)`.
- Artists list: `<h2>` `artists`, rows (`artist-row`, clickable div) with `<img>` avatar and name.
- "Other songs by ..." (`other_songs_by`): `TrackTable` of related songs (max 30 from API); `view_more`/`show_less` button when > 4.
- "Recommends for you" empty container. Renders `<PlayerControl/>` itself when `currentSong`.
- Not found: `<p>` `song_not_found` ("Song not found"). Loading: `LoadSpinner`.
- APIs: `GET /api/song/{id}/detail`, `/api/song/{id}/related`, `/api/artist/{id}/artists` (id = song id), LRC fetched with `fetch()` directly from `lyricUrl`.

### 3.6 Artist - `/artist/:id` (`ArtistPage.jsx`)
Hero (`<img alt={artist.name}>`, `<h1>` name, Play/Pause button with `play`/`pause` text). Sections via `SectionHeader` (`<h2>`): "Main Songs" (`artist_main_songs`), "Collaboration Songs" (`artist_collab_songs`), "Related Artists" (`related_artists`). Song lists use `TrackTable` + `Pagination`; PAGE_SIZE 10. Related artists shown 4 per page from the client-side array using `SquareCard` (a `<button>` with `<img alt="">`, title div). Error `<p>` in red (`error_loading_*`). Hero colour is derived from the avatar via canvas colour-thief (CORS-dependent) and set as CSS variables on `<html>`.
APIs: `/artist/{id}`, `/song/artist/main/{id}`, `/song/artist/collab/{id}`, `/artist/related/{id}`.

### 3.7 Genre - `/category/:id` (`CategoryPage.jsx`)
Category header (name/image), "Featured Artists" section (`SquareCard`s + `Pagination`, size 10), "Songs" section (`ItemCardColumn type="song"` grid + `Pagination`, size 12; card play button starts playback), empty "Recommends for you" container. APIs: `/category/{id}`, `/artist/category/{id}`, `song/category/popular/{id}` (note: request path has **no leading slash**; axios joins with baseURL - works per axios semantics, INFERRED).

### 3.8 Search - `/search` (`SearchResultPage.jsx`)
- `<h1>` `search_result_page_header` ("Search results"); `SearchTabs`: `<div role="tablist" aria-label="Search categories">` with `<button role="tab" aria-selected>` labelled All / Songs / Artists (`all`, `songs`, `artists`).
- URL state: `q`, `t` (`all|songs|artists`), `page`. PAGE_SIZE 12.
- Blocks: `Top result` (`top_result_label`) using `ItemCardRow` (song) or `SquareCard` (artist); Songs (`tab_songs`) as `ItemCardRow` two-column (All tab, first 10) or `TrackTable`+`Pagination` (Songs tab); Artists (`tab_artists`) `SquareCard` (first 4 on All, all on Artists tab).
- No results: `<p>` `not_found_msg` + `"{keyword}"`. Error `<p>` red.
- `ItemCardRow`: `<a href="/song/{id}">title</a>`, artist `<a href="/artist/{id}">`, play `<button aria-label="Play">` shown on hover (inside `.play-overlay.show`), equalizer replaces button while that song plays. **Hover-only button** -> locator `getByRole('button',{name:'Play'})` needs hover first or `force`.
- API: `GET /api/song/search?keyword&page&size`.

### 3.9 Favorites - `/favorites` (`FavoriteSongsPage.jsx`)
Guest -> redirect `/auth`. Empty -> `NoFavoriteState` (`<img alt="No data">` + `no_favorite_msg`). Otherwise: `<h1>` `favorite_playlist_title` ("Favorite Playlist"), `featured_artist_label` line with most frequent artists, buttons `play_all`/`pause` and `download_playlist`/`downloading_playlist`, hint `drag_drop_hint`, table headers (`song_title`, `artist_col`, clock), draggable rows (`@hello-pangea/dnd` `Droppable/Draggable`), toggle `toggle_add`/`toggle_sub` ("Show More"/"Show Less"), cover `<img alt={title}>`. Rows use `SongRow`. Drag & drop needs mouse/keyboard simulation - library supports keyboard dragging (space, arrows) per library docs (not verified here).
API: `GET /api/song/favorites` (cached client-side).

---

## 4. Reusable components (locator relevance)

| Component | File | Structure (CONFIRMED) | Notes |
|---|---|---|---|
| `Pagination` | `components/Pagination/Pagination.jsx` | `div` > `button` "Previous" (`previous_page`), numbered `button`s, `…` spans, `button` "Next" (`next_page`); returns `null` when `totalPages < 1`; first/last disabled | numbers window logic: <=7 pages show all; near start `1 2 3 4 5 … N`; near end; middle `1 … p-1 p p+1 … N`. Active page has active class only |
| `TrackTable` / `SongRow` | `TrackTable.jsx`, `SongRow.jsx` | header div with `#`, `Song`, `Artist`, clock icon; rows: index/rank div, cover `<img alt="">`, title `<button>` (navigates), artists as clickable `<span>`s (max 3 + "…"), duration `<span>`; whole row click plays; hover shows play/pause `<button>` overlay | row play works by clicking the row (`onClick` on the row div) - only when `activeTab="Bài hát"` which TrackTable always passes |
| `ItemCardColumn` | | image `<img alt={title}>`, `<a>` title, artist links; play `<button aria-label="Play">` on non-artist cards; equalizer replaces it while playing | image error -> data-URI placeholder |
| `ItemCardRow` | | see Search | |
| `SquareCard` | | `<button><img alt=""><div>title</div><div>subtitle</div></button>` | title from name; `alt` empty -> use `getByRole('button',{name:<artist name>})` |
| `EmptyState`, `NoFavoriteState` | | `<img alt="No data">` + `<p>` | |
| `LoadSpinner` | | full-screen spinner (react-spinners) | wait for detach |
| `SectionHeader` | | `<h2>` (+ optional see-all `<button>`) | |

---

## 5. Elements relevant to future automation (summary inventory)

| Element | Page | Type | Best candidate | Stability |
|---|---|---|---|---|
| Sign-in username/password | /auth | input | `getByPlaceholder('Username'/'Password')` scoped to sign-in form | language-dependent; duplicated placeholders |
| Sign-in submit | /auth | button | `getByRole('button',{name:'Login'})` scoped to form | language-dependent |
| Sign-up name/email/password | /auth | input | `input[name="email"]` unique to sign-up; `name`/`password` names shared | name attrs stable, dup across forms |
| Auth error/success text | /auth | `<small>` | text or `form small` | inline styles only |
| Header search input | all layout pages | input | `getByPlaceholder('Search songs, artists, ...')` | language-dependent |
| Suggestion items | header | button | `header button` with text | class hashed |
| Sidebar nav links | layout | a | `aside a[href="/genres"]` | href stable |
| Login button | header | button | `getByRole('button',{name:'Login'})` | language-dependent |
| User menu / logout | header | button | avatar button then `getByRole('button',{name:'Logout'})` | avatar has no name unless `alt` present |
| Sign-in modal buttons | layout | button | role+name | language-dependent |
| Genre cards | home | a | `a[href^="/category/"]` | stable href |
| Artist links | many | a | `a[href^="/artist/"]` | stable href |
| Song links | many | a | `a[href^="/song/"]` | stable href (cards, rows: some navigation is via button/`navigate`, no href) |
| Play button on cards | home/genre/search | button | `getByRole('button',{name:'Play'})` (hover) | aria-label English constant, not localized (CONFIRMED literal "Play") |
| Player bar controls | layout | button/div | `[data-tooltip="..."]` | localized value |
| Seek/volume | player | input range | `input[type=range]` (two; volume first) | order-dependent |
| Tabs | search | button | `getByRole('tab',{name})` | good |
| Pagination | artist/genre/search | button | `getByRole('button',{name:'Next'})` and page number | language-dependent |
| Rating stars/textarea/submit | modal | svg/textarea/button | placeholder, button name; stars by class | stars fragile |
| Favorite row drag handles | favorites | draggable row | `data-rfd-draggable-id` attribute added by `@hello-pangea/dnd` (library behavior, NOT in source) | UNKNOWN - validate |
