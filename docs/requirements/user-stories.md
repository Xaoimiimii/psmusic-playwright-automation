# User Stories

PSMusic has no formal requirements. These stories started as repository-derived hypotheses and were then checked against the running app, the README and stakeholder answers (2026-10-01). What is written below is the **current agreed expectation**.

- **DEFECT** = the app currently fails this criterion (observed at runtime unless marked "source only").
- **BLOCKED** = cannot be verified because of the environment.
- Server messages are Vietnamese literals regardless of UI language. The rating modal is Vietnamese only.
- Evidence and history are in `docs/exploration/`. The reconciliation result is in `docs/exploration/exploration-validation.md`.

## Roles

| Role | Notes |
|---|---|
| Guest | Can browse, search, play, change language/theme. Cannot use `/favorites`, `/recent`, favorite, rate, or stream counting |
| Registered user | Everything a guest can, plus favorites, ratings, profile |
| Admin / staff | Does not exist. No roles, no content-management API |

## Stakeholder decisions (2026-10-01)

| # | Decision |
|---|---|
| 1 | Search: the repository behavior is the expected behavior. The empty results seen until 2026-10-08 were caused by an outdated Elasticsearch API key (environment issue). **Update 2026-10-08:** the key has been renewed and search is no longer deferred |
| 2 | Charts do not show popular artists; there is no favorite on charts |
| 3 | Logout lands on `/` from every page |
| 4 | Unknown category, unknown artist and unknown route show a visible not-found state; the category and artist APIs return 404 |
| 5 | `/recent` requires login |
| 6 | Genre section titles only need the correct genre name; wording does not matter |
| 7 | The server must enforce one review per user per song and rating 1 to 5 |
| 8 | A "view my profile" story is required (US-023); reading another user's profile is not allowed |
| 9 | Before the user clicks Accept or Decline on the privacy banner, nothing may be sent to the recommendation service |
| 10 | Intended as is: Gmail-only sign-up UI, favorites order not persisted, distinct login error messages, guest download, no responsive-layout requirement, same recommendation list on every song page |

---

## US-001 Register an account

**Status:** UI success path BLOCKED in tests (external email check needs a real Gmail mailbox; the API accepts any valid email).

> As a guest, I want to create an account with a username, email and password, so that I can sign in and use favorites and ratings.

- AC-01: Submitting with a name, email or password empty shows "Please fill in all information" and sends no request.
- AC-02: A password shorter than 8 characters shows "Password must be at least 8 characters" and sends no request.
- AC-03: Valid, unused username/email, password of 8+ characters, email accepted by the external check: the account is created, a success message is shown, the form is cleared.
- AC-04: An existing email returns 400 `Email đã tồn tại`; the UI shows it.
- AC-05: An existing username returns 400 `Tài khoản đã tồn tại`; the UI shows it.
- AC-06: The password is stored hashed (BCrypt) and never returned in any response.
- AC-07: Registration does not sign the user in (the API returns no token). What the UI does after success (switch panel, redirect) is open.

Rules: username and email are unique. Password at least 8 characters. Display name equals the username and is limited to 30 characters (a longer username is likely rejected). The UI accepts only Gmail addresses after an external deliverability check; the API does not enforce this (intended).

## US-002 Log in

**Status:** Confirmed. AC-05 not yet run.

> As a registered user, I want to sign in with my username and password, so that I can use favorites and ratings.

- AC-01: Empty username or password shows "Please fill in all information" and sends no request.
- AC-02: A password shorter than 8 characters shows the length message and sends no request.
- AC-03: Valid credentials: the API returns a token and the user (id, username, email, displayName), sets the `RefreshToken` cookie, the UI shows "Login successful" and goes to `/` after about 1 second.
- AC-04: Unknown username returns 400 `Tài khoản không tồn tại`; the UI shows it.
- AC-05: Wrong password for an existing user returns 400 `Sai mật khẩu`; the UI shows it. (Source only.)
- AC-06: The eye icon toggles password visibility.
- AC-07: Switching between the Sign In and Sign Up panels clears fields, errors and messages.

Rules: access token lasts 60 minutes (kept in memory only). Refresh token is an HttpOnly, Secure, SameSite=None cookie valid about 7 days. Distinct messages for unknown user and wrong password are intended.

## US-003 Stay signed in across reloads and token expiry

**Status:** Confirmed for reload and guest redirect. AC-04 and AC-05 not run (need a short token lifetime).

> As a registered user, I want my session restored automatically, so that I do not sign in again after a reload or token expiry.

- AC-01: With a valid refresh cookie, a reload restores the user without credentials.
- AC-02: With no cookie, `POST /api/auth/refresh` returns HTTP 200 with `isSuccess:false` and the user is a guest.
- AC-03: A guest opening `/favorites` is redirected to `/auth`.
- AC-04: A 401 on an expired access token triggers one refresh and the original request is retried successfully.
- AC-05: If that refresh fails, the user is logged out, the cache is cleared and the app goes to `/`.

Rules: each refresh issues a new refresh token.

## US-004 Log out

**Status:** DEFECT on AC-01.

> As a registered user, I want to log out, so that my account is no longer active on this device.

- AC-01: Choosing Logout from the user menu clears the session and cached data, goes to `/` from every page, and shows the Login button. **DEFECT:** logging out from `/favorites` lands on `/auth` (the protected-route redirect). Logout from a public page not yet observed.
- AC-02: The logout API deletes the refresh cookie and returns `Đăng xuất thành công`.
- AC-03: After logout and reload the user stays a guest.

Rules: logout does not invalidate an access token already issued.

## US-005 Discover content on the home page

**Status:** Confirmed. Empty state and ordering need controlled data.

> As a listener, I want to see popular genres and trending artists on the home page, so that I can find music quickly.

- AC-01: "Discover by Genre" shows at most 8 genre cards, with See all to `/genres`.
- AC-02: "Trending Artists" shows at most 10 artists, with See all to `/charts`.
- AC-03: With no data, an empty-state message is shown.
- AC-04: A genre card opens `/category/{id}`; an artist card opens `/artist/{id}`.
- AC-05: Popular genres and artists are ordered by plays in the last 7 days; entries with none are excluded.
- AC-06: "Recommends for you" is covered by US-022.

## US-006 Explore all genres

**Status:** Confirmed.

> As a listener, I want to browse songs grouped by genre, so that I can discover music in styles I like.

- AC-01: `/genres` shows up to 6 genre sections, each titled with the correct genre name and holding up to 10 songs. The exact wording of the title does not matter.
- AC-02: With no data or an API failure, an empty-state message is shown.
- AC-03: Genre names are translated when a translation exists.
- AC-04: See all opens `/category/{id}`.

## US-007 View a genre page

**Status:** DEFECT on AC-05.

> As a listener, I want to open a genre and see its featured artists and popular songs, so that I can dive into that style.

- AC-01: `/category/{id}` shows the genre name, a paginated Featured Artists section (10 per page) and a paginated Songs section (12 per page).
- AC-02: Changing page loads that page (the page number is not in the URL).
- AC-03: Songs are ordered by total streams, highest first.
- AC-04: An artist appears under the genre that holds most of the artist's songs.
- AC-05: An unknown category id shows a visible not-found message and the API returns 404. **DEFECT:** the API returns 204 and the page is blank.

## US-008 View top charts

**Status:** Confirmed.

> As a listener, I want to see top charts of songs by genre, so that I can see what is trending.

- AC-01: `/charts` shows up to 10 category charts of 10 ranked songs each. Categories 10 and 26 come first.
- AC-02: With no data, an empty-state message is shown; a category with no songs shows "no data".
- AC-03: Clicking a song opens `/song/{id}`; clicking an artist opens `/artist/{id}`.

Rules: no popular-artists block and no favorite control on charts.

## US-009 View an artist page

**Status:** DEFECT on AC-05.

> As a listener, I want to open an artist page and see their songs and related artists, so that I can listen to more.

- AC-01: `/artist/{id}` shows the name, a Play button, paginated Main Songs and Collaboration Songs (10 per page) and Related Artists (4 at a time).
- AC-02: Play starts the artist's songs and the button toggles to Pause.
- AC-03: For a signed-in user, song lists show their favorite state.
- AC-04: An artist with no main genre shows no related artists.
- AC-05: An unknown artist id shows a visible not-found message and the API returns 404. **DEFECT:** the API returns 204 and the page shows only a Play button.
- AC-06: Order of main and collaboration songs is not defined in the code (open).

Rules: the main artist of a song is the first-linked artist. Related artists share the artist's main genre.

## US-010 Search for songs and artists

**Status:** UNBLOCKED; confirmed through the API on 2026-10-08 (AC-08, AC-09 and the empty result; `docs/exploration/browser/search.md`), browser not yet re-run. The Elasticsearch API key was renewed on 2026-10-08 (stakeholder), and the SUT now fills the `songs` and `artists` indices from PostgreSQL at API startup (`ElasticSeeder`, SUT commit `d1a3c44`). The repository behavior below is the expected behavior. Still to observe in the browser: the suggestion and results UI with real data, and the suggestion box showing "No suitable suggestions" for an empty result (it was not seen while the key was outdated).

> As a listener, I want to search by song or artist name and see suggestions as I type, so that I can find something to listen to.

- AC-01: Typing fewer than 2 characters sends no suggestion request.
- AC-02: Typing 2 or more characters (after a 300 ms pause) shows suggestions, with a loading and a no-suggestion state.
- AC-03: Clicking an artist suggestion opens `/artist/{id}`; a song suggestion opens `/song/{id}`.
- AC-04: Enter with a non-blank query opens `/search?q=<trimmed query>`.
- AC-05: Results have All / Songs / Artists tabs. All shows up to 10 songs and 4 artists; Songs is paginated.
- AC-06: No match shows "No results found for "<keyword>"".
- AC-07: The clear (X) button clears the query and suggestions.
- AC-08: An exact case-insensitive name match is shown as "Top result".
- AC-09: The server raises a page size below 10 to 10.
- AC-10: Fuzzy matching and Vietnamese diacritics follow Elasticsearch behavior (open).

Rules: artists are listed before songs. Only songs and artists present in the Elasticsearch `songs` and `artists` indices are searchable. Both indices are filled from PostgreSQL every time the API starts (`ElasticSeeder`); a song added after startup is not searchable until the next restart, and a song deleted from the database stays in the index.

## US-011 View song details

**Status:** DEFECT on AC-06.

> As a listener, I want to open a song page and see its cover, artists, counts and lyrics, so that I can learn about the song.

- AC-01: `/song/{id}` shows title, cover, artist links, favorite and review counts, Play, Download, lyrics and the artists list.
- AC-02: An unknown song id returns 404 and shows "Song not found".
- AC-03: With a lyric file, time-tagged lines are shown (long lyrics collapse with Show More / Show Less); otherwise "no lyrics yet".
- AC-04: While the song plays, the current lyric line is highlighted.
- AC-05: "Other songs by ..." lists up to 30 songs; more than 4 adds View More / Show Less.
- AC-06: For a signed-in user, the heart and star icons are filled when the user favorited or reviewed the song. **DEFECT:** after a hard reload the detail request runs before the session is restored, so both come back false. Correct after in-app navigation.
- AC-07: The heart and star on this page only display counts; favoriting and rating happen in the player bar.
- AC-08: If the lyric file cannot be fetched, no lyrics are shown (open).

## US-012 Download a song

**Status:** Partly confirmed (download works from the song page when logged in).

> As a listener, I want to download a song as an MP3, so that I can listen offline.

- AC-01: Download on the song page saves a file named from the title, with characters outside `[a-zA-Z0-9._-]` replaced by `_`, and `.mp3` extension.
- AC-02: A download failure shows a `download_error` toast.
- AC-03: Guests may download (intended).

## US-013 Play songs with player controls

**Status:** Play, pause, next, previous confirmed. Other controls not yet run.

> As a listener, I want to play a song and control playback, so that I can listen the way I like.

- AC-01: Play shows the player bar, starts audio and shows title, artist and cover.
- AC-02: Pause/Play toggles playback and the icon.
- AC-03: Next plays the next song; with 3 or fewer left a new random batch is appended; Previous plays the previous song.
- AC-04: Repeat cycles Off, Repeat all, Repeat one; Repeat one restarts the same song, Repeat all restarts the queue.
- AC-05: Shuffle keeps the current song first and shuffles the rest; turning it off restores the order.
- AC-06: Default volume is 70%; Mute stores and restores the previous volume.
- AC-07: When a song ends, the next one starts.
- AC-08: The title is cut at 25 characters with an ellipsis; clicking it opens `/song/{id}`.
- AC-09: Guests can play.
- AC-10: Seek bar, time display and continued playback across page navigation (open). The player controls are rendered 2 to 3 times; scope any locator to the player wrapper.

Rules: the next batch is random songs that have lyrics.

## US-014 Sign-in prompt for members-only actions

**Status:** Sidebar case confirmed. Player-bar case not yet run as a guest.

> As a guest, I want to be told to sign in when I try favorites or ratings, so that I know how to unlock them.

- AC-01: A guest clicking Favorites in the sidebar gets the "Start Listening" sign-in modal and does not navigate.
- AC-02: A guest clicking the heart or rate button in the player bar gets the modal and no API call is made.
- AC-03: "Login Now" goes to `/auth` (and pauses music when opened from the player).
- AC-04: "Maybe Later", the X or the overlay closes the modal.
- AC-05: While the modal is open, page scrolling is locked and restored on close.

Rules: favorites page, favorite, rating and stream recording need login.

## US-015 Favorite and unfavorite a song

**Status:** DEFECT on AC-01.

> As a registered user, I want to mark songs as favorites and remove them, so that I keep the songs I love in one place.

- AC-01: Clicking the heart on a non-favorite song returns `Đã thêm vào yêu thích` with `isFavorited:true`, fills the heart and increases the like count by 1. **DEFECT:** the song-page counter stays unchanged until reload. The player-bar count was not recorded.
- AC-02: Clicking again returns `Đã bỏ yêu thích`, clears the heart and decreases the count (never below 0).
- AC-03: The heart is disabled while a request is in flight.
- AC-04: A change clears the favorites cache, so `/favorites` is correct on the next visit.
- AC-05: A favorite stored with `IsFavorite=false` counts as not favorited; toggling again flips the same record.
- AC-06: The favorite control exists only in the player bar. No favorite on cards, rows or charts.
- AC-07: Favoriting a non-existent song id through the API fails (likely 400).

Rules: one favorite record per user and song; like count counts only `IsFavorite = true`.

## US-016 View and manage my favorites playlist

**Status:** Confirmed for list, empty state, Play All and guest redirect. Drag, show more and download not yet run.

> As a registered user, I want to see all my favorites in one playlist and play or reorder them, so that I can enjoy my collection.

- AC-01: `/favorites` lists the user's favorites with a "Featured Artist" line (the 1 to 3 most frequent artists, then "& N others").
- AC-02: With no favorites, "Add your favorite songs to see them here!" is shown.
- AC-03: Play All plays the playlist; the button shows Pause while a playlist song plays.
- AC-04: Dragging a row reorders the display and the play queue (client only).
- AC-05: A show more / show less toggle expands and collapses a long list.
- AC-06: Download Playlist downloads the songs one by one, 1 second apart.
- AC-07: A guest opening `/favorites` is redirected to `/auth`.

Rules: the order is not saved and resets after reload (intended).

## US-017 Rate and review a song

**Status:** DEFECT on AC-05 (runtime) and AC-09, AC-10 (source only, not run because they write permanent data).

> As a registered user, I want to rate a song with stars and an optional comment and read other reviews, so that I can share my opinion.

- AC-01: For a user who has not reviewed the song, the modal shows a 1 to 5 star selector, an optional comment and a submit button disabled until a star is chosen.
- AC-02: Submitting posts the review (`Đánh giá thành công!`), prepends it to the list and increases the review count.
- AC-03: An empty comment is sent as `(Không có bình luận)`.
- AC-04: A user who already reviewed the song sees only the review list; the rate button shows a "rated" state.
- AC-05: Each review shows display name, stars, comment and date `yyyy-MM-dd`, newest first. **DEFECT:** a newly posted review shows `30/9/2026` until reload.
- AC-06: A submit failure shows "Không thể gửi đánh giá. Vui lòng thử lại."
- AC-07: A guest clicking rate gets the sign-in modal (US-014).
- AC-08: Empty-review text and closing the modal by X or overlay (open).
- AC-09: A second review by the same user for the same song is rejected by the server, including direct API calls. **DEFECT (source only):** the server accepts it.
- AC-10: A rating outside 1 to 5 is rejected by the server. **DEFECT (source only):** the server accepts any value. Comment length limit and rejection status code are not decided.

Rules: reviews cannot be edited or deleted (no API).

## US-018 Change interface language

**Status:** Confirmed. Persistence and translation completeness not fully checked.

> As a user, I want to switch the interface language, so that I can use the app in my language.

- AC-01: The dropdown lists Tiếng Việt, English, 日本語, Русский, Deutsch with a check on the current one.
- AC-02: Selecting a language switches the UI immediately and sets `<html lang>` (vi, en, ja, ru, de).
- AC-03: On a first visit the browser language is used; unsupported languages fall back to English.
- AC-04: The choice persists across reloads (`localStorage.i18nextLng`) and all five translation files are complete (open; a missing key `genre_category` was seen).

Rules: server messages and the rating modal stay Vietnamese in every language.

## US-019 Change color theme

**Status:** Confirmed. Persistence after reload not yet run.

> As a user, I want to choose a color theme, so that I can personalize the app.

- AC-01: The settings menu lists six themes (Ruby, Amethyst, Sapphire, Emerald, Topaz, Aquamarine) and marks the active one.
- AC-02: Selecting a theme changes the colors immediately and saves it in `localStorage.selectedTheme`.
- AC-03: The saved theme is applied again after reload.

Rules: the theme is stored per browser, not per account.

## US-020 Navigation and layout

**Status:** DEFECT on AC-05.

> As a user, I want consistent navigation, so that I can move between the main areas easily.

- AC-01: Pages show a sidebar (Discover, Genres, Charts, Favorites), a header (back/forward, search, language, settings, Login or user menu) and a footer. `/auth` has its own layout.
- AC-02: The sidebar item of the current route is highlighted.
- AC-03: The user menu contains Favorite Playlist and Logout.
- AC-04: A signed-in user opening `/recent` sees only the placeholder "Nghe Gần Đây"; a guest is redirected to `/auth`.
- AC-05: An unknown route shows a visible not-found page. **DEFECT:** the main area is blank and the console warns "No routes matched location".

## US-021 Popular content reflects real listening

**Status:** Stream recording confirmed (one run). Effect on rankings not provable at runtime.

> As a listener, I want trending content to reflect what people listen to, so that charts are meaningful.

- AC-01: A signed-in user playing a song for at least 20 seconds records exactly one stream (once per playback).
- AC-02: A guest playing a song records no stream.
- AC-03: Popular songs, artists and genres are ordered by streams in the last 7 days.
- AC-04: Caches (client 15 minutes) can delay new streams in lists.
- AC-05: The active-users counter (heartbeat every 45 seconds) has an API but no UI.

## US-022 Receive "Recommended for you" recommendations

**Status:** Confirmed at runtime. DEFECT on AC-14, AC-15, AC-17. Priority Critical.

> As a listener, I want to see songs recommended for me while I browse, so that I can open them with one click.

Scope: a third-party service owned by another team. The app only loads the tracker script and provides empty containers. We check what the user sees and what data is sent, not the algorithm.

Test placement (stakeholder): regression or a separate recommendation/security suite, never smoke and never the gate of the app's own CI. Tag the tests, run them in their own job, and block the tracker in every other suite. A failure is a third-party issue, not an app failure.

Where it appears: inline "Recommends for you" on Home (50), Song page (10), Category page (20). Popup "Recommendations just for you" (50, close with `button.recsys-close`) on Song, Category, Genres and Charts. Not on Home, Artist or Auth. `/search` and logged-in `/favorites` popups are configured but not observed.

- AC-01: Inline cards each show an image, title and artist; none blank or broken.
- AC-02: The popup shows 50 cards where listed above and can be closed.
- AC-03: Recommendations stay present when moving between pages.
- AC-04: If the recommendation call fails, returns 500 or returns an empty list, the page still loads, the heading stays and the section is empty.
- AC-07: A card at position n shows the title, artist and image of item n in the service response.
- AC-08: Clicking a card opens `/song/{DomainItemId}` in the same tab, and `POST /evaluation` is sent with `Rank = n`.
- AC-09: AC-07 and AC-08 hold for the first, a middle and the last card, inline and in the popup.
- AC-10: No password, email, phone, PSMusic token or API key is ever sent to the service.
- AC-11: User identity appears only as `UserId` (username) and `AnonymousId`, and only after consent.
- AC-12: A keyword typed in the header search and submitted is sent as `push-keyword` after consent (accepted).
- AC-13: Tracker calls are `POST /recommendation`, `/evaluation`, `/event` and `/recommendation/push-keyword`. The rules come from the service and can change without any change here.
- AC-14: **DEFECT.** After Decline, no behavior is sent (no `/evaluation`, no `push-keyword`, no `/event`); recommendations are still shown and card clicks still work. Today `/evaluation` and `push-keyword` are still sent.
- AC-15: **DEFECT.** After Decline, no identity (`AnonymousId`, `UserId`) is sent. Today both are still sent.
- AC-16: After consent, behavior is sent only when the user interacts (click, rating, review) with a song card, not by browsing. Confirmed for song-card play overlays, song rows, dual-column rows, song-page Play and Download, and the player-bar heart. Search-result cards, rating and review are not checked.
- AC-17: **DEFECT.** Before the user clicks Accept or Decline, nothing is sent (default results may still be received). Today `/recommendation` with `UserId` and `AnonymousId` is sent while the banner is still visible.

Rules: the card id (`data-id`) is the service's id; the song id is `DomainItemId`. Sending the previous username after logout is accepted. Behavior is sent only for song cards. Open: the same list shows on every song page (accepted).

## US-023 View my profile

**Status:** PROVISIONAL. DEFECT on AC-03 (runtime + source). No UI and no agreed endpoint exist today.

> As a registered user, I want to view my own profile information, so that I can see the account details the application holds for me.

- AC-01: A signed-in user can get their own details (at least username, display name, email; the password is never returned).
- AC-02: A guest or a request without a valid token is refused (401 observed for `GET /api/auth/me`).
- AC-03: A signed-in user cannot read another user's profile. **DEFECT:** `GET /api/user/{id}` returns any user's data, including the email, to any signed-in user (source, confirmed at runtime 2026-10-08).
- AC-04: Where the profile appears in the UI and which fields can be edited is not defined.

Open: which endpoint is the profile endpoint (README says `/api/user/profile`, the code has `/api/auth/me`)? Is a UI page in scope?

---

## Technical behaviors

- Every `/api/*` request needs the header `X-App-Service-Key`; otherwise 401 `{"message":"Unauthorized Access"}`. Its value comes from configuration, is visible in the browser and must not be committed.
- Protected endpoints return 401 with an empty body without a valid bearer token. An invalid bearer on a public endpoint is served as a guest (200).
- `POST /api/auth/refresh` returns HTTP 200 with `isSuccess:false` on failure; login failure returns 400.
- Paged lists use `{ items, page, limit, totalItems, totalPages }`; JSON is camelCase.
- Songs without a lyric file are excluded from most lists but not from category lists, song detail or the player.
- UI sign-up calls an external email-reputation service; media (MP3, lyrics) is loaded from S3.
- Environment: the local API writes to a shared remote PostgreSQL. Reviews and streams are permanent and cannot be deleted, so write tests need an approved environment or a cleanup plan.

## Open items

- Verify US-010 at runtime now that the Elasticsearch key is renewed (2026-10-08), and list known indexed titles for test data.
- Decide the comment length limit and the status code for rejected reviews (US-017).
- Define the profile endpoint and UI (US-023).
- Choose how UI sign-up is tested (real mailbox or an approved mock of the external check).
- Verify token expiry and the 401 retry path (US-003) with a short token lifetime.
- Confirm in the browser: logout from a public page, guest heart/rate gating, remaining player controls, favorites drag and download, theme and language persistence.
