# PSMusic - Test Case Implementation Progress

| Item | Value |
|---|---|
| Source of test cases | `docs/test-strategy/test-scenarios.md` (117 scenarios, `TS-AREA-nn`) |
| Automation classification | `docs/test-strategy/automation-analysis.md` §3 |
| Code inspected | `tests/`, `playwright.config.ts`, all local branches (`main`, `feature/auth`, `docs/exploration`, `docs/test-design`) |
| Last reviewed | 2026-10-05 (branch `main`, commit `34831b0`) |

## Status basis

- **Yes**: an automated test in the repository covers the scenario's objective and expected result.
- **Partial**: an automated test exists but covers only part of the scenario.
- **No**: the scenario is defined but no automated test covers it.

**Current finding:** the only spec file is `tests/example.spec.ts`, the default Playwright scaffold. Its two tests (`has title`, `get started link`) open `https://playwright.dev/` and do not exercise PSMusic. There are no page objects, API clients, fixtures or test data yet, and no local branch has unmerged test code. Every scenario is therefore **No**.

Scenario names and objectives are taken from `test-scenarios.md`. Priorities are the scenario priorities defined there.

---

# Registration

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-REG-01 | Sign-up with an empty field is blocked | Missing name, email or password is caught on the client. | P3 | No |
| TS-REG-02 | Sign-up password length boundary | Passwords shorter than 8 characters are refused on the client; 8 is accepted. | P3 | No |
| TS-REG-03 | Registration through the API creates an account | A valid, unused username and email create an account that can sign in, with no session issued. | P3 | No |
| TS-REG-04 | UI sign-up success | The UI completes sign-up when the email check accepts the address. | P3 | No |
| TS-REG-05 | Duplicate username or email is refused | Uniqueness of username and email is enforced and the message is shown. | P3 | No |
| TS-REG-06 | No response ever contains the password | The password, or any hash of it, is never returned. | P2 | No |
| TS-REG-07 | Username longer than the display-name limit | Find out how a username longer than 30 characters is handled. | P3 | No |
| TS-REG-08 | Email rejected by the external check stops sign-up | An address the external check rejects never reaches the register call. | P3 | No |

# Authentication and Session

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-AUTH-01 | Valid login creates a session | Correct credentials sign the user in. | P1 | No |
| TS-AUTH-02 | Login client validation | Empty fields and short passwords are caught before any request. | P3 | No |
| TS-AUTH-03 | Unknown username and wrong password | Login failures return the agreed distinct messages. | P1 | No |
| TS-AUTH-04 | Password visibility toggle and panel switch | Form helpers behave as agreed. | P3 | No |
| TS-AUTH-05 | Reload restores the session | A signed-in user stays signed in after a full reload. | P1 | No |
| TS-AUTH-06 | No refresh cookie means guest | Without a cookie the app treats the user as a guest. | P1 | No |
| TS-AUTH-07 | Expired access token triggers one refresh and a retry | An expired token is renewed silently. | P1 | No |
| TS-AUTH-08 | Failed refresh logs the user out cleanly | When the token cannot be renewed, the app logs out instead of staying half signed in. | P1 | No |
| TS-AUTH-09 | Each refresh issues a new refresh token | Refresh rotates the refresh token. | P1 | No |
| TS-AUTH-10 | Logout lands on `/` from every page | Logout always ends on Home with the Login button. | P2 | No |
| TS-AUTH-11 | Logout clears the session | After logout the browser has no session left. | P2 | No |

# Authorization and Gating

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-AUTHZ-01 | Requests without a valid service key are refused | The service key is required on every `/api/*` call. | P2 | No |
| TS-AUTHZ-02 | Bearer token enforcement | Protected endpoints need a valid token; public ones treat a bad token as a guest. | P2 | No |
| TS-AUTHZ-03 | Guest clicking Favorites in the sidebar | The sidebar entry gates guests. | P2 | No |
| TS-AUTHZ-04 | Guest clicking heart or rate in the player bar | Player-bar member actions gate guests without calling the API. | P2 | No |
| TS-AUTHZ-05 | Closing the sign-in modal | All close options work and page scrolling is restored. | P2 | No |
| TS-AUTHZ-06 | Protected routes for guests and members | `/favorites` and `/recent` are for members only. | P2 | No |
| TS-PROF-01 | A user reads their own profile | A signed-in user gets their own details; a request without a valid token is refused. | P1 | No |
| TS-PROF-02 | A user cannot read another user's profile | Personal data of other users is not exposed. | P1 | No |

# Discovery

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-DISC-01 | Home sections, limits and links | Home shows the agreed sections and navigates correctly. | P3 | No |
| TS-DISC-02 | Popular genres and artists follow 7-day plays | Popularity lists are ordered by plays in the last 7 days and exclude items with none. | P2 | No |
| TS-DISC-03 | Discovery empty states | Pages show an empty-state message instead of breaking when there is no data or the API fails. | P3 | No |
| TS-DISC-04 | Genres page sections | `/genres` shows genre sections with the right names and songs. | P3 | No |
| TS-DISC-05 | Category page content and paging | The category page shows its sections with working paging. | P3 | No |
| TS-DISC-06 | Category ordering and artist placement | Songs are ordered by total streams; an artist appears under the genre holding most of their songs. | P3 | No |
| TS-DISC-07 | Unknown category | An unknown category id is reported as not found. | P2 | No |
| TS-DISC-08 | Charts structure | Charts show ranked lists in the agreed category order, without artists or favorites. | P3 | No |
| TS-DISC-09 | Chart links | Chart entries navigate correctly. | P3 | No |
| TS-DISC-10 | Artist page content and Play | The artist page shows its sections and Play starts the artist's songs. | P3 | No |
| TS-DISC-11 | Signed-in user sees favorite state in artist lists | Song lists reflect the user's favorites. | P3 | No |
| TS-DISC-12 | Unknown artist | An unknown artist id is reported as not found. | P2 | No |

# Search

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-SRCH-01 | Suggestion threshold and debounce | Suggestions are requested only for 2+ characters after the typing pause. | P2 | No |
| TS-SRCH-02 | Suggestion box states | The suggestion box shows loading, results and no-result states. | P2 | No |
| TS-SRCH-03 | Navigation from suggestions and Enter | Search leads to the right page. | P2 | No |
| TS-SRCH-04 | Results page tabs and limits | The results page groups and limits results correctly. | P2 | No |
| TS-SRCH-05 | No results | An empty result is clearly reported. | P2 | No |
| TS-SRCH-06 | Clear the search | The X button resets the search. | P2 | No |
| TS-SRCH-07 | Page size is raised to 10 | The server raises a size below 10 to 10. | P2 | No |
| TS-SRCH-08 | Real search finds indexed songs and artists | Search works against the real index. | P2 | No |
| TS-SRCH-09 | Missing or empty keyword | The search API handles a missing keyword without a server error. | P3 | No |

# Song Details

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-SONG-01 | Song page content | The song page shows everything agreed, consistent with the API. | P1 | No |
| TS-SONG-02 | Unknown song | An unknown song is reported. | P2 | No |
| TS-SONG-03 | Lyrics display | Lyrics are shown when they exist, otherwise a message. | P3 | No |
| TS-SONG-04 | Current lyric line highlighted during playback | The lyric line follows playback. | P3 | No |
| TS-SONG-05 | Other songs by the artist | The list is limited and expandable. | P3 | No |
| TS-SONG-06 | Heart and star state after reload and navigation | A signed-in user sees their favorite and review state on the song page. | P2 | No |
| TS-SONG-07 | Lyric file cannot be fetched | A lyric fetch failure does not break the page. | P3 | No |

# Download

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-DL-01 | Download saves a correctly named MP3 | Download works for guests and members, with a sanitized file name. | P3 | No |
| TS-DL-02 | Download failure shows an error | The user is told when a download fails. | P3 | No |

# Player

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-PLAY-01 | Start playback | Pressing Play starts the song for guests and members. | P1 | No |
| TS-PLAY-02 | Pause and resume | Pause stops playback and Play resumes it. | P1 | No |
| TS-PLAY-03 | Next, previous and queue refill | Queue navigation works and the queue never runs dry. | P1 | No |
| TS-PLAY-04 | Repeat modes | Repeat cycles through its states and each state behaves correctly. | P1 | No |
| TS-PLAY-05 | Shuffle | Shuffle reorders the rest of the queue and can be undone. | P1 | No |
| TS-PLAY-06 | Volume and mute | Volume defaults and mute behave as agreed. | P1 | No |
| TS-PLAY-07 | Next song starts when a song ends | Playback continues automatically. | P1 | No |
| TS-PLAY-08 | One click performs one action | Duplicated player controls (rendered 2 to 3 times) do not double-handle a click. | P1 | No |
| TS-PLAY-09 | Player title shortening and link | Long titles are shortened and the title opens the song. | P3 | No |
| TS-PLAY-10 | Audio file cannot be loaded | A missing or failing MP3 does not freeze the app. | P1 | No |

# Favorites

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-FAV-01 | Favorite and unfavorite update state and counts | A toggle changes the heart, the response and the like count by exactly one, consistently everywhere. | P2 | No |
| TS-FAV-02 | Rapid clicks while a request is in flight | Fast repeated clicks do not leave the state inconsistent. | P3 | No |
| TS-FAV-03 | Favorites page reflects a change at once | A toggle clears the 15-minute favorites cache. | P3 | No |
| TS-FAV-04 | Re-favoriting reuses the same record | Toggling repeatedly keeps one favorite record per user and song. | P3 | No |
| TS-FAV-05 | Favorite control exists only in the player bar | No favorite control appears elsewhere. | P3 | No |
| TS-FAV-06 | Favoriting a song that does not exist | The API refuses an unknown song id. | P3 | No |
| TS-FAV-07 | Favorites list and featured artist line | The playlist lists the user's favorites with a correct summary line. | P3 | No |
| TS-FAV-08 | Empty favorites | A user with no favorites sees the empty message. | P3 | No |
| TS-FAV-09 | Play All | The playlist can be played as a queue. | P3 | No |
| TS-FAV-10 | Reorder is client-only | Drag reordering changes display and queue but is not saved. | P3 | No |
| TS-FAV-11 | Show more and playlist download | Long lists collapse; the playlist downloads song by song. | P3 | No |

# Rating and Review

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-REV-01 | Rating form for a user who has not reviewed | The form only allows a submit once a star is chosen. | P1 | No |
| TS-REV-02 | Submitting a review | A review is saved and shown at once. | P1 | No |
| TS-REV-03 | Submitting without a comment | An empty comment gets the agreed placeholder. | P3 | No |
| TS-REV-04 | Rated state for a user who already reviewed | The UI does not offer a second review. | P1 | No |
| TS-REV-05 | Review list format and order | Reviews show the agreed fields, newest first, with one date format. | P3 | No |
| TS-REV-06 | Submit failure is reported | The user learns that the review was not saved. | P3 | No |
| TS-REV-07 | Server refuses a second review | Uniqueness is enforced by the server, not only by the UI. | P1 | No |
| TS-REV-08 | Server enforces the rating range | Only ratings 1 to 5 are stored. | P1 | No |
| TS-REV-09 | Rating modal with no reviews and closing | Record and check the open modal behaviors once agreed. | P3 | No |

# Listening Statistics

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-STRM-01 | One stream per qualifying playback | A member's playback counts once, after 20 seconds. | P2 | No |
| TS-STRM-02 | Guests record no stream | Guest playback is not counted. | P2 | No |
| TS-STRM-03 | Replay, repeat and seek | Clarify and verify what "once per playback" means. | P2 | No |
| TS-STRM-04 | Active-user heartbeat | Heartbeats count active users. | P3 | No |

# Language and Theme

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-L10N-01 | Switching language | The UI changes language immediately; server messages stay Vietnamese. | P3 | No |
| TS-L10N-02 | First visit, fallback and persistence | The initial language is chosen sensibly and the choice is kept. | P3 | No |
| TS-L10N-03 | Translation completeness | Every screen is translated in all five languages, including genre names. | P3 | No |
| TS-THEME-01 | Theme switch and persistence | Themes apply at once and survive a reload. | P3 | No |

# Navigation

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-NAV-01 | Layout and navigation elements | The shared layout is consistent. | P3 | No |
| TS-NAV-02 | Unknown route | Unknown URLs show a not-found page. | P2 | No |

# Recommendations

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-REC-01 | App works with the tracker blocked | PSMusic does not depend on the tracker. | P2 | No |
| TS-REC-02 | Where recommendations appear | Inline sections and popups appear exactly on the agreed routes. | P2 | No |
| TS-REC-03 | Card shows the matching item | Each card is a faithful, complete rendering of its item. | P2 | No |
| TS-REC-04 | Clicking a card opens the right song | A click on card n navigates to that song and reports position n. | P2 | No |
| TS-REC-05 | Popup close and persistence across pages | The popup can be closed, and recommendations stay while browsing. | P2 | No |
| TS-REC-06 | Failed or empty recommendation response | Agreed failure cases degrade quietly. | P2 | No |
| TS-REC-07 | Unconfirmed failure classes | Cover failures that the story does not name. | P2 | No |
| TS-REC-08 | Core features usable with recommendations active or failing | Recommendations never stop the user from using PSMusic. | P2 | No |
| TS-REC-09 | Nothing is sent before a consent choice | The tracker stays silent until the user chooses. | P1 | No |
| TS-REC-10 | Decline stops behavior and identity | Declining is respected while recommendations keep working. | P1 | No |
| TS-REC-11 | Behavior event per song-card type after consent | Each tracked interaction produces the right event for the right song. | P3 | No |
| TS-REC-12 | No behavior without interaction | Browsing alone sends no behavior. | P1 | No |
| TS-REC-13 | Rating, review and search after consent | Rating, review and search keyword tracking send only what is agreed. | P1 | No |
| TS-REC-14 | Only approved data is sent | Detect any sensitive or unapproved data sent to the service. | P1 | No |
| TS-REC-15 | Tracker configuration matches the approved snapshot | Detect remote changes to tracking rules, display configuration or the loader. | P1 | No |
| TS-REC-16 | Real recommendation service end to end | The real service is reachable, keeps its contract and works with PSMusic. | P2 | No |

# Cross-cutting API Behavior

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-API-01 | Paged list shape | Every paged endpoint uses the agreed shape. | P3 | No |
| TS-API-02 | Invalid paging values | Out-of-range paging values do not cause server errors. | P3 | No |

# Journeys

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-E2E-01 | Guest discovers and plays a song | A first-time visitor can find and play music. | P1 | No |
| TS-E2E-02 | Member listens, favorites and logs out | The main member journey works end to end. | P1 | No |

---

## Overall Progress

| Metric           | Count |
| ---------------- | ----: |
| Total Test Cases | 117 |
| Implemented | 0 |
| Partial | 0 |
| Not Implemented | 117 |
| Progress | 0.0% |

Progress = (Implemented + 0.5 × Partial) / Total × 100

### By feature

| Feature | Total | Implemented | Partial | Not Implemented | Progress |
| ------- | ----: | ----------: | ------: | --------------: | -------: |
| Registration | 8 | 0 | 0 | 8 | 0.0% |
| Authentication and Session | 11 | 0 | 0 | 11 | 0.0% |
| Authorization and Gating | 8 | 0 | 0 | 8 | 0.0% |
| Discovery | 12 | 0 | 0 | 12 | 0.0% |
| Search | 9 | 0 | 0 | 9 | 0.0% |
| Song Details | 7 | 0 | 0 | 7 | 0.0% |
| Download | 2 | 0 | 0 | 2 | 0.0% |
| Player | 10 | 0 | 0 | 10 | 0.0% |
| Favorites | 11 | 0 | 0 | 11 | 0.0% |
| Rating and Review | 9 | 0 | 0 | 9 | 0.0% |
| Listening Statistics | 4 | 0 | 0 | 4 | 0.0% |
| Language and Theme | 4 | 0 | 0 | 4 | 0.0% |
| Navigation | 2 | 0 | 0 | 2 | 0.0% |
| Recommendations | 16 | 0 | 0 | 16 | 0.0% |
| Cross-cutting API Behavior | 2 | 0 | 0 | 2 | 0.0% |
| Journeys | 2 | 0 | 0 | 2 | 0.0% |
| **Total** | **117** | **0** | **0** | **117** | **0.0%** |

### Context

The total counts every defined scenario. Of the 117, `automation-analysis.md` §1.1 marks 99 as automation candidates (83 full, 16 partial). The other 18 are manual (4), exploratory (5) or deferred (9). Those 18 stay **No** here because no automated test exists for them, not because they are expected to be automated now.
