# PSMusic - Test Case Implementation Progress

| Item | Value |
|---|---|
| Source of test cases | `docs/test-strategy/test-scenarios.md` (117 scenarios, `TS-AREA-nn`) |
| Automation classification | `docs/test-strategy/automation-analysis.md` §3 |
| Code inspected | `tests/`, `src/`, `playwright.config.ts` on branch `feature/song-details` |
| Last reviewed | 2026-10-13 (branch `feature/search-favorites-discovery`, Search, Favorites and Discovery implementation) |

## Status basis

- **Yes**: an automated test in the repository covers the scenario's objective and expected result.
- **Partial**: an automated test exists but covers only part of the scenario.
- **No**: the scenario is defined but no automated test covers it.

**Current state:** the AUTH area (TS-AUTH-01 to 11) is automated in `tests/auth/` (`login.spec.ts`, `session.spec.ts`, `logout.spec.ts`) on the framework in `src/` (environment config, `AuthApi` client, page objects, fixtures). The default `tests/example.spec.ts` scaffold was removed. Song Details (TS-SONG-01 to 07, except the manual TS-SONG-04) is automated in `tests/song/song-details.spec.ts` and `tests/shared/not-found.spec.ts`, with the `SongApi` client and an extended `SongPage`. Authorization and Gating (TS-AUTHZ-01 to 06, TS-PROF-01, TS-PROF-02) is automated in `tests/authz/` (`api-access.spec.ts`, `guest-gating.spec.ts`, `protected-routes.spec.ts`) and `tests/profile/profile.spec.ts`, with the `sendApiRequest` helper, the `UserApi` client and the `SignInPrompt`, `PlayerBar` and `RecentPage` page objects. Player: TS-PLAY-06 (volume and mute) is automated in `tests/player/volume.spec.ts` with the extended `PlayerBar` (2026-10-09, branch `feature/player-automation`). On 2026-10-12 (branch `feature/p1-core-coverage`) the remaining automatable P1 scenarios were added: Player (TS-PLAY-01 to 05, 07, 08) in `tests/player/`, Rating and Review (TS-REV-01, UI halves of TS-REV-02 and TS-REV-04) in `tests/review/`, both Journeys in `tests/journeys/`, and Recommendations TS-REC-12 against the live tracker in `tests/recommendations/`. On 2026-10-13 (branch `feature/search-favorites-discovery`) the most important Search, Favorites and Discovery scenarios were added: TS-SRCH-01, 03, 05, 08 in `tests/search/`, TS-FAV-01, 03, 04 in `tests/favorites/`, TS-DISC-01, 08, 09 in `tests/discovery/`, and TS-DISC-07 and TS-DISC-12 as rows of `tests/shared/not-found.spec.ts`. Every other area is still **No**. Run results and open findings are listed under each area.

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
| TS-AUTH-01 | Valid login creates a session | Correct credentials sign the user in. | P1 | Yes |
| TS-AUTH-02 | Login client validation | Empty fields and short passwords are caught before any request. | P3 | Yes |
| TS-AUTH-03 | Unknown username and wrong password | Login failures return the agreed distinct messages. | P1 | Yes |
| TS-AUTH-04 | Password visibility toggle and panel switch | Form helpers behave as agreed. | P3 | Yes |
| TS-AUTH-05 | Reload restores the session | A signed-in user stays signed in after a full reload. | P1 | Yes |
| TS-AUTH-06 | No refresh cookie means guest | Without a cookie the app treats the user as a guest. | P1 | Yes |
| TS-AUTH-07 | Expired access token triggers one refresh and a retry | An expired token is renewed silently. | P1 | Partial |
| TS-AUTH-08 | Failed refresh logs the user out cleanly | When the token cannot be renewed, the app logs out instead of staying half signed in. | P1 | Partial |
| TS-AUTH-09 | Each refresh re-issues the refresh token | Refresh re-issues the refresh token with a renewed lifetime. | P1 | Partial |
| TS-AUTH-10 | Logout lands on `/` from every page | Logout always ends on Home with the Login button. | P2 | Yes |
| TS-AUTH-11 | Logout clears the session | After logout the browser has no session left. | P2 | Yes |

**Implementation notes (2026-10-05).** Run: `npx playwright test tests/auth` against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`), Chromium, run 3 times in parallel. All 12 tests give the expected result every run (two of them are known-defect expected failures). No flaky results.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-AUTH-01 | `login.spec.ts` | Pass | API contract from the captured login response; cookie flags and 7-day expiry from the browser cookie jar; token absent from script-readable storage |
| TS-AUTH-02 | `login.spec.ts` | Pass | Request capture proves no login call for the three rejected inputs; 8 characters sends the call |
| TS-AUTH-03 | `login.spec.ts` | Pass | Both messages at API level (`Tài khoản không tồn tại`, `Sai mật khẩu`), no cookie; wrong password checked in the UI |
| TS-AUTH-04 | `login.spec.ts` | Pass | Also checks the eye state is reset by the panel switch |
| TS-AUTH-05 | `session.spec.ts` | Pass | Session seeded through `context.request` login (no UI login) |
| TS-AUTH-06 | `session.spec.ts` | Pass | `/favorites` redirect left to TS-AUTHZ-06 (analysis §6) |
| TS-AUTH-07 | `session.spec.ts` | Pass | **Partial:** client 401 → one refresh → retry, with the first favorites call answered 401 in the browser. Real token expiry deferred (D-TOK, TR-09) |
| TS-AUTH-08 | `session.spec.ts` | Expected fail (known defect) | **Partial:** controlled 401 + invalid refresh cookie; real expiry deferred (D-TOK). Logout itself works; landing is `/auth`, not `/`. "Cached data cleared" is not asserted: the cache is React state (`DataCacheContext`) with no visible signal of its own. **New finding**, recorded as known defect `US-003-AC-05` (exploration A-7). Needs confirmation as a defect |
| TS-AUTH-09 | `session.spec.ts` | Pass | **Partial:** each refresh accepts the last token and re-issues one for the same user with a renewed 7-day expiry (read from the token claims); reuse of an old token waits for U-2.4. Rule clarified 2026-10-05: identical tokens within one second (A-9) accepted, a different value per call is not required |
| TS-AUTH-10 | `logout.spec.ts` | Public page: pass. `/favorites`: expected fail (known defect) | Known defect US-004-AC-01 reconfirmed (lands on `/auth`). Public-page case observed for the first time: lands on `/` |
| TS-AUTH-11 | `logout.spec.ts` | Pass | Logout message `Đăng xuất thành công`, cookie removed, guest after reload |

**CI:** the GitHub Actions workflow cannot run these tests yet (no app or `.env` in CI). Running the app in CI is planned for a later phase.

Known-defect tests use `knownDefect()` (`src/support/known-defect.ts`), called right before the assertion the defect breaks, so earlier failures are still reported and a fix shows up as an unexpected pass.

# Authorization and Gating

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-AUTHZ-01 | Requests without a valid service key are refused | The service key is required on every `/api/*` call. | P2 | Yes |
| TS-AUTHZ-02 | Bearer token enforcement | Protected endpoints need a valid token; public ones treat a bad token as a guest. | P2 | Yes |
| TS-AUTHZ-03 | Guest clicking Favorites in the sidebar | The sidebar entry gates guests. | P2 | Yes |
| TS-AUTHZ-04 | Guest clicking heart or rate in the player bar | Player-bar member actions gate guests without calling the API. | P2 | Yes |
| TS-AUTHZ-05 | Closing the sign-in modal | All close options work and page scrolling is restored. | P2 | Yes |
| TS-AUTHZ-06 | Protected routes for guests and members | `/favorites` and `/recent` are for members only. | P2 | Yes |
| TS-PROF-01 | A user reads their own profile | A signed-in user gets their own details; a request without a valid token is refused. | P1 | Yes |
| TS-PROF-02 | A user cannot read another user's profile | Personal data of other users is not exposed. | P1 | Yes |

**Implementation notes (2026-10-08).** Run: `npx playwright test tests/authz tests/profile` against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`), Chromium, 8 workers, repeated 3 times (`--repeat-each=3`): 48/48 give the expected result (TS-PROF-02 is a known-defect expected failure). The full suite (`npx playwright test`, 37 tests) also passes, as a regression check of the shared fixture and client changes. Endpoints, responses and locators come from source and runtime probes recorded in `docs/exploration/browser/authorization.md` (Z-1 to Z-14).

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-AUTHZ-01 | `api-access.spec.ts` | Pass | One test per endpoint (public song detail, tagged `@smoke`; protected favorites), each without the key and with a wrong key: 401, body exactly `{"message":"Unauthorized Access"}` |
| TS-AUTHZ-02 | `api-access.spec.ts` | Pass | Six protected endpoints from the scenario, each without a token and with an invalid one: 401, empty body. Public song detail with an invalid token: 200, song served with `isFavorited`/`isReviewed` false. Also owns the 401 of `auth/me` (analysis §6, overlap #3) |
| TS-AUTHZ-03 | `guest-gating.spec.ts` | Pass | Modal with both buttons; URL stays `/` |
| TS-AUTHZ-04 | `guest-gating.spec.ts` | Pass | Guest plays song 1 (audio element playing); heart → modal → Maybe Later; Rate → modal → Login Now → `/auth`, audio paused. A request barrier then proves no `favorite-toggle` and no `add-review` was sent. Closes U-3.2. **Fix during the run:** under 8 workers the MP3 took over 5 s to start (R-AUD), so the playback wait uses a documented 20 s budget (`AUDIO_START_TIMEOUT_MS`); the assertion is unchanged |
| TS-AUTHZ-05 | `guest-gating.spec.ts` | Pass | Maybe Later, X icon and overlay click each close the modal; body `overflow` is `hidden` while open and back to its earlier value after each close |
| TS-AUTHZ-06 | `protected-routes.spec.ts` | Pass | Guest test (`@smoke`): `/favorites` and `/recent` redirect to `/auth` after the refresh check answers `isSuccess:false`. Member test: favorites page renders (empty state for a fresh user); `/recent` main area is exactly "Nghe Gần Đây" |
| TS-PROF-01 | `profile.spec.ts` | Pass | `GET /api/auth/me` returns exactly `{ id, username, email, displayName }` of the user; no password-like field and no password value. Endpoint is still an assumption pending A-Q16 (annotated). The 401 case lives in TS-AUTHZ-02 |
| TS-PROF-02 | `profile.spec.ts` | Expected fail (known defect) | User A reads user B through `GET /api/user/{id}`: **200 with B's email** (Z-5). Defect `US-023-AC-03` is now confirmed at runtime, not just in source. The test expects a refusal (any non-2xx, status not decided) and none of B's fields; it fails at `refused, got 200`. Only endpoint today that takes a user id; the exploratory search for others (`risk-register.md` §5) is still open |

# Discovery

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-DISC-01 | Home sections, limits and links | Home shows the agreed sections and navigates correctly. | P3 | Yes |
| TS-DISC-02 | Popular genres and artists follow 7-day plays | Popularity lists are ordered by plays in the last 7 days and exclude items with none. | P2 | No |
| TS-DISC-03 | Discovery empty states | Pages show an empty-state message instead of breaking when there is no data or the API fails. | P3 | No |
| TS-DISC-04 | Genres page sections | `/genres` shows genre sections with the right names and songs. | P3 | No |
| TS-DISC-05 | Category page content and paging | The category page shows its sections with working paging. | P3 | No |
| TS-DISC-06 | Category ordering and artist placement | Songs are ordered by total streams; an artist appears under the genre holding most of their songs. | P3 | No |
| TS-DISC-07 | Unknown category | An unknown category id is reported as not found. | P2 | Yes |
| TS-DISC-08 | Charts structure | Charts show ranked lists in the agreed category order, without artists or favorites. | P3 | Yes |
| TS-DISC-09 | Chart links | Chart entries navigate correctly. | P3 | Yes |
| TS-DISC-10 | Artist page content and Play | The artist page shows its sections and Play starts the artist's songs. | P3 | No |
| TS-DISC-11 | Signed-in user sees favorite state in artist lists | Song lists reflect the user's favorites. | P3 | No |
| TS-DISC-12 | Unknown artist | An unknown artist id is reported as not found. | P2 | Yes |

**Implementation notes (2026-10-13).** Run: `npx playwright test tests/search tests/favorites tests/discovery tests/shared --repeat-each=3` against the local dev build (UI `https://localhost:5173`, API `https://localhost:7215`), Chromium, parallel workers: 39/39 give the expected result (three are known-defect expected failures), no flaky result. Full suite (`npx playwright test`, 66 tests before TS-DISC-08 and 09 were split, 67 after): all passed in three consecutive runs. Facts used here are recorded in `docs/exploration/browser/discovery.md`. Home and Charts only list genres and artists played in the last 7 days, so counts are checked as "at most" and names are compared with the page they open.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-DISC-01 | `discovery/discovery.spec.ts` | Pass | At most 8 genre tiles and 10 trending artists (2 and 1 today). See all of genres → `/genres`, of artists → `/charts`. The first genre tile opens its `/category/{id}` with the same name; the first artist card opens `/artist/{id}` with the same name |
| TS-DISC-07 | `shared/not-found.spec.ts` | Expected fail (known defect) | `GET /api/category/99999999` → **204** (expected 404); `/category/99999999` shows no not-found message. Known defect `US-007-AC-05`. The UI message is checked as any visible "not found" text: the story fixes no wording |
| TS-DISC-08 | `discovery/discovery.spec.ts` | Pass | Same page as TS-DISC-09, two tests so each scenario keeps its own result (analysis §6 #9). At most 10 charts (2 today), each ranked 1…n with n ≤ 10; genres 10 and 26, when present, lead in id order (only 10 is popular today); no Trending Artists block, no heart |
| TS-DISC-09 | `discovery/discovery.spec.ts` | Pass | First chart song title → `/song/{id}` with the same title; back; first artist name (a clickable span) → `/artist/{id}` with the same name |
| TS-DISC-12 | `shared/not-found.spec.ts` | Expected fail (known defect) | `GET /api/artist/99999999` → **204**; the page shows only a Play button. Known defect `US-009-AC-05` |

# Search

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-SRCH-01 | Suggestion threshold and debounce | Suggestions are requested only for 2+ characters after the typing pause. | P2 | Yes |
| TS-SRCH-02 | Suggestion box states | The suggestion box shows loading, results and no-result states. | P2 | No |
| TS-SRCH-03 | Navigation from suggestions and Enter | Search leads to the right page. | P2 | Yes |
| TS-SRCH-04 | Results page tabs and limits | The results page groups and limits results correctly. | P2 | No |
| TS-SRCH-05 | No results | An empty result is clearly reported. | P2 | Yes |
| TS-SRCH-06 | Clear the search | The X button resets the search. | P2 | No |
| TS-SRCH-07 | Page size is raised to 10 | The server raises a size below 10 to 10. | P2 | No |
| TS-SRCH-08 | Real search finds indexed songs and artists | Search works against the real index. | P2 | Yes |
| TS-SRCH-09 | Missing or empty keyword | The search API handles a missing keyword without a server error. | P3 | No |

**Implementation notes (2026-10-13).** Same run as Discovery. UI scenarios answer `GET /api/song/search` in the browser with fixtures copied from real responses (`src/data/search.ts`), as the automation analysis prescribes (§3.5); TS-SRCH-08 checks the real index and the shape those fixtures copy. Findings in `docs/exploration/browser/search.md` §8.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-SRCH-01 | `search/search.spec.ts` | Pass | The page clock is paused, so the 300 ms pause is driven exactly: 1 character sends nothing even after 900 ms; after typing "Binz" fast, nothing at 299 ms, one request for "Binz" at 300 ms |
| TS-SRCH-03 | `search/search.spec.ts` | Pass | Artist suggestion → `/artist/27` "Binz"; song suggestion → `/song/1`; Enter on `"  Chờ Anh Nhé  "` → `/search?q=Chờ Anh Nhé`; Enter on spaces stays. **Fix during the run:** a focus given within 150 ms after a suggestion click was undone by the header's blur timer, so `chooseSuggestion` waits for the box to close (SE-3) |
| TS-SRCH-05 | `search/search.spec.ts` | Pass | Controlled empty result: `No results found for "xyzqwvzz".`, no Top result section |
| TS-SRCH-08 | `search/search.spec.ts` | Pass | `@sit-live`. API: `Binz` and `BINZ` → top result artist 27; `Chờ Anh Nhé` → song 1; `Dương Domic` → artist 13; partial `Chờ Anh` and `Bin` find song 1 and artist 27 without a top result. UI: `/search?q=Chờ Anh Nhé` shows it as Top result. Preflight skips as "external unavailable" when a known artist returns nothing |

# Song Details

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-SONG-01 | Song page content | The song page shows everything agreed, consistent with the API. | P1 | Yes |
| TS-SONG-02 | Unknown song | An unknown song is reported. | P2 | Yes |
| TS-SONG-03 | Lyrics display | Lyrics are shown when they exist, otherwise a message. | P3 | Yes |
| TS-SONG-04 | Current lyric line highlighted during playback | The lyric line follows playback. | P3 | No |
| TS-SONG-05 | Other songs by the artist | The list is limited and expandable. | P3 | Yes |
| TS-SONG-06 | Heart and star state after reload and navigation | A signed-in user sees their favorite and review state on the song page. | P2 | Partial |
| TS-SONG-07 | Lyric file cannot be fetched | A lyric fetch failure does not break the page. | P3 | Yes |

**Implementation notes (2026-10-06).** Run: `npx playwright test tests/song tests/shared --repeat-each=3` against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`), Chromium. All 9 tests give the expected result in all 27 runs (one is a known-defect expected failure). No flaky results. `tests/auth` was run again after the shared changes (`SongPage`, fixtures): 12 passed.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-SONG-01 | `song-details.spec.ts` | Pass | Title, cover, counters and artist names compared with the `detail` and `artists` responses of the same page load (counters are shared). Heart and star clicks send no `favorite-toggle` or `add-review` request, proven with a request barrier, not a fixed wait |
| TS-SONG-02 | `shared/not-found.spec.ts` | Pass | Data-driven not-found test (analysis §6 #1): API 404 `Không tìm thấy bài hát`, UI "Song not found". TS-DISC-07, TS-DISC-12 and TS-NAV-02 become rows there later |
| TS-SONG-03 | `song-details.spec.ts` | Pass | Line count equals the time-tagged lines of the LRC file; Show More / Show Less read from the container class. "No lyrics" case uses song 933 (found by API probe). Expected text is "No lyrics available :(", not "no lyrics yet" (exploration S-1) |
| TS-SONG-04 | — | Not automated | MANUAL by the automation analysis (§5.1): tied to the real audio clock |
| TS-SONG-05 | `song-details.spec.ts` | Pass | Song 1: 30 rows equal to the related response (as a set), View More / Show Less change class and height. Boundaries: song 1129 (4 rows, no toggle), song 1349 (0 rows, no section) |
| TS-SONG-06 | `song-details.spec.ts` | Expected fail (known defect) | **Partial:** favorite half only; the star half needs a permanent review (D-WR). In-app navigation from `/favorites` shows a filled heart; after a hard reload it is empty while `/player` says favorited (F-5, known defect `US-011-AC-06`). The favorite is removed in `finally` |
| TS-SONG-07 | `song-details.spec.ts` | Pass | `@sit-controlled`. The LRC request is aborted in the browser: the page shows "No lyrics available :(", and title, artists and Play still work. Whether a message should be shown is still open (AC-08), so the current behavior is asserted with a `pending-decision` annotation |

# Download

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-DL-01 | Download saves a correctly named MP3 | Download works for guests and members, with a sanitized file name. | P3 | No |
| TS-DL-02 | Download failure shows an error | The user is told when a download fails. | P3 | No |

# Player

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-PLAY-01 | Start playback | Pressing Play starts the song for guests and members. | P1 | Yes |
| TS-PLAY-02 | Pause and resume | Pause stops playback and Play resumes it. | P1 | Yes |
| TS-PLAY-03 | Next, previous and queue refill | Queue navigation works and the queue never runs dry. | P1 | Yes |
| TS-PLAY-04 | Repeat modes | Repeat cycles through its states and each state behaves correctly. | P1 | Yes |
| TS-PLAY-05 | Shuffle | Shuffle reorders the rest of the queue and can be undone. | P1 | Yes |
| TS-PLAY-06 | Volume and mute | Volume defaults and mute behave as agreed. | P1 | Yes |
| TS-PLAY-07 | Next song starts when a song ends | Playback continues automatically. | P1 | Yes |
| TS-PLAY-08 | One click performs one action | Duplicated player controls (rendered 2 to 3 times) do not double-handle a click. | P1 | Yes |
| TS-PLAY-09 | Player title shortening and link | Long titles are shortened and the title opens the song. | P3 | No |
| TS-PLAY-10 | Audio file cannot be loaded | A missing or failing MP3 does not freeze the app. | P1 | No |

**Implementation notes (2026-10-12).** Run: `npx playwright test tests/player tests/review tests/journeys tests/recommendations --repeat-each=3` against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`), Chromium, parallel workers: 51/51 passed, no flaky result. The full suite (`npx playwright test`, 54 tests) also passed as a regression check of the shared changes (`PlayerBar`, `FavoritesPage`, `Sidebar`, `SongApi`, fixtures). Facts used by these tests (queue, refill point, repeat and shuffle states, control copies) were observed at runtime and are recorded in `docs/exploration/browser/player.md`. Every player test except TS-PLAY-01 (member) and TS-PLAY-08 runs as a guest: guests can play and record no stream. Member tests answer `POST /api/song/stream/{id}` in the browser (`listeningMember` fixture), so no permanent stream row is written.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-PLAY-01 | `playback.spec.ts` | Pass | Guest and member. Player bar title, artist and cover equal the `/player` response of the same load; the audio position advances; the Pause icon is shown |
| TS-PLAY-02 | `playback.spec.ts` | Pass | Pause: `audio.paused`, Play icon. Resume continues from the paused position and advances again. "Position stops" is read from `paused` and the held position, not a fixed wait |
| TS-PLAY-03 | `queue.spec.ts` | Pass | Next = first `next-batch` song, Previous = song 1 (asserted on the `/player` request). The refill `next-batch` is sent on the 8th Next after a fresh start (3 songs left counting the started one) and not before (request barrier). Both batches: 10 songs, all with a lyric URL. After the first batch, Next continues with the refill batch in its order |
| TS-PLAY-04 | `queue.spec.ts` | Pass | Three tests. Cycle Off → All → One → Off read from the `data-tooltip` and the active class. Repeat One: at the end the same MP3 restarts near 0 s, no other song loaded. Repeat All: `next-batch` is answered in the browser with one real catalog song, then an empty list, because a real queue is refilled before it can end; at the end of that song the queue restarts at song 1. End of song is reached by moving the audio element to its last second (seek-bar behavior is still open, AC-10) |
| TS-PLAY-05 | `queue.spec.ts` | Pass | Shuffle on: no song change. Four Nexts play four distinct queue songs in an order different from the batch (chance of a false failure 1 in 5040). Previous back to the start reaches song 1, so the current song stayed first. Shuffle off: Previous plays the song before the current one in the original order |
| TS-PLAY-07 | `playback.spec.ts` | Pass | Repeat off; the song moved to its last second; the next queue song is loaded, shown and playing |
| TS-PLAY-08 | `single-action.spec.ts` | Pass | Member. Precondition asserted: 3 control copies on `/song/1`, 2 on `/` (reached in-app from the sidebar). One Next click loads exactly one song (the next in the queue); one heart click sends exactly one `favorite-toggle` (200) and fills the heart. Favorites removed through the API in `finally`. A production-build comparison (TR-13) is not part of this run |
| TS-PLAY-09 | — | Not automated | P3, needs boundary titles (T-GAP). The shortening rule is used as `playerBarTitle()` by the tests above |
| TS-PLAY-10 | — | Deferred | Expected behavior not agreed (A-Q18), automation analysis §10.1 |

# Favorites

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-FAV-01 | Favorite and unfavorite update state and counts | A toggle changes the heart, the response and the like count by exactly one, consistently everywhere. | P2 | Yes |
| TS-FAV-02 | Rapid clicks while a request is in flight | Fast repeated clicks do not leave the state inconsistent. | P3 | No |
| TS-FAV-03 | Favorites page reflects a change at once | A toggle clears the 15-minute favorites cache. | P3 | Yes |
| TS-FAV-04 | Re-favoriting reuses the same record | Toggling repeatedly keeps one favorite record per user and song. | P3 | Yes |
| TS-FAV-05 | Favorite control exists only in the player bar | No favorite control appears elsewhere. | P3 | No |
| TS-FAV-06 | Favoriting a song that does not exist | The API refuses an unknown song id. | P3 | No |
| TS-FAV-07 | Favorites list and featured artist line | The playlist lists the user's favorites with a correct summary line. | P3 | No |
| TS-FAV-08 | Empty favorites | A user with no favorites sees the empty message. | P3 | No |
| TS-FAV-09 | Play All | The playlist can be played as a queue. | P3 | No |
| TS-FAV-10 | Reorder is client-only | Drag reordering changes display and queue but is not saved. | P3 | No |
| TS-FAV-11 | Show more and playlist download | Long lists collapse; the playlist downloads song by song. | P3 | No |

**Implementation notes (2026-10-13).** Same run as Discovery. Each test uses its own song (1129, 2179, 1349) so the shared like-count deltas do not collide; every favorite is removed through the API in `finally`. Member playback answers the stream request in the browser.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-FAV-01 | `favorites/favorites.spec.ts` | Pass + expected fail (known defect) | Two tests. (1) Heart filled / cleared; responses exactly `{ message: "Đã thêm vào yêu thích", isFavorited: true }` and `{ "Đã bỏ yêu thích", false }`; `/player` `isFavorited` and `likes` +1 then back, never below 0. (2) Song-page count after favoriting: stays at its page-load value (known defect `US-015-AC-01`, F-6). The player bar shows no like count and neither message is displayed (`discovery.md` FV-1) |
| TS-FAV-03 | `favorites/favorites.spec.ts` | Pass | In-app only: first visit shows the empty playlist (cached); after favoriting from the player bar the playlist shows the song; after unfavoriting it is empty again, with no wait for the 15-minute cache |
| TS-FAV-04 | `favorites/favorites.spec.ts` | Pass | `@api`. On, off, on, off: states alternate and `likes` is +1, 0, +1, 0 against the start value |

# Rating and Review

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-REV-01 | Rating form for a user who has not reviewed | The form only allows a submit once a star is chosen. | P1 | Yes |
| TS-REV-02 | Submitting a review | A review is saved and shown at once. | P1 | Partial |
| TS-REV-03 | Submitting without a comment | An empty comment gets the agreed placeholder. | P3 | No |
| TS-REV-04 | Rated state for a user who already reviewed | The UI does not offer a second review. | P1 | Partial |
| TS-REV-05 | Review list format and order | Reviews show the agreed fields, newest first, with one date format. | P3 | No |
| TS-REV-06 | Submit failure is reported | The user learns that the review was not saved. | P3 | No |
| TS-REV-07 | Server refuses a second review | Uniqueness is enforced by the server, not only by the UI. | P1 | No |
| TS-REV-08 | Server enforces the rating range | Only ratings 1 to 5 are stored. | P1 | No |
| TS-REV-09 | Rating modal with no reviews and closing | Record and check the open modal behaviors once agreed. | P3 | No |

**Implementation notes (2026-10-12).** Same run as Player. Reviews are permanent (TR-01), so nothing is submitted to the server: the submit and the "already reviewed" flag are answered in the browser (`src/support/controlled-responses.ts`), and each test records a `controlled-response` annotation. Every test is a fresh member who plays song 1 and opens the modal from the player bar (`RatingModal` component).

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-REV-01 | `rating.spec.ts` | Pass | Heading `Đánh Giá và Bình luận về "<title>"`, 5 empty stars, empty comment, submit disabled; 1 star enables submit; 5 stars fills all five. No `add-review` request (request barrier) |
| TS-REV-02 | `rating.spec.ts` | Pass | **Partial:** UI half. `add-review` answered with the real body `{"message":"Đánh giá thành công!"}`. Request body is exactly `{ rating: 4, comment, user: <username> }`; the review is first in the list with author, comment and 4 stars; the form is gone; the rate button gets the `rated` state. Persistence in the API list waits for D-WR. **Findings (P-6, P-7 in `player.md`):** the modal never displays `Đánh giá thành công!`, and the increased review count is kept in player state only (no screen shows it), so "count +1" is not asserted |
| TS-REV-04 | `rating.spec.ts` | Pass | **Partial:** the real `/player` response is served with `isReviewed: true`. Rate button has the `rated` state; the modal shows the review list and no stars, comment or submit. The real flag after a real review waits for D-WR |
| TS-REV-07, TS-REV-08 | — | Deferred | Permanent reviews (D-WR) and the status code decision (A-Q15), automation analysis §10.1 |

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
| TS-REC-12 | No behavior without interaction | Browsing alone sends no behavior. | P1 | Yes |
| TS-REC-13 | Rating, review and search after consent | Rating, review and search keyword tracking send only what is agreed. | P1 | No |
| TS-REC-14 | Only approved data is sent | Detect any sensitive or unapproved data sent to the service. | P1 | No |
| TS-REC-15 | Tracker configuration matches the approved snapshot | Detect remote changes to tracking rules, display configuration or the loader. | P1 | No |
| TS-REC-16 | Real recommendation service end to end | The real service is reachable, keeps its contract and works with PSMusic. | P2 | No |

**Implementation notes (2026-10-12).** Run in the same repeated run as Player (3/3 passed). Mode B: the test opts in to the live tracker (`test.use({ recommendationTracker: 'live' })`, tag `@sit-privacy`); every other test keeps it blocked.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-REC-12 | `tracking.spec.ts` | Pass | Guest with consent stored as granted before the SPA boots. Home, song 1, category 10, Genres and Charts are opened and scrolled; each page must render recommendation cards first, so silence is not an outage. No `POST /event` is sent. **Positive control:** a song-card Play on `/genres` then produces an event, which proves the capture works. Preflight skips the test as "external unavailable" if the tracker does not load its rules within 30 s. **Fix during the run (2026-10-13):** the first run against `https://localhost:5173` failed on Home with no cards: on the first load of a fresh browser the tracker sends no `/recommendation` (`recommendations.md` R-9.5). The preflight now also waits for `recsys_anon_id`; then 4/4 passed. On 2026-10-13 it ran out of the 30 s test budget once in a full parallel run (seven third-party page loads); the test now has a documented 120 s budget, waits unchanged |
| TS-REC-09, TS-REC-10 | — | Blocked | **New finding (2026-10-12, `recommendations.md` §9):** the tracker no longer shows its consent banner on a first visit, so the precondition "banner visible, no choice made" and the Decline click cannot be reached. Without a stored choice, nothing is sent (no `/recommendation`, no `/event`). Needs confirmation of the intended consent flow before these tests are written |
| TS-REC-13, TS-REC-14, TS-REC-15 | — | Not automated | Not in this round: REC-13 needs D-WR and A-Q3, REC-14 the allowlist approval (A-Q2), REC-15 an approved configuration snapshot (the live configuration has changed since 2026-09-30, see §9) |

# Cross-cutting API Behavior

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-API-01 | Paged list shape | Every paged endpoint uses the agreed shape. | P3 | No |
| TS-API-02 | Invalid paging values | Out-of-range paging values do not cause server errors. | P3 | No |

# Journeys

| Test Case ID | Name | Scenario | Priority | Implemented |
| ------------ | ---- | -------- | -------- | ----------- |
| TS-E2E-01 | Guest discovers and plays a song | A first-time visitor can find and play music. | P1 | Yes |
| TS-E2E-02 | Member listens, favorites and logs out | The main member journey works end to end. | P1 | Yes |

**Implementation notes (2026-10-12).** Same run as Player.

| Test Case ID | Spec | Result | Notes |
| ------------ | ---- | ------ | ----- |
| TS-E2E-01 | `journeys/journeys.spec.ts` | Pass | `@smoke`. Guest: Home "Discover by Genre" → first genre tile → category page (waits on the genre name, R-SYNC) → first song → song page → Play: the player bar shows the song and the audio plays. Depends on the Home genre section, which needs plays in the last 7 days (popular data) |
| TS-E2E-02 | `journeys/journeys.spec.ts` | Pass | UI login → play song 1 → favorite from the player bar → Next → Favorites via the sidebar shows the song → Play All plays it (song change asserted on `/player`) → logout: session cookie removed, user menu gone. The landing page is not asserted (TS-AUTH-10, known defect US-004-AC-01). The Next step is needed because Play All only pauses when the playing song is already in the playlist (`player.md` P-8). Stream answered in the browser; favorite removed in `finally` |

---

## Overall Progress

| Metric           | Count |
| ---------------- | ----: |
| Total Test Cases | 117 |
| Implemented | 45 |
| Partial | 6 |
| Not Implemented | 66 |
| Progress | 41.0% |

Progress = (Implemented + 0.5 × Partial) / Total × 100

Recounted on 2026-10-13 from the status column of every table above. The previous totals (13 implemented) had not
counted Authorization and Gating (8) or TS-PLAY-06.

### By feature

| Feature | Total | Implemented | Partial | Not Implemented | Progress |
| ------- | ----: | ----------: | ------: | --------------: | -------: |
| Registration | 8 | 0 | 0 | 8 | 0.0% |
| Authentication and Session | 11 | 8 | 3 | 0 | 86.4% |
| Authorization and Gating | 8 | 8 | 0 | 0 | 100.0% |
| Discovery | 12 | 5 | 0 | 7 | 41.7% |
| Search | 9 | 4 | 0 | 5 | 44.4% |
| Song Details | 7 | 5 | 1 | 1 | 78.6% |
| Download | 2 | 0 | 0 | 2 | 0.0% |
| Player | 10 | 8 | 0 | 2 | 80.0% |
| Favorites | 11 | 3 | 0 | 8 | 27.3% |
| Rating and Review | 9 | 1 | 2 | 6 | 22.2% |
| Listening Statistics | 4 | 0 | 0 | 4 | 0.0% |
| Language and Theme | 4 | 0 | 0 | 4 | 0.0% |
| Navigation | 2 | 0 | 0 | 2 | 0.0% |
| Recommendations | 16 | 1 | 0 | 15 | 6.3% |
| Cross-cutting API Behavior | 2 | 0 | 0 | 2 | 0.0% |
| Journeys | 2 | 2 | 0 | 0 | 100.0% |
| **Total** | **117** | **45** | **6** | **66** | **41.0%** |

### P1 coverage

Every P1 scenario classified AUTOMATE is now implemented (fully or partly) except five Recommendations privacy
scenarios: TS-REC-09 and TS-REC-10 are blocked by the consent-banner finding; TS-REC-13, 14 and 15 wait for decisions
or data. The three P1 scenarios deferred by the automation analysis (TS-PLAY-10, TS-REV-07, TS-REV-08) stay deferred.
Of the areas without any P1 scenario, Search, Favorites and Discovery now have their most important scenarios
automated (2026-10-13): Search TS-SRCH-01, 03, 05, 08 (all P2); Favorites TS-FAV-01 (P2), 03, 04; Discovery
TS-DISC-07 and 12 (both P2 not-found scenarios), 01, 08, 09. Still open there: TS-SRCH-02, 04, 06, 07, the playlist
scenarios TS-FAV-07 to 11, and the remaining Discovery pages (Genres, category paging, artist page). Registration, Download, Listening Statistics,
Language and Theme, Navigation and Cross-cutting API are still **No**.

### Context

The total counts every defined scenario. Of the 117, `automation-analysis.md` §1.1 marks 99 as automation candidates (83 full, 16 partial). The other 18 are manual (4), exploratory (5) or deferred (9). Those 18 stay **No** here because no automated test exists for them, not because they are expected to be automated now.
