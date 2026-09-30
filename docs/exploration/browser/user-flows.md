# PSMusic - User Flows (Browser Runtime Exploration)

Flows actually executed in the browser on 2026-09-30. Each step lists the visible result and the API traffic observed. Labels: see `application-overview.md`.

---

## UF-01 First visit (guest) - RUNTIME-OBSERVED
1. Open `https://localhost:5174/` -> Home renders with the sidebar, header (Login button), "Discover by Genre" (4 tiles), "Trending Artists" (9 artists), an empty "Recommends for you", and the footer.
2. The third-party privacy banner "We respect your privacy" appears bottom-page with **Decline / Accept all**.
3. Network: `category/popular?page=1&size=50` x2, `artist/popular` x2, `auth/refresh` x2 (200, `isSuccess:false`), recsys config calls.
4. Decline -> banner disappears, `localStorage.recsys_consent_status` set. Recsys tracking calls continued afterwards (RUNTIME-OBSERVED: `POST /recommendation` still fired).

## UF-02 Browse genres -> charts -> song - RUNTIME-OBSERVED
1. Sidebar **Genres & Topics** -> `/genres`: 4 genre tiles + 4 sections "Discover <Genre> Genre" x 10 song cards (cover, Play, title link `/song/:id`, artist links `/artist/:id`). API: `song/category/popular/{10,2,1,26}?page=1&size=10` (x2 each). `category/popular` was **not** refetched (RUNTIME-INFERRED client cache).
2. Sidebar **Charts** -> `/charts`: 4 ranked "Top …" lists (Vietnamese + Western side by side without durations; Youth and Pop full-width with durations). API: `artist/popular?page=1&size=10` + the 4 category calls. The content swaps in ~1-2 s after the URL changes, so the previous page's DOM is briefly still shown.
3. Click a chart song title (button) -> navigates to `/song/1`. API: `song/1/detail` x2, `song/1/related`, `artist/1/artists`, S3 `.lrc`.

## UF-03 Song detail and guest playback - RUNTIME-OBSERVED
1. `/song/1` shows h1 title, artists, counters (favorites 9, reviews 11 at the time), Play, Download, Lyrics with "Show More", Artists list, "Other songs by …" (30 rows + "View More"), "Recommends for you".
2. A third-party popup **"Recommendations just for you"** (fixed bottom-right, ~500 px) appears after a moment and overlaps the page (`evidence/psmusic-recsys-popup.png`).
3. Click **Play** -> player bar appears; API `song/next-batch`, `song/1/player`; `audio` loads from S3 and plays (`currentTime` 0 -> 10.6 s in ~7 s; the first ~4 s were buffering).
4. Full page reload -> the player disappears (playback state not persisted).

## UF-04 Guest hits member-only actions - RUNTIME-OBSERVED
| Action | Result |
|---|---|
| Sidebar **Favorites** | No navigation; modal "Start Listening - Login with your account to explore full features like favorites and song ratings." with **Login Now / Maybe Later** |
| **Maybe Later** | Modal closes (was blocked until the recsys popup was closed) |
| Direct URL `/favorites` | Redirect to `/auth` |
| Direct URL `/recent` | Redirect to `/auth` |
| Player heart / rate as guest | NOT TESTED directly (player was not re-opened as guest after the modal check) |

## UF-05 Category and artist pages - RUNTIME-OBSERVED
1. `/category/1` (Pop): h1 "Pop", Featured Artists (10 per page, pager 1..13), Songs (12 per page, pager 1..65), Recommends for you. Clicking **Next** in Songs -> `GET song/category/popular/1?id=1&page=2&size=12`; the grid changes; the **URL stays `/category/1`**.
2. `/artist/1`: h1 "Hoàng Dũng", Play, Main Songs (10 rows, pager 1..2), Collaboration Songs, Related Artists. API: `artist/1`, `song/artist/main/1`, `song/artist/collab/1`, `artist/related/1`.
3. Unknown ids: `/song/99999999` -> "Song not found" (API 404). `/artist/99999999` -> page shows only "Play" (API 204). `/category/99999999` -> only "Recommends for you" (API 204). No error message in the latter two.

## UF-06 Search - RUNTIME-OBSERVED (non-functional in this environment)
1. Type `hoang dung` slowly into the header search -> `GET song/search?keyword=hoang+dung&page=1&size=5` (200). No suggestion dropdown content rendered.
2. Press **Enter** -> `/search?q=hoang%20dung`, tabs **All / Songs / Artists**, `GET song/search?...&size=12` x2 -> `{"topResult":null,"results":[],"total":0,"totalPages":0}` -> text `No results found for "hoang dung".`
3. The same empty result for `Hoàng Dũng`, `Starboy` (exists in Charts), `starbo`, `zzqqxxnotexist`.

## UF-07 Language and theme - RUNTIME-OBSERVED
1. Theme button -> "Theme Color" menu -> **Sapphire** -> CSS variables on `<html>` change; `localStorage.selectedTheme = "sapphire"`.
2. **Language** -> **Tiếng Việt** -> `<html lang="vi">`, `localStorage.i18nextLng = "vi"`, nav becomes "Khám Phá / Chủ Đề & Thể Loại / Bảng Xếp Hạng / Bài Hát Yêu Thích", headings translated, category names translated/raw. Switching back to English restores the labels.

## UF-08 Login page validation - RUNTIME-OBSERVED
Starting state: `/auth`, Login panel visible.
| Input | Result | API |
|---|---|---|
| both empty | `<small>` "Please fill in all information" | none |
| username + `short` (5 chars) | "Password must be at least 8 characters" | none |
| username + empty password | no login request sent; message text not captured (probe read the wrong element type) | none |
| unknown user `qa_nonexistent_user_zz` + 8+ char password | "Tài khoản không tồn tại" (Vietnamese in English UI) | `POST auth/login` -> 400 |
| Eye button | password `type` toggles `password` -> `text` | none |

## UF-09 Registration via UI - RUNTIME-OBSERVED (blocked for synthetic data)
1. Overlay **Register** -> Create Account form (Username, Email, Password).
2. All empty -> "Please fill in all information"; no API call.
3. Email `x` -> the browser's native `type=email` validation blocks submission (validationMessage "Please include an '@'…"); no app message, no API call.
4. Valid fields + password `short` -> "Password must be at least 8 characters"; no API call.
5. Valid fields + `…@example.com` -> Abstract API returns `undeliverable / dns_record_not_found` -> message "Email không tồn tại hoặc không thể gửi được"; **no register call**; the fields keep their values.
6. Valid fields + synthetic `…@gmail.com` -> Abstract API `undeliverable / invalid_mailbox`, `organization_name: Gmail` -> the same message; no register call.
7. Result: UI registration was **not completed**. The test users were created by calling `POST /api/auth/register` from the page context (see `test-data.md`).

## UF-10 Login, session, user menu - RUNTIME-OBSERVED
1. Login with test user -> `<small>` "Login successful" -> redirect to `/` about 1.3 s after the click. API: `auth/login` 200, then `stats/heartbeat` 200 plus Home calls.
2. Header now shows an avatar button (no Login). Avatar -> menu with display name, **Favorite Playlist** (`/favorites`), **Logout**.
3. Full reload -> `auth/refresh` x2, both 200 with a token -> still logged in.

## UF-11 Favorite / unfavorite - RUNTIME-OBSERVED
1. `/song/1` -> Play -> player heart (hollow, `fill=transparent`) -> click -> `POST song/1/favorite-toggle` -> `{"message":"Đã thêm vào yêu thích","isFavorited":true}`; heart `fill=white`. **No toast.** The song page counter stays 9 until reload (then 10).
2. Avatar -> Favorite Playlist -> `/favorites` lists the song (Favorite Playlist header, "Featured Artist: Hoàng Dũng & Hoàng Rob", Play All, Download Playlist, "Drag and drop to reorder").
3. **Play All** -> `song/1/player`, playback starts.
4. Heart again -> `{"message":"Đã bỏ yêu thích","isFavorited":false}` -> `GET song/favorites` -> `[]` -> page switches to the empty state immediately.

## UF-12 Stream counting - RUNTIME-OBSERVED
Logged in, playing song 1 from ~11.9 s -> at `currentTime ≈ 20.2 s` exactly one `POST /api/song/stream/1` (200) was sent; none further up to 35.9 s.

## UF-13 Rate and review - RUNTIME-OBSERVED
1. Player **Rate** (star) -> rating modal (Vietnamese). Header "Đánh Giá và Bình luận về "Chờ Anh Nhé"", 5 stars, optional comment, **Gửi đánh giá** disabled; community list below (`GET rating/1/reviews`).
2. Choose a star -> submit enabled. Enter comment -> submit -> `POST rating/1/add-review` `{"rating":3,"comment":"QA browser exploration - automated test account","user":"psmusicqa_browser01"}` -> 200 `"Đánh giá thành công!"`.
3. The modal stays open; the new review is prepended with **date "30/9/2026"** (client format). No toast.
4. After reload: counters 10 / 12. The rate button has an extra `_rated` class. Reopening the modal shows **no stars/comment/submit form**, only the list, where the review now shows "2026-09-30" (server format).
5. A second review via the UI is not possible. Via the API: NOT TESTED.

## UF-14 Player navigation - RUNTIME-OBSERVED
From song 1: **Next** -> "Toosie Slide" (`GET song/1444/player`, a song from the `next-batch` queue). **Previous** -> back to "Chờ Anh Nhé" (`GET song/1/player`). Play/Pause toggles `audio.paused`. Shuffle, repeat, volume, seek, and download: NOT TESTED.

## UF-15 Logout - RUNTIME-OBSERVED
From `/favorites`: avatar -> **Logout** -> `POST auth/logout` 200 -> URL `/auth`, player removed, `RefreshToken` cookie gone, header shows Login. Reload -> `auth/refresh` (no token) -> stays logged out. `localStorage.recsys_cached_user_info` **remains** after logout.
(RUNTIME-INFERRED: landing on `/auth` may come from the `/favorites` route guard firing after logout rather than from logout itself. Logout from a public page NOT TESTED.)

## Flows NOT TESTED
Accept-all consent; Download (song / playlist); drag-and-drop reorder; shuffle/repeat/volume/seek; artist page Play; "View More"/"Show More"; header back/forward arrows; guest playback past 20 s; wrong password for an existing user; token expiry (60 min); mobile viewport; languages other than EN/VI.
