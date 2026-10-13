# PSMusic - Player, Queue and Rating Modal (Browser Runtime Exploration)

Observed on 2026-10-12 against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`),
Chromium headless, English UI, recommendation tracker blocked, before and while implementing `tests/player/`,
`tests/review/` and `tests/journeys/`. Sources read: `PlayerContext.jsx`, `PlayerControl.jsx`,
`PlayerControlService.js`, `RatingModal.jsx`, `FavoriteSongsPage.jsx`, `ItemCardColumn.jsx`, `SongController.cs`
(`GetNextBatch`, `AddStream`), `SongRepository.GetRandomSongsAsync`, `RatingController.cs`.
Labels: RUNTIME-OBSERVED, SOURCE (read in the client or server code).

## 1. Player bar locators (all scoped to `[class*="playerWrapper"] [class*="player-controls-new"]`)

Implemented in `src/pages/components/player-bar.ts`. Complements `pages-and-locators.md` §10.

| Element | Locator | Notes |
|---|---|---|
| Title | `[class*="player-info-left"] span[class*="song-title"]` | A plain `[class*="song-title"]` also matches the wrapper `div[class*="song-title-artist"]` (strict-mode violation seen). Long titles end with `...` after 25 characters (`Ex'S Hate Me, Pt. 2 (Mase...`) |
| Artist | `span[class*="song-artist"]` | `/player` `artist` (names joined with ", ") once the response arrives |
| Cover | `img[class*="singer-avatar"]` | `src` = `/player` `singerUrl` (falls back to `coverUrl`) |
| Play / Pause | `button[class*="play-pause-btn"]` | Icon: two `rect` while playing, one `polygon` while paused |
| Previous / Next | `button[data-tooltip="Previous Song"]` / `button[data-tooltip="Next Song"]` | Tooltip texts from the locale (`prev_song`, `next_song`) |
| Shuffle | `button[class*="shuffle-btn"]` | `data-tooltip` names the action: `Enable Shuffle` when off, `Disable Shuffle` when on; `_active_` class when on |
| Repeat | `button[class*="repeat-btn"]` | `data-tooltip` names the state: `Repeat Off`, `Repeat All`, `Repeat One`; `_active_` class for All and One |
| Heart | `[class*="icon-button"]:has(svg.lucide-heart)` | `div`; `data-tooltip` `Add Favorite` / `Remove Favorite`; icon `fill` white / transparent |
| Rate | `button[class*="rating-btn"]` | Extra `_rated_` class when `/player` says `isReviewed: true` |

Tooltips seen on the player bar copy (order): `Add Favorite`, `Enable Shuffle`, `Previous Song`, `Next Song`,
`Repeat Off`, `Rate Song`, `Download Song`, `Mute`. RUNTIME-OBSERVED.

## 2. Queue and song changes

| # | Observation | Evidence |
|---|---|---|
| P-1 | Pressing Play on `/song/1` sends `GET /api/song/1/player` and `GET /api/song/next-batch` (10 random songs with a lyric URL). The queue is `[song 1, ...batch]` in response order. Next plays `batch[0]`, Previous goes back to song 1. Each song change sends exactly one `GET /api/song/{id}/player`, the only caller of that endpoint, so it is the song-change signal | RUNTIME-OBSERVED + SOURCE |
| P-2 | **Refill point:** Next requests another batch when `queue.length - nextIndex <= 3`, i.e. when the started song and the songs after it are 3 or fewer. From a fresh start on song 1 this is the **8th** Next. The batch is appended in response order (shuffle off) and played after the first batch | RUNTIME-OBSERVED (sequence `BATCH, 1, 737, …, 3492, BATCH, 1864`) + SOURCE |
| P-3 | **End of song:** moving `audio.currentTime` to `duration - 1` lets the song end within about a second. With Repeat Off the next queue song starts (`/player` of `batch[0]`). With Repeat One the same MP3 restarts near 0 s and no `/player` request is sent. Repeat All restarts at `queue[0]` only when the queue has really ended, which a live queue never does because of P-2 | RUNTIME-OBSERVED + SOURCE |
| P-4 | **Shuffle on** keeps the playing song (no request) and puts it first, followed by the other queue songs in random order. **Shuffle off** restores the original queue and positions the player on the current song in it: Previous then plays the song before it in the original order | RUNTIME-OBSERVED (4 Nexts gave `3710, 372, 432, 2504`; after Shuffle off, Next gave `1207`, the successor of `2504` in the batch) + SOURCE |
| P-5 | Control copies while a song plays: 3 on `/song/:id`, 2 on `/` after in-app navigation from the sidebar. One click on Next moved one song; one click on the heart sent one `favorite-toggle` (member) | RUNTIME-OBSERVED (TS-PLAY-08) |
| P-8 | **Play All on Favorites** (`handlePlayAll`) only toggles play/pause when the playing song is in the playlist; it starts the playlist from its first song only otherwise. The same applies to a row's play when that row is the playing song | SOURCE (`FavoriteSongsPage.jsx`), confirmed in TS-E2E-02 |
| P-9 | Members: `POST /api/song/stream/{id}` is sent once the position passes 20 s (`PlayerContext`). Moving to the end of a song (P-3) as a member would therefore record a stream; the tests answer this request in the browser | SOURCE |

Audio buffering: the first `/song/1` play showed `currentTime 0`, `duration NaN` after 3 s in one run; the tests keep
the 20 s start budget of `AUDIO_START_TIMEOUT_MS` (R-AUD).

## 3. Rating modal

| # | Observation | Evidence |
|---|---|---|
| P-6 | **Success text not shown.** US-017-AC-02 names `Đánh giá thành công!`. The API returns it (`200 {"message":"Đánh giá thành công!"}`), but the modal does not display it: the success-message code is commented out, and no toast is raised on success. After a submit the user sees the new review at the top of the list and the form disappears. EXPECTATION UNCLEAR: whether AC-02 means a visible message | SOURCE (`RatingModal.jsx`) + RUNTIME-OBSERVED with a controlled submit |
| P-7 | **Review count not visible.** On submit the player adds 1 to `playerData.reviews`, but the player bar does not render a review count, and the song page counter comes from `/detail` and is not updated. "Review count +1" (AC-02) is therefore not observable in the UI until a reload | SOURCE (`PlayerControl.jsx` `handleReviewSubmitted`, `SongViewPage.jsx`) |
| P-10 | Form stars: the 5 `svg` inside `[class*="star-rating"]` (the review list uses `[class*="star-rating-display"]`). Selected stars have `fill="#FFD700"`, others `transparent`; hovering shows the hovered value. Clicking star n then hovering it shows n filled. Submit `Gửi đánh giá` is disabled until a star is chosen | RUNTIME-OBSERVED (TS-REV-01) |
| P-11 | Submit body: `{ "rating": <n>, "comment": "<text>", "user": "<username>" }` | RUNTIME-OBSERVED (TS-REV-02, request captured before the controlled answer) |
| P-12 | With `isReviewed: true` in `/player`, the rate button has the `_rated_` class and the modal renders only the heading and the review list (no stars, comment or submit) | RUNTIME-OBSERVED (TS-REV-04, controlled `/player`) |

## 4. Home and genre pages (TS-E2E-01)

- Home "Discover by Genre" showed **2** tiles (`/category/10` "Vietnamese Music" first). The section lists only
  genres with plays in the last 7 days (at most 8), so its content depends on recent listening. RUNTIME-OBSERVED.
- `/category/10`: h1 "Vietnamese Music", 12 song links `main a[href^="/song/"]` on page 1, the first `/song/1`
  "Chờ Anh Nhé". RUNTIME-OBSERVED.
- Song cards (`ItemCardColumn`) have a play overlay `button[aria-label="Play"]`; the title is a link to `/song/:id`.
  SOURCE.
