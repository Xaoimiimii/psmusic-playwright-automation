# PSMusic - Discovery, Charts and Favorites (Browser Runtime Exploration)

Observed on 2026-10-13 against the local dev build (UI `https://localhost:5173`, API `https://localhost:7215`),
Chromium headless, English UI, recommendation tracker blocked, while implementing `tests/discovery/`,
`tests/favorites/` and the Discovery rows of `tests/shared/not-found.spec.ts`. Sources read: `HomePage.jsx`,
`TopChartsPage.jsx`, `SongRow.jsx`, `CategoryPage.jsx`, `ArtistPage.jsx`, `PlayerControl.jsx`,
`SongController.ToggleFavorite`, `AuthService` (refresh tokens). Labels: RUNTIME-OBSERVED, SOURCE.

## 1. Home `/`

| # | Observation | Evidence |
|---|---|---|
| D-1 | Sections, in order: "Discover by Genre", "Trending Artists", "Recommends for you". Genre tiles: 2 (`/category/10` "Vietnamese Music" first); trending artists: 1 card (`/artist/1` "Hoàng Dũng"). Limits in source: 8 genres, 10 artists. Both lists come from plays in the last 7 days | RUNTIME-OBSERVED + SOURCE |
| D-2 | An artist card holds two links to `/artist/{id}`: the image (no text) and the name. Use the name link | RUNTIME-OBSERVED |
| D-3 | See all of "Discover by Genre" → `/genres`; See all of "Trending Artists" → `/charts` | RUNTIME-OBSERVED |
| D-4 | `/genres` section headings read `Discover <genre> Genre` (`explore_genre_title`) | SOURCE (locale) + RUNTIME-OBSERVED |

## 2. Charts `/charts`

| # | Observation | Evidence |
|---|---|---|
| D-5 | 2 charts today: "Top Vietnamese Music" (`/category/10`) and "Top Vietnamese Youth Music" (`/category/2`), side by side, each ranked 1 to 10. Genres 10 and 26 are moved to the front (source); 26 is not popular this week | RUNTIME-OBSERVED + SOURCE |
| D-6 | Row: rank cell `[class*="rankColumn"]`, title `button[class*="sr-title-songtab"]` (no `href`), artist names `span[class*="artistName"]` ("Hoàng Dũng, " then "Hoàng Rob"). The artist span has a click handler that opens `/artist/{id}` | RUNTIME-OBSERVED + SOURCE (`SongRow.jsx`) |
| D-7 | No heart icon and no trending-artists block on the page. The page fetches popular artists and has a favorite handler, but renders neither (SD-2 holds) | RUNTIME-OBSERVED + SOURCE |

## 3. Unknown category and artist (known defects)

| # | Observation | Evidence |
|---|---|---|
| D-8 | `GET /api/category/99999999` → **204**, empty body; `/category/99999999` main area shows only the "Recommends for you" heading | RUNTIME-OBSERVED |
| D-9 | `GET /api/artist/99999999` → **204**; `/artist/99999999` shows only a Play button | RUNTIME-OBSERVED |

## 4. Favorites

| # | Observation | Evidence |
|---|---|---|
| FV-1 | `POST /api/song/{id}/favorite-toggle` answers `{ "message": "Đã thêm vào yêu thích", "isFavorited": true }` and `{ "message": "Đã bỏ yêu thích", "isFavorited": false }`. The player shows neither message, and the player bar renders no like count (only state). The like count is visible on the song page only, and it stays at its page-load value (F-6, known defect US-015-AC-01, reconfirmed) | RUNTIME-OBSERVED + SOURCE |
| FV-2 | `/player` `likes` moved +1 / back on each toggle for a song nobody else touched (songs 1129, 1349), and `isFavorited` (with a token) followed the toggle | RUNTIME-OBSERVED (TS-FAV-01, TS-FAV-04) |
| FV-3 | The favorites playlist is cached in page memory; a toggle from the player bar clears it, so an in-app visit right after shows the change | RUNTIME-OBSERVED (TS-FAV-03) |
| FV-4 | Logging in again through the API does not end the browser's session: refresh tokens are stateless JWTs and no token is revoked on login (`AuthService.Login`, `Refresh`) | SOURCE |

Songs probed for the favorites tests (`/player`, 2026-10-13): 1129 "Halo" (Beyoncé), 2179 "Đổi Thay" (Noo Phước Thịnh),
1349 "Good Luck, Babe!" (Chappell Roan): MP3 and lyrics present, 0 likes.
