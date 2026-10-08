# PSMusic - Test Scenarios

| Item | Value |
|---|---|
| Inputs | `docs/requirements/user-stories.md`, `docs/exploration/` (incl. `exploration-validation.md`), `test-strategy.md`, `levels/*.md`, `risk-register.md` |
| Status | Draft 1, 2026-10-01 |
| Feeds | Automation Analysis, Manual Test Design, Automated Test Design |

This document says **what** must be tested. It does not decide how a scenario is automated, whether it is automated at all, or which locators or steps are used.

## How to read a scenario

```
#### TS-AREA-nn  Title                                      [priority]
Level · Layers · Story/AC · Risk · Condition
Objective / Preconditions / Flow / Expected / Data / Rule / Dependencies / Notes
```

| Field | Meaning |
|---|---|
| **Level** | ISTQB level from `test-strategy.md` §4: **CI** component integration, **SYS** system, **SIT** system integration, **ACC** acceptance |
| **Layers** | Where the result can be observed: **UI**, **API**, **Integration** (traffic to or from an external system), **Data** (state re-read through the API; there is no database access), **E2E** (a multi-feature journey). These are validation opportunities, not automation decisions |
| **Priority** | Highest priority of the linked risks (`risk-register.md`). Scenarios that only trace to a story without a registered risk are **P3** |
| **Condition** | Test condition id. `TC-PRnn-n` comes from the risk register. `TC-USnnn-n` is a condition for a story with no registered risk |
| **Known defect** | The story is marked DEFECT. The scenario expects the **story**, not the current behavior (`exploration-validation.md` §9) |
| **Blocked** | The scenario cannot be executed until an entry condition is met (`test-strategy.md` §8.5) |
| **Write** | The scenario creates permanent data (reviews, streams). Approved write environment only (TR-01) |

Shared preconditions, not repeated in each scenario: language pinned to English (server messages and the rating modal stay Vietnamese); the recommendation tracker blocked in every non-SIT scenario (`levels/system.md` §4); clean browser storage; users created through the API with run-unique names.

---

## 1. Registration (FA-01)

### US-001 Register an account

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR22-1 | Required fields and password length are checked before any request | PR-22 | TS-REG-01, TS-REG-02 |
| TC-US001-1 | Valid registration creates an account without signing in | PR-22 | TS-REG-03, TS-REG-04 |
| TC-PR22-2 | Username and email are unique | PR-22 | TS-REG-05 |
| TC-PR11-1 | The password is never returned | PR-11 | TS-REG-06 |
| TC-PR22-3 | Username length limit | PR-22 | TS-REG-07 |
| TC-US001-2 | UI-only email deliverability check | PR-22 | TS-REG-08 |

#### TS-REG-01 Sign-up with an empty field is blocked [P3]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-001-AC-01 · **Risk** PR-22 · **Condition** TC-PR22-1
- **Objective:** Missing name, email or password is caught on the client.
- **Preconditions:** Guest on `/auth`, Create Account panel.
- **Flow:** Submit with each field empty in turn, then with all empty.
- **Expected:** "Please fill in all information" each time. No email check request and no register request.
- **Data:** None. **Rule:** All three fields required.
- **Dependencies:** None. **Notes:** An invalid email format is stopped by native browser validation (UF-09); not asserted as an app message.

#### TS-REG-02 Sign-up password length boundary [P3]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-001-AC-02 · **Risk** PR-22 · **Condition** TC-PR22-1
- **Objective:** Passwords shorter than 8 characters are refused on the client; 8 is accepted.
- **Preconditions:** Guest on the Create Account panel, valid username and email.
- **Flow:** Submit with a 7-character password, then with an 8-character password.
- **Expected:** 7: "Password must be at least 8 characters", no request. 8: the client check passes (the flow moves on to the email check).
- **Data:** Passwords of length 7 and 8. **Rule:** Minimum 8 characters.
- **Dependencies:** The 8-character case reaches the external email check: block or mock it (TS-REG-08). **Notes:** -

#### TS-REG-03 Registration through the API creates an account [P3]
- **Level** CI · **Layers** API, Data · **Story** US-001-AC-03 (server part), AC-07 · **Risk** PR-22 · **Condition** TC-US001-1
- **Objective:** A valid, unused username and email create an account that can sign in, with no session issued.
- **Preconditions:** Service key available.
- **Flow:** Register a new user → log in with the same credentials.
- **Expected:** Register succeeds with `Đăng ký thành công`, no token in the body, no `RefreshToken` cookie. Login then succeeds and returns `displayName` equal to the username.
- **Data:** Run-unique username and `@example.com` email; 8+ character password. **Rule:** Display name = username; registration does not sign in; the API accepts non-Gmail addresses (intended, SD-10).
- **Dependencies:** None. **Notes:** Creates a user that cannot be deleted (TR-01, prefix `psmusicqa_`).

#### TS-REG-04 UI sign-up success [P3] — Blocked
- **Level** SYS + SIT · **Layers** UI, Integration · **Story** US-001-AC-03, AC-07 · **Risk** PR-22, TR-06 · **Condition** TC-US001-1
- **Objective:** The UI completes sign-up when the email check accepts the address.
- **Preconditions:** A real Gmail mailbox, or an approved mock of the email check (A-Q17).
- **Flow:** Fill valid data → submit.
- **Expected:** Success message shown, form cleared, user not signed in. What the UI does next (panel switch, redirect) is open (AC-07).
- **Data:** Accepted email. **Rule:** UI accepts Gmail only after the external check.
- **Dependencies:** A-Q17. **Notes:** Blocked: synthetic addresses are rejected by the external check (`B:authentication.md` §3).

#### TS-REG-05 Duplicate username or email is refused [P3]
- **Level** CI (+ SYS) · **Layers** API, UI · **Story** US-001-AC-04, AC-05 · **Risk** PR-22 · **Condition** TC-PR22-2
- **Objective:** Uniqueness of username and email is enforced and the message is shown.
- **Preconditions:** An existing user.
- **Flow:** Register again with the same email (new username), then with the same username (new email).
- **Expected:** API 400 `Email đã tồn tại` and 400 `Tài khoản đã tồn tại`. The UI shows these messages when it reaches the register call.
- **Data:** One existing user. **Rule:** Username and email unique.
- **Dependencies:** The UI layer reaches the register call only after the email check (TS-REG-08). **Notes:** API layer observed (BR-A4).

#### TS-REG-06 No response ever contains the password [P2]
- **Level** CI · **Layers** API · **Story** US-001-AC-06, US-023-AC-01 · **Risk** PR-11 · **Condition** TC-PR11-1
- **Objective:** The password, or any hash of it, is never returned.
- **Preconditions:** A user with a known password.
- **Flow:** Inspect the responses of register, login, refresh, `auth/me` and `user/{id}`.
- **Expected:** No field contains the password or a password hash.
- **Data:** Password with a unique value so it can be searched for. **Rule:** Password stored hashed, never returned.
- **Dependencies:** None. **Notes:** Hashing itself cannot be observed without database access.

#### TS-REG-07 Username longer than the display-name limit [P3]
- **Level** CI · **Layers** API · **Story** US-001 rules · **Risk** PR-22 · **Condition** TC-PR22-3
- **Objective:** Find out how a username longer than 30 characters is handled.
- **Preconditions:** None.
- **Flow:** Register with 30 and 31 character usernames.
- **Expected:** 30 accepted. 31: **to be confirmed** (the story says "likely rejected"; status and message unknown).
- **Data:** Usernames of length 30 and 31. **Rule:** Display name limited to 30 characters.
- **Dependencies:** Clarification. **Notes:** Expected result open.

#### TS-REG-08 Email rejected by the external check stops sign-up [P3]
- **Level** SIT · **Layers** UI, Integration · **Story** US-001 rules · **Risk** PR-22 · **Condition** TC-US001-2
- **Objective:** An address the external check rejects never reaches the register call.
- **Preconditions:** Guest on Create Account; email check controlled (mock) per `levels/system-integration.md` §6.
- **Flow:** Submit valid data with an address the check marks as not deliverable.
- **Expected:** The checker's message is shown (observed "Email không tồn tại hoặc không thể gửi được"); no register request.
- **Data:** Mocked "not deliverable" response. **Rule:** UI accepts only addresses the external check accepts.
- **Dependencies:** Approval to mock (A-Q17). **Notes:** The real check is never called from automation (quota).

---

## 2. Authentication and session (FA-02)

### US-002 Log in

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR07-0 | Valid login creates a session | PR-07 | TS-AUTH-01 |
| TC-US002-1 | Client-side validation | - | TS-AUTH-02 |
| TC-US002-2 | Server login errors | PR-07 | TS-AUTH-03 |
| TC-US002-3 | Form usability | - | TS-AUTH-04 |

#### TS-AUTH-01 Valid login creates a session [P1]
- **Level** CI + SYS · **Layers** API, UI · **Story** US-002-AC-03 · **Risk** PR-07 · **Condition** TC-PR07-0
- **Objective:** Correct credentials sign the user in.
- **Preconditions:** Existing user; guest on `/auth`.
- **Flow:** Log in with the right username and password.
- **Expected:**
  - API: token plus user (`id`, `username`, `email`, `displayName`). `RefreshToken` cookie set: HttpOnly, Secure, SameSite=None, about 7 days.
  - UI: "Login successful", then `/` after about 1 second, with the user menu shown instead of Login.
- **Data:** API-created user. **Rule:** Access token 60 min, in memory only; refresh cookie about 7 days.
- **Dependencies:** None. **Notes:** The token must not appear in `localStorage`, `sessionStorage` or a readable cookie (`B:authentication.md` §1).

#### TS-AUTH-02 Login client validation [P3]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-002-AC-01, AC-02 · **Risk** - · **Condition** TC-US002-1
- **Objective:** Empty fields and short passwords are caught before any request.
- **Preconditions:** Guest on `/auth`.
- **Flow:** Submit empty username, then empty password, then a 7-character password, then an 8-character password.
- **Expected:** "Please fill in all information" for empty fields; "Password must be at least 8 characters" for 7 characters. No login request in these cases. 8 characters sends the request.
- **Data:** Any username. **Rule:** Both fields required; minimum 8 characters.
- **Dependencies:** None. **Notes:** The empty-password message was not captured in exploration (UF-08).

#### TS-AUTH-03 Unknown username and wrong password [P1]
- **Level** CI + SYS · **Layers** API, UI · **Story** US-002-AC-04, AC-05 · **Risk** PR-07 · **Condition** TC-US002-2
- **Objective:** Login failures return the agreed distinct messages.
- **Preconditions:** One existing user.
- **Flow:** Log in with an unknown username; log in with an existing username and a wrong password.
- **Expected:** 400 `Tài khoản không tồn tại` and 400 `Sai mật khẩu`, each shown inline. No cookie set.
- **Data:** Existing user + wrong password. **Rule:** Distinct messages are intended (SD-10).
- **Dependencies:** Known-password account. **Notes:** AC-05 is source only so far.

#### TS-AUTH-04 Password visibility toggle and panel switch [P3]
- **Level** SYS · **Layers** UI · **Story** US-002-AC-06, AC-07 · **Risk** - · **Condition** TC-US002-3
- **Objective:** Form helpers behave as agreed.
- **Preconditions:** Guest on `/auth`.
- **Flow:** Toggle the eye icon; enter data and trigger an error, then switch to Sign Up and back.
- **Expected:** The password becomes visible and hidden again. Switching panels clears fields, errors and messages.
- **Data:** None. **Rule:** -
- **Dependencies:** None. **Notes:** Both forms are always in the DOM (R-9).

### US-003 Stay signed in

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR07-1 | Reload restores the session | PR-07 | TS-AUTH-05 |
| TC-PR07-2 | No cookie means guest | PR-07 | TS-AUTH-06 |
| TC-PR07-3 | Expired token → one refresh + retry | PR-07 | TS-AUTH-07 |
| TC-PR07-4 | Failed refresh → clean logout | PR-07 | TS-AUTH-08 |
| TC-US003-1 | Refresh token re-issue | PR-07 | TS-AUTH-09 |

#### TS-AUTH-05 Reload restores the session [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-003-AC-01 · **Risk** PR-07 · **Condition** TC-PR07-1
- **Objective:** A signed-in user stays signed in after a full reload.
- **Preconditions:** Signed-in user with a valid refresh cookie.
- **Flow:** Reload a public page and a protected page (`/favorites`).
- **Expected:** The refresh call returns `isSuccess:true`, a token and the user. The UI shows the signed-in state. `/favorites` stays open (no redirect to `/auth`).
- **Data:** Signed-in user. **Rule:** Session restore through the refresh cookie.
- **Dependencies:** None. **Notes:** Refresh runs twice in the dev build (F-4); never count calls.

#### TS-AUTH-06 No refresh cookie means guest [P1]
- **Level** CI + SYS · **Layers** API, UI · **Story** US-003-AC-02, AC-03 · **Risk** PR-07 · **Condition** TC-PR07-2
- **Objective:** Without a cookie the app treats the user as a guest.
- **Preconditions:** No cookie.
- **Flow:** Call refresh; open `/` and `/favorites`.
- **Expected:** Refresh: **HTTP 200** with `isSuccess:false`. The UI shows Login. `/favorites` redirects to `/auth`.
- **Data:** None. **Rule:** Refresh failure uses 200 + `isSuccess:false`.
- **Dependencies:** None. **Notes:** -

#### TS-AUTH-07 Expired access token triggers one refresh and a retry [P1] — Blocked
- **Level** SYS · **Layers** UI, API · **Story** US-003-AC-04 · **Risk** PR-07, TR-09 · **Condition** TC-PR07-3
- **Objective:** An expired token is renewed silently.
- **Preconditions:** Short token lifetime environment; signed-in user whose access token has expired; valid refresh cookie.
- **Flow:** Trigger a protected request (open `/favorites` or toggle a favorite).
- **Expected:** First request 401 → exactly one refresh → the original request is retried and succeeds. The user sees no error.
- **Data:** Signed-in user. **Rule:** 401 → refresh → retry once.
- **Dependencies:** TR-09. **Notes:** Source only (`exploration-validation.md` §8).

#### TS-AUTH-08 Failed refresh logs the user out cleanly [P1] — Blocked
- **Level** SYS · **Layers** UI, API · **Story** US-003-AC-05 · **Risk** PR-07, TR-09 · **Condition** TC-PR07-4
- **Objective:** When the token cannot be renewed, the app logs out instead of staying half signed in.
- **Preconditions:** As TS-AUTH-07, but the refresh cookie is invalid or expired.
- **Flow:** Trigger a protected request.
- **Expected:** Refresh fails → user logged out, cached data cleared, app on `/`.
- **Data:** Signed-in user. **Rule:** -
- **Dependencies:** TR-09. **Notes:** -

#### TS-AUTH-09 Each refresh re-issues the refresh token [P1]
- **Level** CI · **Layers** API · **Story** US-003 rules · **Risk** PR-07 · **Condition** TC-US003-1
- **Objective:** Refresh re-issues the refresh token with a renewed lifetime.
- **Preconditions:** Signed-in user.
- **Flow:** Call refresh twice in sequence.
- **Expected:** Each call sets a `RefreshToken` cookie holding a refresh token for the same user, expiring about 7 days after that call and never earlier than the token it replaces; the next refresh accepts it. Whether the previous value still works is **to be confirmed** (U-2.4).
- **Data:** Signed-in user. **Rule:** Each successful refresh re-issues the refresh token with a renewed 7-day lifetime (clarified 2026-10-05, see below).
- **Dependencies:** Clarification on reuse. **Notes:** Two concurrent refreshes both succeeded at runtime; whether that is intended is part of the same question. **Clarification 2026-10-05:** a different token *value* per call is not required. The token has no unique id, so refreshes within the same second return an identical token (`browser/authentication.md` A-9); this was judged acceptable because both are equally valid and expire together. Rotation has no security effect while earlier tokens are never revoked (A-10), so the real risk is tracked under U-2.4.

### US-004 Log out

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR09-1 | Logout from a protected page lands on `/` | PR-09 | TS-AUTH-10 |
| TC-PR09-2 | Logout from a public page lands on `/` | PR-09 | TS-AUTH-10 |
| TC-PR09-3/4 | Session fully cleared | PR-09 | TS-AUTH-11 |

#### TS-AUTH-10 Logout lands on `/` from every page [P2] — Known defect
- **Level** SYS · **Layers** UI · **Story** US-004-AC-01 · **Risk** PR-09 · **Condition** TC-PR09-1, TC-PR09-2
- **Objective:** Logout always ends on Home with the Login button.
- **Preconditions:** Signed-in user.
- **Flow:** Log out from `/favorites`; log out from a public page (for example `/song/1`).
- **Expected:** Both land on `/` and show Login. Cached data cleared.
- **Data:** Signed-in user. **Rule:** SD-3.
- **Dependencies:** None. **Notes:** Today logout from `/favorites` lands on `/auth` (DEFECT). The public-page case has not been observed yet.

#### TS-AUTH-11 Logout clears the session [P2]
- **Level** CI + SYS · **Layers** API, UI · **Story** US-004-AC-02, AC-03 · **Risk** PR-09 · **Condition** TC-PR09-3, TC-PR09-4
- **Objective:** After logout the browser has no session left.
- **Preconditions:** Signed-in user.
- **Flow:** Log out → reload.
- **Expected:** Logout returns `Đăng xuất thành công` and deletes the refresh cookie. After reload the user is still a guest.
- **Data:** Signed-in user. **Rule:** Logout does not invalidate an access token already issued (agreed rule, not tested as a defect).
- **Dependencies:** None. **Notes:** -

---

## 3. Authorization and gating (FA-03)

### Technical behaviors: API access control

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR10-3 | Service key and bearer enforcement | PR-10 | TS-AUTHZ-01, TS-AUTHZ-02 |

#### TS-AUTHZ-01 Requests without a valid service key are refused [P2]
- **Level** CI · **Layers** API · **Story** "Technical behaviors" · **Risk** PR-10 · **Condition** TC-PR10-3
- **Objective:** The service key is required on every `/api/*` call.
- **Preconditions:** None.
- **Flow:** Call a public endpoint and a protected endpoint without the key, then with a wrong key.
- **Expected:** 401 `{"message":"Unauthorized Access"}` in every case.
- **Data:** None. **Rule:** `X-App-Service-Key` required.
- **Dependencies:** None. **Notes:** The key is visible in the browser; this scenario checks enforcement, not secrecy.

#### TS-AUTHZ-02 Bearer token enforcement [P2]
- **Level** CI · **Layers** API · **Story** "Technical behaviors", US-014 rules, US-023-AC-02 · **Risk** PR-10 · **Condition** TC-PR10-3
- **Objective:** Protected endpoints need a valid token; public ones treat a bad token as a guest.
- **Preconditions:** Service key present.
- **Flow:** Call protected endpoints (`song/favorites`, `favorite-toggle`, `stream`, `add-review`, `stats/heartbeat`, `auth/me`) without a token and with an invalid one; call a public endpoint with an invalid token.
- **Expected:** Protected: 401 with an empty body. Public with an invalid token: 200, served as a guest (user flags false).
- **Data:** None. **Rule:** As stated in "Technical behaviors".
- **Dependencies:** None. **Notes:** -

### US-014 Sign-in prompt for members-only actions

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR10-1 | Guest gets the sign-in modal and no API call | PR-10 | TS-AUTHZ-03, TS-AUTHZ-04 |
| TC-PR10-4 | Modal actions and scroll lock | PR-10 | TS-AUTHZ-05 |

#### TS-AUTHZ-03 Guest clicking Favorites in the sidebar [P2]
- **Level** SYS · **Layers** UI · **Story** US-014-AC-01 · **Risk** PR-10 · **Condition** TC-PR10-1
- **Objective:** The sidebar entry gates guests.
- **Preconditions:** Guest on any page.
- **Flow:** Click Favorites in the sidebar.
- **Expected:** "Start Listening" modal; the URL does not change.
- **Data:** None. **Rule:** Favorites page needs login.
- **Dependencies:** None. **Notes:** Observed (UF-04).

#### TS-AUTHZ-04 Guest clicking heart or rate in the player bar [P2]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-014-AC-02, AC-03, US-017-AC-07 · **Risk** PR-10 · **Condition** TC-PR10-1
- **Objective:** Player-bar member actions gate guests without calling the API.
- **Preconditions:** Guest playing a song.
- **Flow:** Click the heart; close the modal; click rate; choose "Login Now".
- **Expected:** The modal opens each time. No `favorite-toggle` and no review request. "Login Now" opens `/auth` and pauses the music.
- **Data:** Song 1. **Rule:** Favorite and rating need login.
- **Dependencies:** None. **Notes:** Not yet run as a guest (U-3.2). Pausing is from source (`R:repository-unknowns.md` §6).

#### TS-AUTHZ-05 Closing the sign-in modal [P2]
- **Level** SYS · **Layers** UI · **Story** US-014-AC-04, AC-05 · **Risk** PR-10 · **Condition** TC-PR10-4
- **Objective:** All close options work and page scrolling is restored.
- **Preconditions:** Modal open as a guest.
- **Flow:** Close with "Maybe Later", then with X, then by clicking the overlay.
- **Expected:** The modal closes each time. Page scroll is locked while it is open and restored after closing.
- **Data:** None. **Rule:** -
- **Dependencies:** None. **Notes:** -

### US-016-AC-07 / US-020-AC-04 Protected routes

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR10-2 | Protected routes redirect guests | PR-10 | TS-AUTHZ-06 |

#### TS-AUTHZ-06 Protected routes for guests and members [P2]
- **Level** SYS · **Layers** UI · **Story** US-016-AC-07, US-020-AC-04, SD-5 · **Risk** PR-10 · **Condition** TC-PR10-2
- **Objective:** `/favorites` and `/recent` are for members only.
- **Preconditions:** Guest; then a signed-in user.
- **Flow:** Open both URLs directly as a guest, then as a member.
- **Expected:** Guest: both redirect to `/auth` once the refresh check has finished. Member: Favorite Playlist page; `/recent` shows only the placeholder "Nghe Gần Đây".
- **Data:** Signed-in user. **Rule:** SD-5.
- **Dependencies:** None. **Notes:** -

### US-023 View my profile (PROVISIONAL)

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR01-1 | Own profile readable, without password | PR-01 | TS-PROF-01 |
| TC-PR01-3 | No token → 401 | PR-01 | TS-PROF-01 |
| TC-PR01-2 | Another user's profile refused | PR-01 | TS-PROF-02 |

#### TS-PROF-01 A user reads their own profile [P1]
- **Level** CI · **Layers** API · **Story** US-023-AC-01, AC-02 · **Risk** PR-01 · **Condition** TC-PR01-1, TC-PR01-3
- **Objective:** A signed-in user gets their own details; a request without a valid token is refused.
- **Preconditions:** Signed-in user.
- **Flow:** Request the profile with the user's token, then without a token.
- **Expected:** With the token: at least username, display name and email, all matching the user; no password. Without: 401.
- **Data:** API-created user. **Rule:** -
- **Dependencies:** Profile endpoint decision (A-Q16). **Notes:** Assumed `GET /api/auth/me` (code) until decided; README says `/api/user/profile`.

#### TS-PROF-02 A user cannot read another user's profile [P1] — Known defect
- **Level** SYS · **Layers** API · **Story** US-023-AC-03, SD-8 · **Risk** PR-01 · **Condition** TC-PR01-2
- **Objective:** Personal data of other users is not exposed.
- **Preconditions:** Users A and B; A signed in.
- **Flow:** A requests B's details by id through every endpoint that takes a user id (today `GET /api/user/{id}`).
- **Expected:** Refused (status to be decided). No field of B, in particular the email, is returned.
- **Data:** Two API-created users. **Rule:** SD-8.
- **Dependencies:** None. **Notes:** Source-only defect: any user's data is returned. Exploratory follow-up: look for other endpoints that return another user's data (`risk-register.md` §5).

---

## 4. Discovery (FA-04)

### US-005 Home page

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR21-1 | Section limits and links | PR-21 | TS-DISC-01 |
| TC-PR21-2 | Ordering by 7-day plays | PR-21, PR-15 | TS-DISC-02 |
| TC-PR21-3 | Empty states | PR-21 | TS-DISC-03 |

#### TS-DISC-01 Home sections, limits and links [P3]
- **Level** SYS · **Layers** UI · **Story** US-005-AC-01, AC-02, AC-04 · **Risk** PR-21 · **Condition** TC-PR21-1
- **Objective:** Home shows the agreed sections and navigates correctly.
- **Preconditions:** Environment with popular data.
- **Flow:** Open `/`; check both sections; follow See all of each; open a genre card and an artist card.
- **Expected:**
  - At most 8 genre cards and 10 trending artists.
  - See all goes to `/genres` and `/charts`.
  - A genre card opens `/category/{id}` and an artist card `/artist/{id}`, each with the matching name.
- **Data:** Catalog. **Rule:** -
- **Dependencies:** Popular data exists (TR-08). **Notes:** "Recommends for you" is US-022.

#### TS-DISC-02 Popular genres and artists follow 7-day plays [P2]
- **Level** SYS · **Layers** API, Data · **Story** US-005-AC-05, US-021-AC-03 · **Risk** PR-21, PR-15 · **Condition** TC-PR21-2
- **Objective:** Popularity lists are ordered by plays in the last 7 days and exclude items with none.
- **Preconditions:** Approved write environment where the streams of the last 7 days are known or seeded.
- **Flow:** Read popular genres and artists; compare with the known stream counts.
- **Expected:** Descending by 7-day plays; items with no plays in the window are absent.
- **Data:** Seeded streams. **Rule:** 7-day window.
- **Dependencies:** TR-01, TR-08. **Notes:** Without seeded data only the structure can be checked. Caches can delay changes by up to 15 minutes on the client and 10 minutes on the server (US-021-AC-04).

#### TS-DISC-03 Discovery empty states [P3]
- **Level** SYS · **Layers** UI · **Story** US-005-AC-03, US-006-AC-02, US-008-AC-02 · **Risk** PR-21 · **Condition** TC-PR21-3
- **Objective:** Pages show an empty-state message instead of breaking when there is no data or the API fails.
- **Preconditions:** Popular data unavailable (controlled empty or failing responses for the popular endpoints).
- **Flow:** Open Home, Genres and Charts.
- **Expected:** Each page shows its empty-state message. A chart category with no songs shows "no data".
- **Data:** Empty and failing responses. **Rule:** -
- **Dependencies:** A way to produce no data: response control in the browser or an empty environment. **Notes:** Exact messages to be recorded during design.

### US-006 Explore all genres

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US006-1 | Genre sections | PR-21 | TS-DISC-04 |

#### TS-DISC-04 Genres page sections [P3]
- **Level** SYS · **Layers** UI · **Story** US-006-AC-01, AC-04, SD-6 · **Risk** PR-21 · **Condition** TC-US006-1
- **Objective:** `/genres` shows genre sections with the right names and songs.
- **Preconditions:** Popular data.
- **Flow:** Open `/genres`; follow See all of one section.
- **Expected:** Up to 6 sections, each containing the correct genre name and up to 10 songs. See all opens `/category/{id}` of that genre.
- **Data:** Categories 1, 2, 10, 26. **Rule:** Title wording does not matter (SD-6).
- **Dependencies:** None. **Notes:** Translated genre names are covered by TS-L10N-03.

### US-007 Genre (category) page

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US007-1 | Content and paging | PR-21 | TS-DISC-05 |
| TC-US007-2 | Ordering rules | PR-21 | TS-DISC-06 |
| TC-PR14-1/2 | Unknown category | PR-14 | TS-DISC-07 |

#### TS-DISC-05 Category page content and paging [P3]
- **Level** SYS · **Layers** UI, API · **Story** US-007-AC-01, AC-02 · **Risk** PR-21 · **Condition** TC-US007-1
- **Objective:** The category page shows its sections with working paging.
- **Preconditions:** Category 1 (Pop: 13 artist pages, 65 song pages observed).
- **Flow:** Open `/category/1`; move to the next, previous and last page in both sections.
- **Expected:**
  - Genre name shown; Featured Artists 10 per page; Songs 12 per page.
  - Previous is disabled on page 1.
  - Each page change loads that page's items; the URL stays `/category/1`.
- **Data:** Category 1. **Rule:** -
- **Dependencies:** None. **Notes:** Boundaries: first and last page.

#### TS-DISC-06 Category ordering and artist placement [P3]
- **Level** SYS · **Layers** API, Data · **Story** US-007-AC-03, AC-04 · **Risk** PR-21 · **Condition** TC-US007-2
- **Objective:** Songs are ordered by total streams; an artist appears under the genre holding most of their songs.
- **Preconditions:** Known stream totals (approved environment) for the order; known song-to-genre data for placement.
- **Flow:** Read the songs and featured artists of a category.
- **Expected:** Songs descending by total streams. Each featured artist's main genre is this category.
- **Data:** Seeded or known data. **Rule:** Ordering by total streams; artist under the majority genre.
- **Dependencies:** TR-01, TR-08; no database access makes placement hard to prove. **Notes:** Placement may only be checkable on selected artists.

#### TS-DISC-07 Unknown category [P2] — Known defect
- **Level** CI + SYS · **Layers** API, UI · **Story** US-007-AC-05, SD-4 · **Risk** PR-14 · **Condition** TC-PR14-1, TC-PR14-2
- **Objective:** An unknown category id is reported as not found.
- **Preconditions:** None.
- **Flow:** Request category `99999999` through the API; open `/category/99999999`.
- **Expected:** API 404. The page shows a visible not-found message.
- **Data:** Id `99999999`. **Rule:** SD-4.
- **Dependencies:** None. **Notes:** Today: 204 and a blank page.

### US-008 Top charts

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US008-1 | Chart structure and order | PR-21 | TS-DISC-08 |
| TC-US008-2 | Chart links | - | TS-DISC-09 |

#### TS-DISC-08 Charts structure [P3]
- **Level** SYS · **Layers** UI · **Story** US-008-AC-01, SD-2 · **Risk** PR-21 · **Condition** TC-US008-1
- **Objective:** Charts show ranked lists in the agreed category order, without artists or favorites.
- **Preconditions:** Popular data.
- **Flow:** Open `/charts`.
- **Expected:**
  - Up to 10 charts, each ranked 1 to 10; categories 10 and 26 first.
  - No popular-artists block and no favorite control.
- **Data:** Catalog. **Rule:** SD-2.
- **Dependencies:** None. **Notes:** Wait for chart content, not the URL: the previous page's content stays for about 1-2 s (UF-02).

#### TS-DISC-09 Chart links [P3]
- **Level** SYS · **Layers** UI · **Story** US-008-AC-03 · **Risk** - · **Condition** TC-US008-2
- **Objective:** Chart entries navigate correctly.
- **Preconditions:** `/charts` loaded.
- **Flow:** Click a song; go back; click an artist.
- **Expected:** `/song/{id}` with the same title; `/artist/{id}` with the same name.
- **Data:** Catalog. **Rule:** -
- **Dependencies:** None. **Notes:** Chart song titles are buttons without `href`; the id is known only from the resulting URL.

### US-009 Artist page

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US009-1 | Content, paging, play | - | TS-DISC-10 |
| TC-US009-2 | Favorite state for members | - | TS-DISC-11 |
| TC-PR14-1/2 | Unknown artist | PR-14 | TS-DISC-12 |

#### TS-DISC-10 Artist page content and Play [P3]
- **Level** SYS · **Layers** UI · **Story** US-009-AC-01, AC-02, AC-04 · **Risk** - · **Condition** TC-US009-1
- **Objective:** The artist page shows its sections and Play starts the artist's songs.
- **Preconditions:** Artist 1.
- **Flow:** Open `/artist/1`; page through Main Songs; press Play, then Pause.
- **Expected:**
  - Name, Main Songs and Collaboration Songs (10 per page), Related Artists (4 at a time).
  - Play starts one of the artist's songs and the button toggles to Pause.
- **Data:** Artist 1. **Rule:** Related artists share the main genre; none if the artist has no main genre.
- **Dependencies:** Audio. **Notes:** An artist with no main genre has not been identified (open data); order of main and collaboration songs is not defined (AC-06), so it is not asserted.

#### TS-DISC-11 Signed-in user sees favorite state in artist lists [P3]
- **Level** SYS · **Layers** UI, API · **Story** US-009-AC-03 · **Risk** - · **Condition** TC-US009-2
- **Objective:** Song lists reflect the user's favorites.
- **Preconditions:** Signed-in user who favorited a song of artist 1.
- **Flow:** Open `/artist/1` after in-app navigation.
- **Expected:** That song shows as favorited; the others do not.
- **Data:** Favorite set up through the API. **Rule:** -
- **Dependencies:** None. **Notes:** On a hard reload the same race as F-5 may apply; record the result.

#### TS-DISC-12 Unknown artist [P2] — Known defect
- **Level** CI + SYS · **Layers** API, UI · **Story** US-009-AC-05, SD-4 · **Risk** PR-14 · **Condition** TC-PR14-1, TC-PR14-2
- **Objective:** An unknown artist id is reported as not found.
- **Preconditions:** None.
- **Flow:** Request artist `99999999` through the API; open `/artist/99999999`.
- **Expected:** API 404. The page shows a visible not-found message.
- **Data:** Id `99999999`. **Rule:** SD-4.
- **Dependencies:** None. **Notes:** Today: 204 and only a Play button.

---

## 5. Search (FA-05)

### US-010 Search for songs and artists

All scenarios except TS-SRCH-07 and TS-SRCH-08 can be designed against controlled search responses in the browser. Real results are available since the Elasticsearch key was renewed on 2026-10-08; the indices are filled from PostgreSQL at every API startup, so real-result scenarios use titles that exist before the API starts (TR-05).

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR16-1/2 | Suggestion threshold, debounce and states | PR-16 | TS-SRCH-01, TS-SRCH-02 |
| TC-PR16-3 | Navigation from search | PR-16 | TS-SRCH-03 |
| TC-PR16-4/5/6 | Results page | PR-16 | TS-SRCH-04, TS-SRCH-05 |
| TC-PR16-7 | Clear | PR-16 | TS-SRCH-06 |
| TC-PR16-8 | Size clamp | PR-16 | TS-SRCH-07 |
| TC-PR16-real | Real results | PR-16, TR-05 | TS-SRCH-08 |
| TC-PR26-1 | Missing keyword | PR-26 | TS-SRCH-09 |

#### TS-SRCH-01 Suggestion threshold and debounce [P2]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-010-AC-01, AC-02 · **Risk** PR-16 · **Condition** TC-PR16-1
- **Objective:** Suggestions are requested only for 2+ characters after the typing pause.
- **Preconditions:** Any page with the header search.
- **Flow:** Type 1 character; then 2 characters; then type several characters quickly.
- **Expected:** 1 character: no request. 2 characters: one request after the pause of about 300 ms. Fast typing: one request for the final text, not one per keystroke.
- **Data:** Short keywords. **Rule:** Minimum 2 characters; 300 ms debounce.
- **Dependencies:** None. **Notes:** -

#### TS-SRCH-02 Suggestion box states [P2]
- **Level** SYS · **Layers** UI · **Story** US-010-AC-02 · **Risk** PR-16 · **Condition** TC-PR16-2
- **Objective:** The suggestion box shows loading, results and no-result states.
- **Preconditions:** Controlled responses: slow, with results, empty.
- **Flow:** Type a 2+ character keyword for each response.
- **Expected:** A loading state while waiting; artists listed before songs; "No suitable suggestions" for an empty result.
- **Data:** Recorded or controlled results. **Rule:** Artists before songs.
- **Dependencies:** None. **Notes:** The empty state was never seen at runtime (`exploration-validation.md` §6); recheck after the key renewal.

#### TS-SRCH-03 Navigation from suggestions and Enter [P2]
- **Level** SYS · **Layers** UI · **Story** US-010-AC-03, AC-04 · **Risk** PR-16 · **Condition** TC-PR16-3
- **Objective:** Search leads to the right page.
- **Preconditions:** Suggestions available.
- **Flow:** Click an artist suggestion; click a song suggestion; type a keyword with surrounding spaces and press Enter; press Enter with only spaces.
- **Expected:** `/artist/{id}`; `/song/{id}`; `/search?q=<trimmed keyword>`. A blank query does not navigate.
- **Data:** Keyword with spaces. **Rule:** Query trimmed; blank query ignored.
- **Dependencies:** None. **Notes:** -

#### TS-SRCH-04 Results page tabs and limits [P2]
- **Level** SYS · **Layers** UI · **Story** US-010-AC-05, AC-08 · **Risk** PR-16 · **Condition** TC-PR16-4, TC-PR16-5
- **Objective:** The results page groups and limits results correctly.
- **Preconditions:** Results with more than 10 songs and more than 4 artists, one with an exact (case-insensitive) name match.
- **Flow:** Open the results; switch between All, Songs and Artists; page through Songs.
- **Expected:**
  - All: up to 10 songs and 4 artists.
  - Songs: paginated.
  - Artists: listed.
  - The exact match shown as "Top result".
- **Data:** Controlled results. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-SRCH-05 No results [P2]
- **Level** SYS · **Layers** UI · **Story** US-010-AC-06 · **Risk** PR-16 · **Condition** TC-PR16-6
- **Objective:** An empty result is clearly reported.
- **Preconditions:** None.
- **Flow:** Search a keyword with no match.
- **Expected:** `No results found for "<keyword>"`.
- **Data:** Nonsense keyword. **Rule:** -
- **Dependencies:** None. **Notes:** This message is the only behavior visible today, because every search is empty.

#### TS-SRCH-06 Clear the search [P2]
- **Level** SYS · **Layers** UI · **Story** US-010-AC-07 · **Risk** PR-16 · **Condition** TC-PR16-7
- **Objective:** The X button resets the search.
- **Preconditions:** Text typed and suggestions shown.
- **Flow:** Click X.
- **Expected:** The query and suggestions are cleared.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-SRCH-07 Page size is raised to 10 [P2]
- **Level** CI · **Layers** API · **Story** US-010-AC-09 · **Risk** PR-16 · **Condition** TC-PR16-8
- **Objective:** The server raises a size below 10 to 10.
- **Preconditions:** Index with more than 10 matches for a keyword.
- **Flow:** Search with sizes 5, 9 and 10.
- **Expected:** At most 10 results on the first page in all three cases.
- **Data:** Keyword with many matches. **Rule:** Minimum size 10.
- **Dependencies:** TR-05 (needs real results; keyword `Em` has more than 10 matches, `B:search.md` §5). **Notes:** The header requests size 5 (CNF-08).

#### TS-SRCH-08 Real search finds indexed songs and artists [P2]
- **Level** SIT · **Layers** API, UI, Integration · **Story** US-010, SD-1 · **Risk** PR-16, TR-05 · **Condition** TC-PR16-real
- **Objective:** Search works against the real index.
- **Preconditions:** API started after the song and artist exist in PostgreSQL (indexed by `ElasticSeeder`); a preflight search for a known title succeeds.
- **Flow:** Search known song and artist names (exact, different case, partial).
- **Expected:** The known items appear; exact name → Top result.
- **Data:** `Binz` (artist 27), `Chờ Anh Nhé` (song 1), `Dương Domic` (artist 13) (`B:search.md` §5). **Rule:** Only indexed songs and artists are searchable; the index is refilled at API startup.
- **Dependencies:** TR-05. **Notes:** Fuzzy matching and diacritics are not asserted (AC-10 open).

#### TS-SRCH-09 Missing or empty keyword [P3]
- **Level** CI · **Layers** API · **Story** "Technical behaviors" · **Risk** PR-26 · **Condition** TC-PR26-1
- **Objective:** The search API handles a missing keyword without a server error.
- **Preconditions:** None.
- **Flow:** Call search without `keyword` and with an empty `keyword`.
- **Expected:** No 500. The exact response is **to be agreed**.
- **Data:** -. **Rule:** -
- **Dependencies:** Clarification. **Notes:** No validation exists in source (UNK-44).

---

## 6. Song details, download and player (FA-06, FA-07, FA-08)

### US-011 Song details

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US011-1 | Song page content | PR-08 | TS-SONG-01 |
| TC-PR14-2 | Unknown song | PR-14 | TS-SONG-02 |
| TC-US011-2 | Lyrics | - | TS-SONG-03, TS-SONG-04 |
| TC-US011-3 | Other songs list | - | TS-SONG-05 |
| TC-PR12-1/2 | User state icons | PR-12 | TS-SONG-06 |
| TC-PR23-3 | Lyric fetch failure | PR-23 | TS-SONG-07 |

#### TS-SONG-01 Song page content [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-011-AC-01, AC-07 · **Risk** PR-08 · **Condition** TC-US011-1
- **Objective:** The song page shows everything agreed, consistent with the API.
- **Preconditions:** Song 1.
- **Flow:** Open `/song/1`.
- **Expected:**
  - Shown: title, cover, artist links, favorite and review counts, Play, Download, lyrics and the artists list.
  - Title, counts and artists match the detail response.
  - The page heart and star only show counts: clicking them sends no favorite or review request.
- **Data:** Song 1. **Rule:** Favoriting and rating happen in the player bar only.
- **Dependencies:** None. **Notes:** The action-bar heart sends no API call (REC §8.8).

#### TS-SONG-02 Unknown song [P2]
- **Level** CI + SYS · **Layers** API, UI · **Story** US-011-AC-02 · **Risk** PR-14 · **Condition** TC-PR14-2
- **Objective:** An unknown song is reported.
- **Preconditions:** None.
- **Flow:** Request song `99999999`; open `/song/99999999`.
- **Expected:** API 404; the page shows "Song not found".
- **Data:** Id `99999999`. **Rule:** -
- **Dependencies:** None. **Notes:** Observed working; this protects against regression.

#### TS-SONG-03 Lyrics display [P3]
- **Level** SYS · **Layers** UI · **Story** US-011-AC-03 · **Risk** - · **Condition** TC-US011-2
- **Objective:** Lyrics are shown when they exist, otherwise a message.
- **Preconditions:** Song with a long lyric file (song 1); song without a lyric file.
- **Flow:** Open each song; use Show More and Show Less.
- **Expected:** Time-tagged lines shown; long lyrics collapse and expand. A song without lyrics shows "no lyrics yet".
- **Data:** A song without lyrics: **not identified yet**. **Rule:** -
- **Dependencies:** Test data. **Notes:** -

#### TS-SONG-04 Current lyric line highlighted during playback [P3]
- **Level** SYS · **Layers** UI · **Story** US-011-AC-04 · **Risk** - · **Condition** TC-US011-2
- **Objective:** The lyric line follows playback.
- **Preconditions:** Song 1 playing.
- **Flow:** Let the song play past several time tags.
- **Expected:** The highlighted line changes with playback time and matches the time tags.
- **Data:** Song 1. **Rule:** -
- **Dependencies:** Real audio from S3. **Notes:** Timing-sensitive; also a manual check at acceptance.

#### TS-SONG-05 Other songs by the artist [P3]
- **Level** SYS · **Layers** UI · **Story** US-011-AC-05 · **Risk** - · **Condition** TC-US011-3
- **Objective:** The list is limited and expandable.
- **Preconditions:** Song whose artist has more than 4 other songs (song 1 showed 30).
- **Flow:** Open the song; use View More and Show Less.
- **Expected:** At most 30 songs; View More and Show Less shown when there are more than 4.
- **Data:** Song 1; a song with 4 or fewer other songs for the boundary. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-SONG-06 Heart and star state after reload and navigation [P2] — Known defect
- **Level** SYS · **Layers** UI, API, Data · **Story** US-011-AC-06 · **Risk** PR-12 · **Condition** TC-PR12-1, TC-PR12-2
- **Objective:** A signed-in user sees their favorite and review state on the song page.
- **Preconditions:** Signed-in user who favorited and reviewed a song.
- **Flow:** Reach the song by in-app navigation; then hard reload the page.
- **Expected:** Both times heart and star filled, consistent with `/player` (`isFavorited` and `isReviewed` true).
- **Data:** Favorite (reversible) + review (**Write**). **Rule:** -
- **Dependencies:** TR-01 for the review. **Notes:** Today the hard reload shows both empty (F-5). The favorite-only part can run without the write environment.

#### TS-SONG-07 Lyric file cannot be fetched [P3]
- **Level** SIT · **Layers** UI, Integration · **Story** US-011-AC-08 · **Risk** PR-23 · **Condition** TC-PR23-3
- **Objective:** A lyric fetch failure does not break the page.
- **Preconditions:** Song 1; the lyric request fails (controlled).
- **Flow:** Open the song.
- **Expected:** No lyrics shown; the rest of the page and playback work. Whether a message is shown is open (AC-08).
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** Expected detail open.

### US-012 Download a song

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US012-1 | File name and guest download | - | TS-DL-01 |
| TC-PR23-1 | Download failure | PR-23 | TS-DL-02 |

#### TS-DL-01 Download saves a correctly named MP3 [P3]
- **Level** SYS · **Layers** UI, Integration · **Story** US-012-AC-01, AC-03 · **Risk** - · **Condition** TC-US012-1
- **Objective:** Download works for guests and members, with a sanitized file name.
- **Preconditions:** Guest; then signed-in user.
- **Flow:** Download a song whose title contains spaces, diacritics or symbols.
- **Expected:** An `.mp3` file named from the title, with characters outside `[a-zA-Z0-9._-]` replaced by `_`.
- **Data:** Song with special characters in the title (song 1 "Chờ Anh Nhé"). **Rule:** Guests may download (SD-10).
- **Dependencies:** S3. **Notes:** Cross-origin download was a repository concern (`R:automation-considerations.md` §2, Downloads); it worked once when signed in.

#### TS-DL-02 Download failure shows an error [P3]
- **Level** SIT · **Layers** UI, Integration · **Story** US-012-AC-02 · **Risk** PR-23 · **Condition** TC-PR23-1
- **Objective:** The user is told when a download fails.
- **Preconditions:** The MP3 request fails (controlled).
- **Flow:** Click Download.
- **Expected:** `download_error` toast (translated text); no broken file.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** -

### US-013 Player

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR08-1/8 | Start playback (guest and member) | PR-08 | TS-PLAY-01 |
| TC-PR08-2 | Pause and resume | PR-08 | TS-PLAY-02 |
| TC-PR08-3 | Next, previous, queue refill | PR-08 | TS-PLAY-03, TS-PLAY-08 |
| TC-PR08-4 | Repeat | PR-08 | TS-PLAY-04 |
| TC-PR08-5 | Shuffle | PR-08 | TS-PLAY-05 |
| TC-PR08-6 | Volume | PR-08 | TS-PLAY-06 |
| TC-PR08-7 | Auto-advance | PR-08 | TS-PLAY-07 |
| TC-US013-1 | Title display | - | TS-PLAY-09 |
| TC-US013-2 | Media failure | PR-08 | TS-PLAY-10 |

#### TS-PLAY-01 Start playback [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-013-AC-01, AC-09 · **Risk** PR-08 · **Condition** TC-PR08-1, TC-PR08-8
- **Objective:** Pressing Play starts the song for guests and members.
- **Preconditions:** Guest on `/song/1`; repeat as a signed-in user.
- **Flow:** Press Play.
- **Expected:** The player bar appears with the right title, artist and cover. The audio position advances.
- **Data:** Song 1. **Rule:** Guests can play.
- **Dependencies:** S3. **Notes:** Audio needs a few seconds of buffering; wait on the position, not a fixed time.

#### TS-PLAY-02 Pause and resume [P1]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-02 · **Risk** PR-08 · **Condition** TC-PR08-2
- **Objective:** Pause stops playback and Play resumes it.
- **Preconditions:** Song playing.
- **Flow:** Pause; then Play.
- **Expected:** Position stops advancing and the icon shows Play; then advances again and the icon shows Pause.
- **Data:** Song 1. **Rule:** -
- **Dependencies:** S3. **Notes:** -

#### TS-PLAY-03 Next, previous and queue refill [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-013-AC-03 · **Risk** PR-08 · **Condition** TC-PR08-3
- **Objective:** Queue navigation works and the queue never runs dry.
- **Preconditions:** Song playing with a queue.
- **Flow:** Next; Previous; press Next until 3 or fewer songs remain.
- **Expected:**
  - Next plays the following song; Previous plays the previous one.
  - With 3 or fewer left, a new batch is appended. Its songs all have lyrics.
- **Data:** Any start song. **Rule:** Next batch is random songs that have lyrics.
- **Dependencies:** S3. **Notes:** Queue content is random (TR-08); assert the change of song and the refill, not specific songs.

#### TS-PLAY-04 Repeat modes [P1]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-04 · **Risk** PR-08 · **Condition** TC-PR08-4
- **Objective:** Repeat cycles through its states and each state behaves correctly.
- **Preconditions:** Song playing in a short queue.
- **Flow:** Press Repeat three times; let a song end in Repeat one; let the queue end in Repeat all.
- **Expected:**
  - State cycle: Off → Repeat all → Repeat one → Off.
  - Repeat one restarts the same song.
  - Repeat all restarts the queue from the first song.
- **Data:** Short songs or a controlled near-end position. **Rule:** -
- **Dependencies:** S3. **Notes:** Not yet run (US-013 status).

#### TS-PLAY-05 Shuffle [P1]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-05 · **Risk** PR-08 · **Condition** TC-PR08-5
- **Objective:** Shuffle reorders the rest of the queue and can be undone.
- **Preconditions:** Song playing with a queue of several songs.
- **Flow:** Turn shuffle on; turn it off.
- **Expected:** On: the current song stays first and the others are reordered. Off: the original order is restored.
- **Data:** Favorites playlist with known order (setup through the API) is a convenient queue. **Rule:** -
- **Dependencies:** S3. **Notes:** A shuffle can return the same order by chance; use a queue long enough to make that unlikely.

#### TS-PLAY-06 Volume and mute [P1]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-06 · **Risk** PR-08 · **Condition** TC-PR08-6
- **Objective:** Volume defaults and mute behave as agreed.
- **Preconditions:** Song playing in a fresh session.
- **Flow:** Read the volume; change it; mute; unmute.
- **Expected:** Default 70%. Mute sets 0 and remembers the previous value; unmute restores it.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-PLAY-07 Next song starts when a song ends [P1]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-07 · **Risk** PR-08 · **Condition** TC-PR08-7
- **Objective:** Playback continues automatically.
- **Preconditions:** Song near its end (Repeat off).
- **Flow:** Let the song finish.
- **Expected:** The next queue song starts and the player shows it.
- **Data:** -. **Rule:** -
- **Dependencies:** S3. **Notes:** Seek behavior itself is open (AC-10).

#### TS-PLAY-08 One click performs one action [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-013-AC-03 · **Risk** PR-08, TR-03 · **Condition** TC-PR08-3
- **Objective:** Duplicated player controls (rendered 2 to 3 times) do not double-handle a click.
- **Preconditions:** Song playing on `/song/{id}` (3 control copies observed) and on `/` (2 copies).
- **Flow:** Press Next once; press the player heart once (signed in).
- **Expected:** Next moves exactly one song forward. The heart sends one `favorite-toggle` and changes state once.
- **Data:** Signed-in user for the heart. **Rule:** -
- **Dependencies:** None. **Notes:** From F-3; also compare on a production build (TR-13).

#### TS-PLAY-09 Player title shortening and link [P3]
- **Level** SYS · **Layers** UI · **Story** US-013-AC-08 · **Risk** - · **Condition** TC-US013-1
- **Objective:** Long titles are shortened and the title opens the song.
- **Preconditions:** Songs with titles of 25 and 26+ characters.
- **Flow:** Play each; click the title.
- **Expected:** 25 characters shown in full; longer titles cut at 25 with an ellipsis. Click opens `/song/{id}`.
- **Data:** Titles at the boundary (to be found in the catalog). **Rule:** -
- **Dependencies:** Test data. **Notes:** -

#### TS-PLAY-10 Audio file cannot be loaded [P1]
- **Level** SIT · **Layers** UI, Integration · **Story** US-013 · **Risk** PR-08 · **Condition** TC-US013-2
- **Objective:** A missing or failing MP3 does not freeze the app.
- **Preconditions:** The MP3 request fails (controlled).
- **Flow:** Press Play.
- **Expected:** **To be confirmed** (A-Q18). Minimum: the app stays usable and other songs can be played.
- **Data:** -. **Rule:** -
- **Dependencies:** A-Q18. **Notes:** Expected behavior open.

---

## 7. Favorites (FA-09)

### US-015 Favorite and unfavorite

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR13-1 | Toggle state and counts | PR-13 | TS-FAV-01 |
| TC-PR19-1 | In-flight protection | PR-19 | TS-FAV-02 |
| TC-PR19-2 | Cache invalidation | PR-19 | TS-FAV-03 |
| TC-PR19-3 | Record reuse | PR-19 | TS-FAV-04 |
| TC-US015-1 | Control placement | - | TS-FAV-05 |
| TC-US015-2 | Invalid song | PR-19 | TS-FAV-06 |

#### TS-FAV-01 Favorite and unfavorite update state and counts [P2] — Known defect (count)
- **Level** SYS · **Layers** UI, API, Data · **Story** US-015-AC-01, AC-02 · **Risk** PR-13 · **Condition** TC-PR13-1
- **Objective:** A toggle changes the heart, the response and the like count by exactly one, consistently everywhere.
- **Preconditions:** Signed-in user; the song is not a favorite; song playing in the player bar.
- **Flow:** Click the heart; read the counts; click again.
- **Expected:**
  - First click: `Đã thêm vào yêu thích`, `isFavorited:true`, heart filled. Like count +1 on the player bar and the song page, and in `/player`.
  - Second click: `Đã bỏ yêu thích`, heart cleared, count back. The count never goes below 0.
- **Data:** Song 1 (reversible). **Rule:** Count only includes `IsFavorite = true`.
- **Dependencies:** None. **Notes:** Today the song-page count stays unchanged until reload (F-6). Assert deltas; others may change the count (TR-08).

#### TS-FAV-02 Rapid clicks while a request is in flight [P3]
- **Level** SYS · **Layers** UI, API · **Story** US-015-AC-03 · **Risk** PR-19 · **Condition** TC-PR19-1
- **Objective:** Fast repeated clicks do not leave the state inconsistent.
- **Preconditions:** Signed-in user; slow `favorite-toggle` response (controlled delay).
- **Flow:** Click the heart, and click again before the response arrives.
- **Expected:** The heart is disabled while the request runs; only one toggle request is sent; the final state matches the server.
- **Data:** Song 1. **Rule:** -
- **Dependencies:** None. **Notes:** Concurrent toggles at API level (UNK-48) can be explored separately.

#### TS-FAV-03 Favorites page reflects a change at once [P3]
- **Level** SYS · **Layers** UI, API · **Story** US-015-AC-04, US-016-AC-01 · **Risk** PR-19 · **Condition** TC-PR19-2
- **Objective:** A toggle clears the 15-minute favorites cache.
- **Preconditions:** Signed-in user who has visited `/favorites`.
- **Flow:** Toggle a song on, open `/favorites`; toggle it off, open `/favorites`.
- **Expected:** The song appears, then disappears, without waiting for the cache to expire.
- **Data:** Song 1. **Rule:** Cache cleared on change.
- **Dependencies:** None. **Notes:** Removal observed (BR-F3).

#### TS-FAV-04 Re-favoriting reuses the same record [P3]
- **Level** CI · **Layers** API, Data · **Story** US-015-AC-05 · **Risk** PR-19 · **Condition** TC-PR19-3
- **Objective:** Toggling repeatedly keeps one favorite record per user and song.
- **Preconditions:** Signed-in user.
- **Flow:** Toggle on, off, on, off; read the like count after each step.
- **Expected:** States alternate; the count moves by exactly ±1 each time and returns to its start value.
- **Data:** Song 1. **Rule:** One record per user and song.
- **Dependencies:** None. **Notes:** The record itself is not visible without database access; the count is the oracle.

#### TS-FAV-05 Favorite control exists only in the player bar [P3]
- **Level** SYS · **Layers** UI · **Story** US-015-AC-06, SD-2 · **Risk** - · **Condition** TC-US015-1
- **Objective:** No favorite control appears elsewhere.
- **Preconditions:** Signed-in user.
- **Flow:** Inspect song cards, rows, charts and the song page.
- **Expected:** No favorite control outside the player bar (song-page heart displays a count only, TS-SONG-01).
- **Data:** -. **Rule:** SD-2.
- **Dependencies:** None. **Notes:** -

#### TS-FAV-06 Favoriting a song that does not exist [P3]
- **Level** CI · **Layers** API · **Story** US-015-AC-07 · **Risk** PR-19 · **Condition** TC-US015-2
- **Objective:** The API refuses an unknown song id.
- **Preconditions:** Signed-in user.
- **Flow:** Toggle favorite for id `99999999`.
- **Expected:** An error status (likely 400; **exact status to be confirmed**). No favorite created.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** -

### US-016 Favorites playlist

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US016-1 | List and summary line | PR-19 | TS-FAV-07 |
| TC-US016-2 | Empty state | - | TS-FAV-08 |
| TC-US016-3 | Play All | - | TS-FAV-09 |
| TC-US016-4 | Reorder, show more, download | - | TS-FAV-10, TS-FAV-11 |

#### TS-FAV-07 Favorites list and featured artist line [P3]
- **Level** SYS · **Layers** UI, API · **Story** US-016-AC-01 · **Risk** PR-19 · **Condition** TC-US016-1
- **Objective:** The playlist lists the user's favorites with a correct summary line.
- **Preconditions:** Signed-in user with favorites from several artists.
- **Flow:** Open `/favorites` with favorites from 1, 3 and 5 distinct artists.
- **Expected:**
  - The list equals the favorites returned by the API.
  - "Featured Artist" shows the most frequent artists, 1 to 3 of them.
  - With more than 3 artists, "& N others" is added, where N = the number of distinct artists minus 3.
- **Data:** Favorites set up through the API. **Rule:** Featured artist calculation.
- **Dependencies:** None. **Notes:** Calculated value; tie order between equally frequent artists is not defined.

#### TS-FAV-08 Empty favorites [P3]
- **Level** SYS · **Layers** UI · **Story** US-016-AC-02 · **Risk** - · **Condition** TC-US016-2
- **Objective:** A user with no favorites sees the empty message.
- **Preconditions:** New user.
- **Flow:** Open `/favorites`.
- **Expected:** "Add your favorite songs to see them here!".
- **Data:** New user. **Rule:** -
- **Dependencies:** None. **Notes:** Observed.

#### TS-FAV-09 Play All [P3]
- **Level** SYS · **Layers** UI · **Story** US-016-AC-03 · **Risk** - · **Condition** TC-US016-3
- **Objective:** The playlist can be played as a queue.
- **Preconditions:** User with at least 2 favorites.
- **Flow:** Press Play All; let it play; play a song that is not in the playlist.
- **Expected:** The first playlist song plays and the queue follows the list. The button shows Pause while a playlist song plays, and Play otherwise.
- **Data:** Favorites. **Rule:** -
- **Dependencies:** S3. **Notes:** -

#### TS-FAV-10 Reorder is client-only [P3]
- **Level** SYS · **Layers** UI · **Story** US-016-AC-04, SD-10 · **Risk** - · **Condition** TC-US016-4
- **Objective:** Drag reordering changes display and queue but is not saved.
- **Preconditions:** User with at least 3 favorites.
- **Flow:** Drag a row to a new position; play; reload.
- **Expected:** Display and play queue follow the new order; after reload the original order is back.
- **Data:** Favorites. **Rule:** Order not persisted (intended).
- **Dependencies:** None. **Notes:** Drag not yet run.

#### TS-FAV-11 Show more and playlist download [P3]
- **Level** SYS (+ ACC) · **Layers** UI · **Story** US-016-AC-05, AC-06 · **Risk** - · **Condition** TC-US016-4
- **Objective:** Long lists collapse; the playlist downloads song by song.
- **Preconditions:** User with a long favorites list.
- **Flow:** Expand and collapse; start Download Playlist.
- **Expected:** The list expands and collapses. Downloads start one by one, about 1 second apart.
- **Data:** Many favorites. **Rule:** -
- **Dependencies:** S3. **Notes:** The list length that triggers "show more" is not documented. Download timing is better checked manually.

---

## 8. Rating and review (FA-10)

### US-017 Rate and review a song

All submit scenarios are **Write**: reviews are permanent (TR-01).

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR03-3 | Modal states before rating | PR-03 | TS-REV-01 |
| TC-US017-1 | Successful submit | PR-02 (TS-REV-02) | TS-REV-02, TS-REV-03 |
| TC-PR02-3 | Rated state | PR-02 | TS-REV-04 |
| TC-PR24-1 | Review list format and order | PR-24 | TS-REV-05 |
| TC-PR23-2 | Submit failure | PR-23 | TS-REV-06 |
| TC-PR02-1/2 | Server uniqueness | PR-02 | TS-REV-07 |
| TC-PR03-1/2 | Server rating range | PR-03 | TS-REV-08 |
| TC-US017-2 | Modal empty list and closing | - | TS-REV-09 |

#### TS-REV-01 Rating form for a user who has not reviewed [P1]
- **Level** SYS · **Layers** UI · **Story** US-017-AC-01 · **Risk** PR-03 · **Condition** TC-PR03-3
- **Objective:** The form only allows a submit once a star is chosen.
- **Preconditions:** Signed-in user who has not reviewed the song; song playing; rating modal opened from the player bar.
- **Flow:** Inspect the form; choose 1 star; choose 5 stars.
- **Expected:** 1-to-5 star selector, optional comment, submit disabled until a star is chosen and enabled after.
- **Data:** Fresh user. **Rule:** Rating 1 to 5; comment optional.
- **Dependencies:** None (no submit). **Notes:** The modal text is Vietnamese only.

#### TS-REV-02 Submitting a review [P1] — Write
- **Level** SYS · **Layers** UI, API, Data, E2E · **Story** US-017-AC-02 · **Risk** PR-02 · **Condition** TC-US017-1
- **Objective:** A review is saved and shown at once.
- **Preconditions:** Signed-in user who has not reviewed the song.
- **Flow:** Choose stars, write a comment, submit.
- **Expected:**
  - `Đánh giá thành công!`.
  - The review is first in the list and the review count +1.
  - The review list from the API contains it with the same rating and comment.
- **Data:** Fresh user + comment with a run marker. **Rule:** -
- **Dependencies:** TR-01. **Notes:** This is also the member rating journey.

#### TS-REV-03 Submitting without a comment [P3] — Write
- **Level** SYS · **Layers** UI, API · **Story** US-017-AC-03 · **Risk** - · **Condition** TC-US017-1
- **Objective:** An empty comment gets the agreed placeholder.
- **Preconditions:** As TS-REV-02.
- **Flow:** Choose stars, leave the comment empty, submit.
- **Expected:** The request and the stored review carry `(Không có bình luận)`.
- **Data:** Fresh user. **Rule:** -
- **Dependencies:** TR-01. **Notes:** -

#### TS-REV-04 Rated state for a user who already reviewed [P1]
- **Level** SYS · **Layers** UI, API · **Story** US-017-AC-04 · **Risk** PR-02 · **Condition** TC-PR02-3
- **Objective:** The UI does not offer a second review.
- **Preconditions:** Signed-in user who has reviewed the song.
- **Flow:** Play the song; open the rating modal.
- **Expected:** The rate button shows the "rated" state; the modal shows only the review list; `/player` returns `isReviewed:true`.
- **Data:** User with a review (**Write**, or reuse a review created by TS-REV-02 in the same run). **Rule:** One review per user and song.
- **Dependencies:** TR-01. **Notes:** -

#### TS-REV-05 Review list format and order [P3] — Known defect
- **Level** SYS · **Layers** UI, API · **Story** US-017-AC-05 · **Risk** PR-24 · **Condition** TC-PR24-1
- **Objective:** Reviews show the agreed fields, newest first, with one date format.
- **Preconditions:** A song with several reviews; a review just posted (TS-REV-02).
- **Flow:** Open the review list right after posting, and after reload.
- **Expected:** Display name, stars, comment and `yyyy-MM-dd` for every review, newest first, before and after reload.
- **Data:** Song with reviews. **Rule:** -
- **Dependencies:** TR-01 for the new review. **Notes:** Today a new review shows `30/9/2026` until reload (F-7). Do not record other users' names or comments in reports.

#### TS-REV-06 Submit failure is reported [P3]
- **Level** SYS · **Layers** UI · **Story** US-017-AC-06 · **Risk** PR-23 · **Condition** TC-PR23-2
- **Objective:** The user learns that the review was not saved.
- **Preconditions:** Rating form open; the submit request fails (controlled).
- **Flow:** Submit.
- **Expected:** "Không thể gửi đánh giá. Vui lòng thử lại."; the review is not added to the list and the count is unchanged.
- **Data:** -. **Rule:** -
- **Dependencies:** None (nothing is saved). **Notes:** -

#### TS-REV-07 Server refuses a second review [P1] — Known defect, Write
- **Level** SYS · **Layers** API, Data · **Story** US-017-AC-09, SD-7 · **Risk** PR-02 · **Condition** TC-PR02-1, TC-PR02-2
- **Objective:** Uniqueness is enforced by the server, not only by the UI.
- **Preconditions:** Signed-in user who has reviewed the song.
- **Flow:** Submit another review for the same song directly to the API.
- **Expected:**
  - Refused; the status code is not decided (A-Q15).
  - The review list and count are unchanged.
- **Data:** Fresh user + one review. **Rule:** SD-7.
- **Dependencies:** TR-01. **Notes:** Source-only defect: the server accepts it.

#### TS-REV-08 Server enforces the rating range [P1] — Known defect, Write
- **Level** SYS · **Layers** API, Data · **Story** US-017-AC-10, SD-7 · **Risk** PR-03 · **Condition** TC-PR03-1, TC-PR03-2
- **Objective:** Only ratings 1 to 5 are stored.
- **Preconditions:** A fresh user and an unreviewed song for each submission.
- **Flow:** Submit rating 1, 5, 0, 6 and −1.
- **Expected:** 1 and 5 accepted. 0, 6 and −1 refused (status not decided) and not stored.
- **Data:** Five fresh users (one review each). **Rule:** SD-7.
- **Dependencies:** TR-01. **Notes:** Source-only defect: any value is accepted. Comment length limit is undecided (A-Q15), so it has no scenario yet.

#### TS-REV-09 Rating modal with no reviews and closing [P3]
- **Level** SYS · **Layers** UI · **Story** US-017-AC-08 · **Risk** - · **Condition** TC-US017-2
- **Objective:** Record and check the open modal behaviors once agreed.
- **Preconditions:** Song without reviews.
- **Flow:** Open the modal; close it with X; open and close it with the overlay.
- **Expected:** **To be confirmed**: empty-review text; whether X and overlay close the modal.
- **Data:** Song without reviews (to be found). **Rule:** -
- **Dependencies:** Clarification. **Notes:** AC-08 is open.

Guest access to rating is covered by TS-AUTHZ-04.

---

## 9. Listening statistics (FA-11)

### US-021 Popular content reflects real listening

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR15-1/2 | Stream after 20 s, once | PR-15 | TS-STRM-01 |
| TC-PR15-3 | No stream for guests | PR-15 | TS-STRM-02 |
| TC-PR15-4 | Replay, repeat, seek | PR-15 | TS-STRM-03 |
| TC-US021-1 | Active users | - | TS-STRM-04 |

Ordering of popular lists (AC-03) is covered by TS-DISC-02.

#### TS-STRM-01 One stream per qualifying playback [P2] — Write
- **Level** SYS · **Layers** UI, API, Data · **Story** US-021-AC-01 · **Risk** PR-15 · **Condition** TC-PR15-1, TC-PR15-2
- **Objective:** A member's playback counts once, after 20 seconds.
- **Preconditions:** Signed-in user.
- **Flow:** Play a song for 19 seconds and stop; play another song past 20 seconds and keep playing.
- **Expected:** No stream request for the first song. Exactly one stream request for the second song, at about 20 seconds, with no further requests during the same playback.
- **Data:** Fresh user. **Rule:** ≥ 20 s, once per playback.
- **Dependencies:** TR-01 (stream rows are permanent). **Notes:** Only one observation exists (BR-P1). The stream rule can also be checked at API level, but the 20-second trigger is client-side.

#### TS-STRM-02 Guests record no stream [P2]
- **Level** SYS · **Layers** UI (+ request capture) · **Story** US-021-AC-02 · **Risk** PR-15 · **Condition** TC-PR15-3
- **Objective:** Guest playback is not counted.
- **Preconditions:** Guest.
- **Flow:** Play a song for more than 20 seconds.
- **Expected:** No stream request is sent.
- **Data:** -. **Rule:** Stream recording needs login.
- **Dependencies:** S3. **Notes:** Earlier observation stopped at 15 s (U-3.1).

#### TS-STRM-03 Replay, repeat and seek [P2] — Write
- **Level** SYS · **Layers** UI, API · **Story** US-021-AC-01 · **Risk** PR-15 · **Condition** TC-PR15-4
- **Objective:** Clarify and verify what "once per playback" means.
- **Preconditions:** Signed-in user.
- **Flow:** Replay the same song past 20 s; let Repeat one restart it; seek past 20 s without listening.
- **Expected:** **To be confirmed** for each case (U-1.7).
- **Data:** Fresh user. **Rule:** Once per playback.
- **Dependencies:** Clarification, TR-01. **Notes:** Exploratory first.

#### TS-STRM-04 Active-user heartbeat [P3]
- **Level** CI · **Layers** API · **Story** US-021-AC-05 · **Risk** - · **Condition** TC-US021-1
- **Objective:** Heartbeats count active users.
- **Preconditions:** Signed-in user.
- **Flow:** Send a heartbeat; read the active-users count.
- **Expected:** Heartbeat 200. The count includes the user within its 120-second window.
- **Data:** -. **Rule:** Heartbeat every 45 s; no UI.
- **Dependencies:** None. **Notes:** The counter is global and in memory; other users change it, so assert "at least one".

---

## 10. Language and theme (FA-12)

### US-018 Change interface language

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR25-1 | Switch | PR-25 | TS-L10N-01 |
| TC-PR25-2/3 | Detection, fallback, persistence | PR-25 | TS-L10N-02 |
| TC-PR25-4 | Completeness | PR-25 | TS-L10N-03 |

#### TS-L10N-01 Switching language [P3]
- **Level** SYS · **Layers** UI · **Story** US-018-AC-01, AC-02, rules · **Risk** PR-25 · **Condition** TC-PR25-1
- **Objective:** The UI changes language immediately; server messages stay Vietnamese.
- **Preconditions:** Any page.
- **Flow:** Open the language menu; select each language; trigger a server message (for example a failed login).
- **Expected:**
  - Menu: Tiếng Việt, English, 日本語, Русский, Deutsch, with a check on the current one.
  - Selecting a language changes the labels at once and sets `<html lang>` (vi, en, ja, ru, de).
  - Server messages and the rating modal stay Vietnamese.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-L10N-02 First visit, fallback and persistence [P3]
- **Level** SYS · **Layers** UI · **Story** US-018-AC-03, AC-04 · **Risk** PR-25 · **Condition** TC-PR25-2, TC-PR25-3
- **Objective:** The initial language is chosen sensibly and the choice is kept.
- **Preconditions:** No stored language; browser language set to a supported one, then to an unsupported one.
- **Flow:** Open the app; choose a language; reload.
- **Expected:** Supported browser language is used; an unsupported one falls back to English. The chosen language survives a reload.
- **Data:** Browser locales (for example `de`, `fr`). **Rule:** -
- **Dependencies:** None. **Notes:** `en-US` translation file returns non-JSON (F-8); check the effect.

#### TS-L10N-03 Translation completeness [P3]
- **Level** ACC · **Layers** UI · **Story** US-018-AC-04, US-006-AC-03 · **Risk** PR-25 · **Condition** TC-PR25-4
- **Objective:** Every screen is translated in all five languages, including genre names.
- **Preconditions:** -
- **Flow:** Review the main pages in each language.
- **Expected:** No raw translation keys; genre names translated where a translation exists.
- **Data:** -. **Rule:** -
- **Dependencies:** Reviewer for each language. **Notes:** Missing key `genre_category` already seen. Manual review.

### US-019 Change color theme

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR25-5 | Theme switch and persistence | PR-25 | TS-THEME-01 |

#### TS-THEME-01 Theme switch and persistence [P3]
- **Level** SYS (+ ACC for colors) · **Layers** UI · **Story** US-019-AC-01, AC-02, AC-03 · **Risk** PR-25 · **Condition** TC-PR25-5
- **Objective:** Themes apply at once and survive a reload.
- **Preconditions:** Any page.
- **Flow:** Open the theme menu; choose a theme; reload.
- **Expected:**
  - Six themes are listed, with the active one marked.
  - Choosing one changes the colors at once and stores it in the browser.
  - The theme is applied again after reload.
- **Data:** -. **Rule:** Stored per browser, not per account.
- **Dependencies:** None. **Notes:** Whether the colors look right is a manual check.

---

## 11. Navigation (FA-13)

### US-020 Navigation and layout

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US020-1 | Layout, highlight, user menu | - | TS-NAV-01 |
| TC-PR14-2 | Unknown route | PR-14 | TS-NAV-02 |

#### TS-NAV-01 Layout and navigation elements [P3]
- **Level** SYS · **Layers** UI · **Story** US-020-AC-01, AC-02, AC-03 · **Risk** - · **Condition** TC-US020-1
- **Objective:** The shared layout is consistent.
- **Preconditions:** Guest; then a signed-in user.
- **Flow:** Visit each sidebar entry; open `/auth`; open the user menu as a member.
- **Expected:**
  - Sidebar (Discover, Genres, Charts, Favorites), header and footer on every page except `/auth`, which has its own layout.
  - The current route's sidebar item is highlighted.
  - The user menu has Favorite Playlist and Logout.
- **Data:** Signed-in user. **Rule:** -
- **Dependencies:** None. **Notes:** Header back/forward arrows are not covered by a story (U-3.6).

#### TS-NAV-02 Unknown route [P2] — Known defect
- **Level** SYS · **Layers** UI · **Story** US-020-AC-05, SD-4 · **Risk** PR-14 · **Condition** TC-PR14-2
- **Objective:** Unknown URLs show a not-found page.
- **Preconditions:** None.
- **Flow:** Open an unknown path.
- **Expected:** A visible not-found page.
- **Data:** `/this-route-does-not-exist`. **Rule:** SD-4.
- **Dependencies:** None. **Notes:** Today the main area is blank.

---

## 12. Recommendations (FA-14)

### US-022 Receive "Recommended for you" recommendations

Level and modes follow `levels/system-integration.md` §3: Mode A = controlled (real loader, recorded responses), Mode B = real service, captured only. Relevance of recommendations is out of scope.

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-PR17-2 | App works with the tracker blocked | PR-17 | TS-REC-01 |
| TC-PR18-1 | Placement and card content | PR-18 | TS-REC-02, TS-REC-03 |
| TC-PR18-2/3 | Card click | PR-18 | TS-REC-04 |
| TC-US022-1 | Popup and persistence | PR-17 | TS-REC-05 |
| TC-PR17-1/2 | Failure handling | PR-17 | TS-REC-06, TS-REC-07 |
| TC-PR17-3 | Core controls with the popup | PR-17 | TS-REC-08 |
| TC-PR04-1/2 | Before a consent choice | PR-04 | TS-REC-09 |
| TC-PR05-1/2/3 | After Decline | PR-05 | TS-REC-10 |
| TC-PR20-1, TC-PR06-4 | Behavior after consent | PR-20, PR-06 | TS-REC-11, TS-REC-12, TS-REC-13 |
| TC-PR06-1/2/3 | Allowed data only | PR-06 | TS-REC-14 |
| TC-PR06-5 | Configuration drift | PR-06 | TS-REC-15 |
| TC-US022-2 | Real-service integration | PR-18, TR-11 | TS-REC-16 |

#### TS-REC-01 App works with the tracker blocked [P2]
- **Level** SYS · **Layers** UI · **Story** US-022-AC-04 · **Risk** PR-17 · **Condition** TC-PR17-2
- **Objective:** PSMusic does not depend on the tracker.
- **Preconditions:** Tracker loader and service blocked.
- **Flow:** Open Home, a song, a category, Genres and Charts.
- **Expected:**
  - No page errors.
  - "Recommends for you" headings present and sections empty.
  - No banner and no popup; the rest of the content is normal.
- **Data:** -. **Rule:** Tracker blocked outside SIT.
- **Dependencies:** None. **Notes:** All system-level suites run in this state.

#### TS-REC-02 Where recommendations appear [P2]
- **Level** SIT (Mode A) · **Layers** UI, Integration · **Story** US-022 "Where it appears", AC-02 · **Risk** PR-18 · **Condition** TC-PR18-1
- **Objective:** Inline sections and popups appear exactly on the agreed routes.
- **Preconditions:** Controlled tracker with the recorded configuration; consent granted.
- **Flow:** Visit Home, Song, Category, Genres, Charts, Artist and Auth.
- **Expected:**
  - Inline sections: Home, Song and Category, with the configured counts (50, 10, 20).
  - Popup of 50: Song, Category, Genres and Charts.
  - Nothing on Artist and Auth.
- **Data:** Configuration fixture. **Rule:** Counts come from the tracker configuration.
- **Dependencies:** Mode A spike (TR-11). **Notes:** `/search` and logged-in `/favorites` popups are configured but never observed: exploratory.

#### TS-REC-03 Card shows the matching item [P2]
- **Level** SIT (Mode A) · **Layers** UI, Integration · **Story** US-022-AC-01, AC-07 · **Risk** PR-18 · **Condition** TC-PR18-1
- **Objective:** Each card is a faithful, complete rendering of its item.
- **Preconditions:** Deterministic response fixture.
- **Flow:** Load Home, a song page and the popup.
- **Expected:** Card n shows title, artist and image of item n. No card is blank or has a broken image.
- **Data:** Fixture with long titles and multi-artist strings. **Rule:** -
- **Dependencies:** TR-11. **Notes:** Observed for all 50 Home cards; Song, Category and popup not yet compared.

#### TS-REC-04 Clicking a card opens the right song [P2]
- **Level** SIT (Mode A; one real run in TS-REC-16) · **Layers** UI, Integration · **Story** US-022-AC-08, AC-09 · **Risk** PR-18 · **Condition** TC-PR18-2, TC-PR18-3
- **Objective:** A click on card n navigates to that song and reports position n.
- **Preconditions:** Deterministic fixture whose `DomainItemId`s are real catalog songs; consent granted.
- **Flow:** Click the first, a middle and the last card, inline and in the popup.
- **Expected:**
  - `/song/{DomainItemId}` of that item opens in the same tab. The heading equals the card title.
  - An evaluation request is sent with `Rank = n`.
- **Data:** Fixture (for example ids 2179, 4, 1716). **Rule:** Card id is the service id; song id is `DomainItemId`.
- **Dependencies:** TR-11. **Notes:** The popup stays open after the click (observed).

#### TS-REC-05 Popup close and persistence across pages [P2]
- **Level** SIT (Mode A) · **Layers** UI · **Story** US-022-AC-02, AC-03 · **Risk** PR-17 · **Condition** TC-US022-1
- **Objective:** The popup can be closed, and recommendations stay while browsing.
- **Preconditions:** Controlled tracker; song page with popup.
- **Flow:** Close the popup; navigate to other song and category pages in the app.
- **Expected:** The popup closes. Recommendations remain present on later pages without a reload.
- **Data:** Fixture. **Rule:** Same list on every song page (accepted, SD-10).
- **Dependencies:** None. **Notes:** Whether the popup reappears after closing is not specified; record it.

#### TS-REC-06 Failed or empty recommendation response [P2]
- **Level** SIT (Mode A) · **Layers** UI, Integration · **Story** US-022-AC-04 · **Risk** PR-17 · **Condition** TC-PR17-1, TC-PR17-2
- **Objective:** Agreed failure cases degrade quietly.
- **Preconditions:** Cached results cleared; recommendation call aborted, answered with 500, or with an empty list.
- **Flow:** Open Home, a song and a category for each failure.
- **Expected:**
  - Page loads, the heading stays, the section is empty.
  - No popup, no page error.
- **Data:** Failure fixtures. **Rule:** -
- **Dependencies:** None. **Notes:** Observed for abort on all three pages; 500 and empty on Home only.

#### TS-REC-07 Unconfirmed failure classes [P2]
- **Level** SIT (Mode A) · **Layers** UI, Integration · **Story** US-022-AC-04 · **Risk** PR-17 · **Condition** TC-PR17-1
- **Objective:** Cover failures that the story does not name.
- **Preconditions:** As TS-REC-06, with: 4xx, slow response (timeout), malformed body, items with missing title or image, unknown `DomainItemId`, configuration endpoints failing.
- **Flow:** Open a page with an inline section for each.
- **Expected:**
  - Minimum assumed: the page stays usable with no app error.
  - The exact behavior (empty, placeholder, late cards) is **to be confirmed** (A-Q5).
- **Data:** Failure fixtures. **Rule:** -
- **Dependencies:** A-Q5. **Notes:** One scenario with data variants; each variant becomes its own case once confirmed.

#### TS-REC-08 Core features usable with recommendations active or failing [P2]
- **Level** SIT (Mode A) · **Layers** UI · **Story** US-022-AC-04 · **Risk** PR-17 · **Condition** TC-PR17-3
- **Objective:** Recommendations never stop the user from using PSMusic.
- **Preconditions:** Song page; recommendations working (popup shown), and each failure class from TS-REC-06.
- **Flow:** Play, pause, favorite (signed in), open the rating modal, type in search, navigate with the sidebar.
- **Expected:** All actions work in the failure cases. With the popup shown: **to be confirmed** (A-Q6). Today the popup blocks clicks (F-2).
- **Data:** Signed-in user. **Rule:** -
- **Dependencies:** A-Q6. **Notes:** -

#### TS-REC-09 Nothing is sent before a consent choice [P1] — Known defect
- **Level** SIT (Mode B) · **Layers** Integration · **Story** US-022-AC-17, SD-9 · **Risk** PR-04 · **Condition** TC-PR04-1, TC-PR04-2
- **Objective:** The tracker stays silent until the user chooses.
- **Preconditions:** Clean browser; banner visible; as guest and as a signed-in user.
- **Flow:** Load the pages that request recommendations; interact with song cards without touching the banner.
- **Expected:** No identity (`UserId`, `AnonymousId`) and no behavior sent to the service. Whether an anonymous recommendation request is allowed is **to be confirmed** (A-Q1).
- **Data:** API-created user. **Rule:** SD-9.
- **Dependencies:** A-Q1. **Notes:** Today the recommendation request with both identifiers is sent while the banner is shown.

#### TS-REC-10 Decline stops behavior and identity [P1] — Known defect
- **Level** SIT (Mode B) · **Layers** UI, Integration · **Story** US-022-AC-14, AC-15 · **Risk** PR-05 · **Condition** TC-PR05-1, TC-PR05-2, TC-PR05-3
- **Objective:** Declining is respected while recommendations keep working.
- **Preconditions:** Clean browser; Decline clicked; guest and signed-in user.
- **Flow:** Browse; click each song-card type (play overlay, song row, dual-column row, song-page Play, Download, player heart); click a recommendation card; submit a header search.
- **Expected:**
  - Recommendations still shown and clickable.
  - No event, evaluation or keyword request.
  - No `UserId` or `AnonymousId` in any request.
- **Data:** API-created user. **Rule:** Decline = receive only.
- **Dependencies:** A-Q1. **Notes:** Today evaluation and keyword requests are still sent, with identity.

#### TS-REC-11 Behavior event per song-card type after consent [P3]
- **Level** SIT (Mode A for wiring; Mode B for the live rules) · **Layers** Integration · **Story** US-022-AC-16, AC-13 · **Risk** PR-20 · **Condition** TC-PR20-1
- **Objective:** Each tracked interaction produces the right event for the right song.
- **Preconditions:** Consent granted; signed-in user.
- **Flow:** Interact once with each card type: play overlay, song row, dual-column row (blank area), song-page Play, Download, player heart.
- **Expected:**
  - One event per interaction (Download: **two observed, to be confirmed**, A-Q7).
  - The expected event type and rule (169, 170, 171, 172, 168, 167).
  - `ItemId` = the song acted on.
  - A title or artist click that only navigates sends no event.
- **Data:** Catalog songs. **Rule:** Behavior only for song-card interactions.
- **Dependencies:** TR-11. **Notes:** Search-result cards became checkable when search was unblocked on 2026-10-08 (TR-05); not yet captured.

#### TS-REC-12 No behavior without interaction [P1]
- **Level** SIT (Mode B) · **Layers** Integration · **Story** US-022-AC-16 · **Risk** PR-06 · **Condition** TC-PR06-4
- **Objective:** Browsing alone sends no behavior.
- **Preconditions:** Consent granted.
- **Flow:** Visit every main page and scroll, without clicking song cards.
- **Expected:** No event requests.
- **Data:** -. **Rule:** -
- **Dependencies:** None. **Notes:** Observed correct.

#### TS-REC-13 Rating, review and search after consent [P1] — Write
- **Level** SIT (Mode B) · **Layers** Integration · **Story** US-022-AC-12, AC-16 · **Risk** PR-06 · **Condition** TC-PR06-4
- **Objective:** Rating, review and search keyword tracking send only what is agreed.
- **Preconditions:** Consent granted; signed-in user who has not reviewed the song.
- **Flow:** Submit a rating with a comment; submit a header search with Enter; open `/search?q=` directly.
- **Expected:**
  - Rating and review events carry the song id and the rating; the comment only if approved (A-Q3).
  - The keyword request is sent on Enter with the trimmed keyword.
  - Opening the URL directly sends no keyword.
- **Data:** Fresh user, canary comment. **Rule:** AC-12.
- **Dependencies:** TR-01, A-Q3. **Notes:** Rating and review events have not been observed yet.

#### TS-REC-14 Only approved data is sent [P1]
- **Level** SIT (Mode B) + ACC (approval) · **Layers** Integration · **Story** US-022-AC-10, AC-11 · **Risk** PR-06 · **Condition** TC-PR06-1, TC-PR06-2, TC-PR06-3
- **Objective:** Detect any sensitive or unapproved data sent to the service.
- **Preconditions:** User with canary password and email; consent granted.
- **Flow:** Log in, browse, play, favorite, search, log out; capture all traffic to the tracker (URLs, headers, bodies, beacons).
- **Expected:**
  - No canary password or email, access token, refresh cookie or service key anywhere.
  - Identity only as `UserId` (username) and `AnonymousId`.
  - Every field is on the approved allowlist; others are reported as unapproved.
- **Data:** Canary user. **Rule:** AC-10, AC-11.
- **Dependencies:** Allowlist approval (A-Q2). **Notes:** UI sign-up capture is blocked (TR-06); use exact canaries, not patterns (REC §8.4).

#### TS-REC-15 Tracker configuration matches the approved snapshot [P1]
- **Level** SIT (Mode B) · **Layers** Integration · **Story** US-022-AC-13 · **Risk** PR-06, TR-11 · **Condition** TC-PR06-5
- **Objective:** Detect remote changes to tracking rules, display configuration or the loader.
- **Preconditions:** Approved snapshot of rules, return methods and loader fingerprint.
- **Flow:** Read the live configuration and loader; compare.
- **Expected:** No difference, or each difference is reported for review.
- **Data:** Snapshot. **Rule:** Rules can change without app changes.
- **Dependencies:** None. **Notes:** -

#### TS-REC-16 Real recommendation service end to end [P2]
- **Level** SIT (Mode B) · **Layers** UI, API, Integration, E2E · **Story** US-022-AC-01, AC-07, AC-08 · **Risk** PR-18, TR-11 · **Condition** TC-US022-2
- **Objective:** The real service is reachable, keeps its contract and works with PSMusic.
- **Preconditions:** Service health check passes (otherwise the run is "external unavailable").
- **Flow:** Request configuration and recommendations; check every returned song id against PSMusic; load Home and click one card.
- **Expected:**
  - Responses have the agreed shape (`Id`, `DomainItemId`, `Title`, `Artist`, `ImageUrl`).
  - Every `DomainItemId` exists in PSMusic.
  - Cards render and the click opens the matching song.
- **Data:** Fresh identity. **Rule:** -
- **Dependencies:** Test domain key preferred (A-Q8). **Notes:** No assertion on which songs are recommended.

---

## 13. Cross-cutting API behavior

| Condition | Description | Risk | Scenarios |
|---|---|---|---|
| TC-US-TB-1 | Paged list contract | - | TS-API-01 |
| TC-PR26-1 | Paging parameter robustness | PR-26 | TS-API-02 |

#### TS-API-01 Paged list shape [P3]
- **Level** CI · **Layers** API · **Story** "Technical behaviors" · **Risk** - · **Condition** TC-US-TB-1
- **Objective:** Every paged endpoint uses the agreed shape.
- **Preconditions:** None.
- **Flow:** Call each paged endpoint used by the SPA; compare consecutive pages.
- **Expected:** `{ items, page, limit, totalItems, totalPages }`, camelCase. `totalPages` is consistent with `totalItems` and `limit`. Pages do not overlap.
- **Data:** Category 1. **Rule:** -
- **Dependencies:** None. **Notes:** -

#### TS-API-02 Invalid paging values [P3]
- **Level** CI · **Layers** API · **Story** "Technical behaviors" · **Risk** PR-26 · **Condition** TC-PR26-1
- **Objective:** Out-of-range paging values do not cause server errors.
- **Preconditions:** None.
- **Flow:** Call popular endpoints with `page=0`, `size=0` and a very large `size`.
- **Expected:** No 500. Exact behavior **to be agreed**.
- **Data:** -. **Rule:** -
- **Dependencies:** Clarification. **Notes:** Possible 500 noted in `exploration-validation.md` §8.

---

## 14. Journeys

These combine features already covered above. They prove that the pieces fit and do not repeat edge cases.

#### TS-E2E-01 Guest discovers and plays a song [P1]
- **Level** SYS · **Layers** E2E, UI · **Story** US-005, US-006, US-011, US-013 · **Risk** PR-08 · **Condition** TC-PR08-1
- **Objective:** A first-time visitor can find and play music.
- **Preconditions:** Guest, clean browser.
- **Flow:** Home → genre → song → Play.
- **Expected:** Each page loads with content and the song plays in the player bar.
- **Data:** Catalog. **Rule:** -
- **Dependencies:** S3. **Notes:** Candidate for smoke.

#### TS-E2E-02 Member listens, favorites and logs out [P1]
- **Level** SYS · **Layers** E2E, UI, API · **Story** US-002, US-013, US-015, US-016, US-004 · **Risk** PR-07, PR-08, PR-09 · **Condition** TC-PR07-0, TC-PR13-1, TC-PR09-1
- **Objective:** The main member journey works end to end.
- **Preconditions:** Existing user, signed out.
- **Flow:** Log in → play a song → favorite it → open Favorite Playlist → play it from there → log out.
- **Expected:**
  - Each step succeeds.
  - The song is in the playlist and plays from there.
  - Logout lands on `/` with Login shown.
- **Data:** API-created user. **Rule:** -
- **Dependencies:** S3. **Notes:** The logout step fails today (known defect PR-09). Unfavorite in teardown.

The member rating journey is TS-REV-02.

---

## 15. Summary

### 15.1 Totals

**117 scenarios.** P1 32, P2 36, P3 49.

| Feature | Scenarios | P1 | P2 | P3 |
|---|---|---|---|---|
| Registration | 8 | 0 | 1 | 7 |
| Authentication and session | 11 | 7 | 2 | 2 |
| Authorization and gating | 8 | 2 | 6 | 0 |
| Discovery | 12 | 0 | 3 | 9 |
| Search | 9 | 0 | 8 | 1 |
| Song details | 7 | 1 | 2 | 4 |
| Download | 2 | 0 | 0 | 2 |
| Player | 10 | 9 | 0 | 1 |
| Favorites | 11 | 0 | 1 | 10 |
| Rating and review | 9 | 5 | 0 | 4 |
| Listening statistics | 4 | 0 | 3 | 1 |
| Language and theme | 4 | 0 | 0 | 4 |
| Navigation | 2 | 0 | 1 | 1 |
| Recommendations | 16 | 6 | 9 | 1 |
| Cross-cutting API behavior | 2 | 0 | 0 | 2 |
| Journeys | 2 | 2 | 0 | 0 |
| **Total** | **117** | **32** | **36** | **49** |

By main level: CI 22, SYS 74, SIT 20, ACC 1. Several scenarios also name a second level.

The spread is deliberate. Player, session, privacy and review rules carry the P1 risks and get the most scenarios. Download, navigation, language and theme are low risk and get few.

### 15.2 Coverage by risk

| Risk | Priority | Scenarios |
|---|---|---|
| PR-01 | P1 | TS-PROF-01, TS-PROF-02 |
| PR-02 | P1 | TS-REV-02, TS-REV-04, TS-REV-07 |
| PR-03 | P1 | TS-REV-01, TS-REV-08 |
| PR-04 | P1 | TS-REC-09 |
| PR-05 | P1 | TS-REC-10 |
| PR-06 | P1 | TS-REC-12, TS-REC-13, TS-REC-14, TS-REC-15 |
| PR-07 | P1 | TS-AUTH-01, TS-AUTH-03, TS-AUTH-05, TS-AUTH-06, TS-AUTH-07, TS-AUTH-08, TS-AUTH-09, TS-E2E-02 |
| PR-08 | P1 | TS-SONG-01, TS-PLAY-01, TS-PLAY-02, TS-PLAY-03, TS-PLAY-04, TS-PLAY-05, TS-PLAY-06, TS-PLAY-07, TS-PLAY-08, TS-PLAY-10, TS-E2E-01, TS-E2E-02 |
| PR-09 | P2 | TS-AUTH-10, TS-AUTH-11, TS-E2E-02 |
| PR-10 | P2 | TS-AUTHZ-01, TS-AUTHZ-02, TS-AUTHZ-03, TS-AUTHZ-04, TS-AUTHZ-05, TS-AUTHZ-06 |
| PR-11 | P2 | TS-REG-06 |
| PR-12 | P2 | TS-SONG-06 |
| PR-13 | P2 | TS-FAV-01 |
| PR-14 | P2 | TS-DISC-07, TS-DISC-12, TS-SONG-02, TS-NAV-02 |
| PR-15 | P2 | TS-DISC-02, TS-STRM-01, TS-STRM-02, TS-STRM-03 |
| PR-16 | P2 | TS-SRCH-01, TS-SRCH-02, TS-SRCH-03, TS-SRCH-04, TS-SRCH-05, TS-SRCH-06, TS-SRCH-07, TS-SRCH-08 |
| PR-17 | P2 | TS-REC-01, TS-REC-05, TS-REC-06, TS-REC-07, TS-REC-08 |
| PR-18 | P2 | TS-REC-02, TS-REC-03, TS-REC-04, TS-REC-16 |
| PR-19 | P3 | TS-FAV-02, TS-FAV-03, TS-FAV-04, TS-FAV-06, TS-FAV-07 |
| PR-20 | P3 | TS-REC-11 |
| PR-21 | P3 | TS-DISC-01, TS-DISC-02, TS-DISC-03, TS-DISC-04, TS-DISC-05, TS-DISC-06, TS-DISC-08 |
| PR-22 | P3 | TS-REG-01, TS-REG-02, TS-REG-03, TS-REG-04, TS-REG-05, TS-REG-07, TS-REG-08 |
| PR-23 | P3 | TS-SONG-07, TS-DL-02, TS-REV-06 |
| PR-24 | P3 | TS-REV-05 |
| PR-25 | P3 | TS-L10N-01, TS-L10N-02, TS-L10N-03, TS-THEME-01 |
| PR-26 | P3 | TS-SRCH-09, TS-API-02 |

Test/project risks (TR-nn) are not covered by scenarios. They appear as dependencies, and they are handled by the entry conditions in `test-strategy.md` §8.5.

### 15.3 High-priority risks not fully covered (executable today)

Every P1 product risk has scenarios. The following P1 coverage **cannot run today**:

| Risk | Blocked scenarios | Reason |
|---|---|---|
| PR-02, PR-03 | TS-REV-02, 04, 07, 08 (TS-REV-01 needs no write and can run) | No approved write environment (TR-01) |
| PR-06 | TS-REC-13 | Write environment (TR-01) and comment approval (A-Q3) |
| PR-06 | TS-REC-14 (partly) | Allowlist not approved (A-Q2); UI sign-up capture blocked (TR-06) |
| PR-07 | TS-AUTH-07, TS-AUTH-08 | No short-token environment (TR-09) |
| PR-08 | TS-PLAY-10 | Expected behavior not agreed (A-Q18) |
| PR-04, PR-05 | TS-REC-09, TS-REC-10 | Executable, but the oracle needs A-Q1 |
| PR-01 | TS-PROF-01 | Profile endpoint not decided (A-Q16); assumed `auth/me` |

P2 coverage blocked: stream writes (TS-STRM-01, 03; TR-01), UI sign-up success (TS-REG-04; TR-06).

### 15.4 Unresolved assumptions

| Assumption | Used in |
|---|---|
| The profile endpoint is `GET /api/auth/me` | TS-PROF-01 |
| Refused reviews and ratings return an error status (code not decided) | TS-REV-07, TS-REV-08 |
| An unknown song id for favorite returns 400 | TS-FAV-06 |
| A tracker failure of any kind must at least leave the page usable | TS-REC-07, TS-REC-08 |
| Mode A can run with fully recorded configuration (spike pending) | TS-REC-02 to 08, TS-REC-11 |
| Song 1 stays available with MP3 and lyrics | Most playback scenarios |
| A song without lyrics, a song without reviews, titles of 25/26 characters, and an artist without a main genre exist in the catalog | TS-SONG-03, TS-REV-09, TS-PLAY-09, TS-DISC-10 |
| Dev-build behavior (duplicate requests, 2-3 control copies) is representative | TS-PLAY-08, all call-capture scenarios |

### 15.5 Areas needing clarification

| Topic | Question | Scenarios | Ref |
|---|---|---|---|
| Consent | Is an anonymous recommendation request allowed before a choice and after Decline? | TS-REC-09, 10 | A-Q1 |
| Privacy | Allowlist; review text; username as id | TS-REC-13, 14 | A-Q2, A-Q3, A-Q4 |
| Tracker failures and popup | Expected behavior for 4xx, timeout, malformed, partial items, config failure; popup blocking clicks | TS-REC-07, 08 | A-Q5, A-Q6 |
| Download events | Two events per click intended? | TS-REC-11 | A-Q7 |
| Reviews | Rejection status code, comment length limit | TS-REV-07, 08 | A-Q15 |
| Profile | Endpoint and UI | TS-PROF-01, 02 | A-Q16 |
| Sign-up | Real mailbox or approved mock | TS-REG-04, 08 | A-Q17 |
| MP3 failure | Expected player behavior | TS-PLAY-10 | A-Q18 |
| Streams | Replay, repeat-one, seek | TS-STRM-03 | U-1.7 |
| Refresh tokens | Is a rotated token still valid? Concurrent refreshes? | TS-AUTH-09 | U-2.4 |
| Username length | Behavior above 30 characters | TS-REG-07 | US-001 rules |
| API robustness | Expected response for `page=0`, `size=0`, missing keyword | TS-API-02, TS-SRCH-09 | UNK-43, UNK-44 |
| Rating modal | Empty-review text and close options | TS-REV-09 | US-017-AC-08 |
| Lyrics failure | Message or nothing? | TS-SONG-07 | US-011-AC-08 |
| Player | Seek bar, time display, playback across navigation | none yet | US-013-AC-10 |

### 15.6 Exploratory charters suggested by the risk register

Not scenarios, because the expected result is not known yet:
- other endpoints that return another user's data (PR-01);
- session across several tabs, and token expiry (PR-07);
- player controls on a production build (PR-08, TR-13);
- recommendations on `/search` and logged-in `/favorites`, sign-up and logout privacy capture (PR-04 to PR-06).

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Draft 1 |
| 2026-10-08 | Search with real data (TS-SRCH-07, TS-SRCH-08) no longer blocked: Elasticsearch key renewed |
