# PSMusic - Risk Register

| Item | Value |
|---|---|
| SUT | PSMusic (React SPA + ASP.NET Core API), read-only |
| Inputs | `docs/requirements/user-stories.md` (agreed expectation, stakeholder decisions 2026-10-01), `docs/exploration/exploration-validation.md`, `docs/exploration/{browser,repository,documentation}/`, `test-strategy.md`, `levels/*.md` |
| Status | Draft 1, 2026-10-01. Updated 2026-10-08: TR-05 reclassified after the Elasticsearch key renewal |
| Feeds | Test Scenario Design, Automation Analysis, Manual Test Design |

This register lists the risks that should drive test coverage and effort. It contains test **conditions** (what must be checked), not test scenarios or cases. Reference abbreviations follow `test-strategy.md` ("How to read the references"). Functional areas `FA-nn` are defined in `test-strategy.md` §3.

Areas that do not exist in PSMusic are not analysed: cart, checkout, order creation, payment, order lifecycle, cancellation, admin/roles.

---

## 1. Classification rules

The rules are fixed first, then applied. Each risk states which rule it meets.

### 1.1 Likelihood

| Level | Rule (any one is enough) |
|---|---|
| **High** | The failure is **confirmed**: observed at runtime, or proven by reading the source (no guard exists). Or the problem was observed repeatedly. Or the cause is a known environment condition that is present today |
| **Medium** | Not confirmed, but the code path is untested **and** at least one complexity factor applies: async ordering, several dependencies, shared or time-dependent state, remotely changing configuration, or a single observation only |
| **Low** | Observed working (more than once, or by both source and runtime) and the path is simple. Or checked and not found (for example no password in tracker traffic) |

### 1.2 Severity

| Level | Rule |
|---|---|
| **Critical** | Personal data exposed to other users or third parties, or sent against the user's consent. Permanent corruption of shared data that cannot be repaired. The core journey (open and play a song) unusable for everyone |
| **High** | A member feature broken or wrong for all users. A security or authorization control weakened. Wrong data persisted. For test risks: a business-critical area cannot be tested, or test results cannot be trusted |
| **Medium** | Feature degraded with a workaround (reload, close a popup). Wrong display that corrects itself. Missing feedback on an error. For test risks: an area is delayed or needs extra effort |
| **Low** | Cosmetic, text or format issue with no functional effect |

Financial impact is not applicable: PSMusic has no payments.

### 1.3 Priority

| Likelihood \ Severity | Critical | High | Medium | Low |
|---|---|---|---|---|
| **High** | P1 | P1 | P2 | P3 |
| **Medium** | P1 | P2 | P3 | P3 |
| **Low** | P2 | P3 | P3 | P3 |

**Business-importance adjustment:** raise one level, at most to P1, when the area is part of the core journey (session, playback) or the stakeholder rated it Critical (US-022). Every adjustment is stated in the risk. No risk is lowered.

| Priority | Meaning for testing |
|---|---|
| P1 | Must be covered before any release. Gate or critical regression. Exploratory session required |
| P2 | Covered in critical or broader regression. Exploratory if the area is unclear |
| P3 | Broader regression or manual checks; may be sampled |

---

## 2. Summary

### 2.1 Product risks

| ID | Area | Risk (short) | L | S | P | Stories | FA |
|---|---|---|---|---|---|---|---|
| PR-01 | Authorization | Any signed-in user can read another user's profile, including email | High | Critical | **P1** | US-023-AC-03 | FA-03 |
| PR-02 | Review / data integrity | Server accepts a second review by the same user for the same song | High | High | **P1** | US-017-AC-09 | FA-10 |
| PR-03 | Review / data integrity | Server accepts ratings outside 1 to 5 | High | High | **P1** | US-017-AC-10 | FA-10 |
| PR-04 | Third party / privacy | Data and identity sent to the recommendation service before a consent choice | High | Critical | **P1** | US-022-AC-17 | FA-14 |
| PR-05 | Third party / privacy | Behavior and identity sent after Decline | High | Critical | **P1** | US-022-AC-14/15 | FA-14 |
| PR-06 | Third party / privacy | Unapproved or sensitive data sent to the tracker (now or after a remote rule change) | Medium | Critical | **P1** | US-022-AC-10/11/13 | FA-14 |
| PR-07 | Authentication | Session not restored, refresh or 401-retry fails, user logged out unexpectedly | Medium | High | **P1** (raised) | US-003 | FA-02 |
| PR-08 | Core / playback | Song cannot be played or controlled correctly | Medium | High | **P1** (raised) | US-013, US-011 | FA-08, FA-06 |
| PR-09 | Authentication | Logout lands on `/auth` instead of `/` | High | Medium | P2 | US-004-AC-01 | FA-02 |
| PR-10 | Authorization | Guest can reach members-only actions, or protected endpoints answer without a token | Medium | High | P2 | US-014, US-016-AC-07, US-020-AC-04 | FA-03 |
| PR-11 | Authentication | Password returned in a response or stored in clear | Low | Critical | P2 | US-001-AC-06 | FA-01 |
| PR-12 | UI synchronization | Heart/star show "not favorited / not reviewed" after a hard reload | High | Medium | P2 | US-011-AC-06 | FA-06 |
| PR-13 | UI synchronization | Like count on the song page not updated after favoriting | High | Medium | P2 | US-015-AC-01 | FA-09 |
| PR-14 | API failures / error handling | Unknown category, artist or route shows a blank page; API returns 204 | High | Medium | P2 | US-007-AC-05, US-009-AC-05, US-020-AC-05 | FA-04, FA-13 |
| PR-15 | Data integrity | Streams counted wrongly (none, duplicates, guests), so popularity lists are wrong | Medium | High | P2 | US-021 | FA-11, FA-04 |
| PR-16 | Search | Search logic wrong once the index works (threshold, Top result, size clamp, empty state) | Medium | High | P2 | US-010 | FA-05 |
| PR-17 | Third party | Recommendation popup blocks core controls; tracker failure degrades the page | High | Medium | P2 | US-022-AC-04, F-2 | FA-14 |
| PR-18 | Third party | Recommendation card shows or opens the wrong song | Low | Medium | P2 (raised) | US-022-AC-07/08/09 | FA-14 |
| PR-19 | Favorites / concurrency | Favorite state wrong after fast or concurrent toggles; `/favorites` stale | Medium | Medium | P3 | US-015-AC-03/04/05, US-016 | FA-09 |
| PR-20 | Third party / telemetry | Behavior tracking silently stops after an app class or API path change | Medium | Medium | P3 | US-022-AC-13/16 | FA-14 |
| PR-21 | Browsing | Popular genres/artists/charts wrong order or limits; stale after caches | Medium | Medium | P3 | US-005, US-006, US-008, US-021-AC-03/04 | FA-04 |
| PR-22 | Registration | Registration rules wrong (uniqueness, length, display name 30) | Medium | Medium | P3 | US-001 | FA-01 |
| PR-23 | Error handling | Errors swallowed without user feedback (download, rating submit, lyrics) | Medium | Medium | P3 | US-012-AC-02, US-017-AC-06, US-011-AC-08 | FA-07, FA-10, FA-06 |
| PR-24 | Review | New review shows date `30/9/2026` instead of `yyyy-MM-dd` | High | Low | P3 | US-017-AC-05 | FA-10 |
| PR-25 | Localization | Missing translations; language or theme not persisted | High | Low | P3 | US-018, US-019 | FA-12 |
| PR-26 | API robustness | `page=0`, `size=0` or missing `keyword` cause server errors | Medium | Low | P3 | "Technical behaviors" | FA-04, FA-05 |

### 2.2 Test / project risks

| ID | Area | Risk (short) | L | S | P |
|---|---|---|---|---|---|
| TR-01 | Test data / environment | Writes go to a shared remote database; reviews and streams cannot be deleted | High | High | **P1** |
| TR-02 | Environment | No CI environment for the SUT (URLs, certificate, secrets) | High | High | **P1** |
| TR-03 | Automation reliability | Fragile locators: no test ids, hashed classes, duplicated player controls, language-dependent names | High | High | **P1** |
| TR-04 | Third-party dependency | Recsys free-tier host is unstable and overlays block clicks in every suite | High | High | **P1** |
| TR-05 | Third-party dependency | Search index filled only at API startup (key renewed 2026-10-08; search confirmed working) | Medium | Medium | P3 |
| TR-06 | Test data | No test account with a known password; UI sign-up needs a real mailbox | High | Medium | P2 |
| TR-07 | Automation reliability | Async timing: session restore, route content swap, duplicate requests, audio buffering | High | Medium | P2 |
| TR-08 | Test data | Shared counters, random queues and time-dependent popularity make assertions unstable | High | Medium | P2 |
| TR-09 | Environment | 60-minute token lifetime: expiry and retry paths cannot be exercised | High | Medium | P2 |
| TR-10 | Documentation | Only the README and stakeholder answers are requirements; several defects are source-only | Medium | Medium | P3 |
| TR-11 | Third-party dependency | Recsys rules and loader change remotely; Mode A feasibility unproven; real-mode traffic pollutes the service's data | Medium | High | P2 |
| TR-12 | Security of test assets | Secrets (service key, tokens, domain key) leak into the repo or CI artifacts | Medium | High | P2 |
| TR-13 | Environment | Dev build behaves differently from the production build | Medium | Medium | P3 |

---

## 3. Product risks (detail)

### PR-01 Cross-user profile read exposes personal data
| Field | Value |
|---|---|
| Area | Authorization |
| Risk | A signed-in user calls `GET /api/user/{id}` with another user's id and receives that user's data, including the email |
| Cause | The endpoint has no ownership check |
| Potential impact | Personal data of every user exposed to any registered user (ids are sequential integers) |
| Evidence | US-023-AC-03 DEFECT (source only); `exploration-validation.md` §2; UNK-64 |
| Likelihood | **High**: proven by source (no guard exists) |
| Severity | **Critical**: personal data exposed to other users |
| Priority | **P1** |
| Detection | System level through the API with two users; component integration for the 401 without a token |
| Mitigation | Report to the SUT team now. Test asserts the story (`@known-defect`). Confirm at runtime in an approved environment |
| Stories | US-023-AC-01/02/03; SD-8 |
| Candidate conditions | TC-PR01-1 own profile readable, password never returned; TC-PR01-2 another user's profile refused; TC-PR01-3 no token → 401 |

### PR-02 Duplicate reviews accepted by the server
| Field | Value |
|---|---|
| Area | Review, data integrity |
| Risk | A user posts a second review for the same song through the API (the UI hides the form, the server does not refuse) |
| Cause | No uniqueness check in the server |
| Potential impact | Review counts and averages inflated permanently; no delete or edit API to repair |
| Evidence | US-017-AC-09 DEFECT (source only); BR-R3; SD-7 |
| Likelihood | **High**: proven by source |
| Severity | **High**: wrong data persisted, cannot be repaired. Not Critical because no personal data is involved |
| Priority | **P1** |
| Detection | System level through the API |
| Mitigation | Report; known-defect test. **Run only in an approved write environment** (TR-01) |
| Stories | US-017-AC-04/09 |
| Candidate conditions | TC-PR02-1 second review by the same user refused (status to be decided, A-Q15); TC-PR02-2 review count unchanged after refusal; TC-PR02-3 UI shows rated state and hides the form |

### PR-03 Rating outside 1 to 5 accepted
| Field | Value |
|---|---|
| Area | Review, data integrity |
| Risk | Ratings such as 0, 6 or negative values are stored |
| Cause | No range validation on the server |
| Potential impact | Corrupted ratings; permanent |
| Evidence | US-017-AC-10 DEFECT (source only); UNK-49 |
| Likelihood | **High** (source) |
| Severity | **High** (same reasoning as PR-02) |
| Priority | **P1** |
| Detection | System level through the API (boundary values) |
| Mitigation | As PR-02. Comment length limit still undecided (A-Q15) |
| Stories | US-017-AC-01/10 |
| Candidate conditions | TC-PR03-1 values 1 and 5 accepted; TC-PR03-2 values 0, 6, negative refused; TC-PR03-3 UI submit disabled without a star |

### PR-04 Data sent to the recommendation service before a consent choice
| Field | Value |
|---|---|
| Area | Third party, privacy |
| Risk | While the privacy banner is still shown, `/recommendation` is sent with `UserId` and `AnonymousId` |
| Cause | Tracker sends on load, before the consent decision |
| Potential impact | Identity shared without consent; breaks stakeholder decision SD-9 |
| Evidence | US-022-AC-17 DEFECT (runtime); REC §8.5 |
| Likelihood | **High** (runtime) |
| Severity | **Critical** (data sent without consent); US-022 rated Critical by the stakeholder |
| Priority | **P1** |
| Detection | System integration, real mode, network capture (`@recsys-privacy`) |
| Mitigation | Report to the recsys team; known-defect test; clarify whether an anonymous request is allowed (A-Q1) |
| Stories | US-022-AC-17, SD-9 |
| Candidate conditions | TC-PR04-1 no request with identity before a choice; TC-PR04-2 no behavior event before a choice |

### PR-05 Behavior and identity sent after Decline
| Field | Value |
|---|---|
| Area | Third party, privacy |
| Risk | After Decline, `/evaluation` and `push-keyword` are still sent, and `UserId`/`AnonymousId` are still included |
| Cause | Tracker consent handling incomplete |
| Potential impact | User's refusal ignored |
| Evidence | US-022-AC-14/15 DEFECT (runtime); REC §8.5, §8.8 |
| Likelihood | **High** (runtime) |
| Severity | **Critical** |
| Priority | **P1** |
| Detection | System integration, real mode, network capture |
| Mitigation | Report; known-defect tests; re-check all card types (REC §8.8) after a fix |
| Stories | US-022-AC-14/15 |
| Candidate conditions | TC-PR05-1 no `/event`, `/evaluation`, `push-keyword` after Decline; TC-PR05-2 no identity in any request after Decline; TC-PR05-3 recommendations still shown and clickable after Decline |

### PR-06 Unapproved or sensitive data sent to the tracker
| Field | Value |
|---|---|
| Area | Third party, privacy |
| Risk | A password, email, token, service key, profile field or free text (review comment, search keyword) reaches the tracker without approval |
| Cause | What is tracked is set by remote rules that can change without any app change; rule 166 sends review comments |
| Potential impact | Sensitive data leak to a third party |
| Evidence | Nothing sensitive was found in the captured traffic (REC §8.4). Review comment text is sent by rule 166 (REC §8.7). AC-13: rules can change at any time |
| Likelihood | **Medium**: not observed today, but remote configuration changes and free-text fields are two of the complexity factors |
| Severity | **Critical** |
| Priority | **P1** |
| Detection | System integration: allowlist and canary checks (`levels/system-integration.md` §3.9); nightly config drift |
| Mitigation | Approved allowlist (A-Q2, A-Q3); nightly drift detection; manual privacy review of new fields |
| Stories | US-022-AC-10/11/12/13/16 |
| Candidate conditions | TC-PR06-1 canaries never appear in tracker traffic; TC-PR06-2 only allowlisted fields per endpoint; TC-PR06-3 identity only `UserId` and `AnonymousId`; TC-PR06-4 no event without interaction; TC-PR06-5 rule/config unchanged vs approved snapshot |

### PR-07 Session handling fails
| Field | Value |
|---|---|
| Area | Authentication |
| Risk | Reload does not restore the session, a 401 does not trigger one refresh and retry, or a failed refresh does not log out cleanly |
| Cause | Async restore (refresh fires twice on load), token kept in memory only, refresh-token rotation |
| Potential impact | Users lose their session or see a half-logged-in state |
| Evidence | Restore works at runtime (US-003-AC-01/02/03 confirmed). AC-04/05 not run (60-minute token). Two concurrent refreshes observed (`B:authentication.md` §1); rotation reuse unknown (U-2.4) |
| Likelihood | **Medium**: untested paths + async ordering + rotation |
| Severity | **High**: every member feature depends on it |
| Priority | **P1** (raised from P2: session is part of the core journey) |
| Detection | Component integration (refresh contract); system (reload, expiry once TR-09 is solved) |
| Mitigation | Short-token environment; exploratory session on multiple tabs and expiry |
| Stories | US-002-AC-03, US-003 |
| Candidate conditions | TC-PR07-1 reload with a valid cookie restores the user; TC-PR07-2 no cookie → guest, refresh 200 `isSuccess:false`; TC-PR07-3 expired token → one refresh + retry; TC-PR07-4 failed refresh → logout, cache cleared, `/` |

### PR-08 Playback fails or misbehaves
| Field | Value |
|---|---|
| Area | Core functionality |
| Risk | A song does not start, controls act twice or not at all, queue or repeat/shuffle wrong |
| Cause | Audio from S3, player controls rendered 2-3 times (F-3), random next batch, client state |
| Potential impact | Core product value lost |
| Evidence | Play/pause/next/previous confirmed. Repeat, shuffle, volume, auto-advance not run (US-013 status). F-3 duplicated controls |
| Likelihood | **Medium**: untested controls + external media + duplicated components |
| Severity | **High** |
| Priority | **P1** (raised: core journey) |
| Detection | System (UI with state and network checks); SIT for S3 failures |
| Mitigation | Exploratory session on controls; ask for test ids (TR-03) |
| Stories | US-013, US-011-AC-04 |
| Candidate conditions | TC-PR08-1 play shows the player and audio advances; TC-PR08-2 pause/play toggle; TC-PR08-3 next/previous, batch refill at ≤ 3 left; TC-PR08-4 repeat cycle; TC-PR08-5 shuffle keeps the current song first; TC-PR08-6 volume default 70 and mute restore; TC-PR08-7 auto-advance at song end; TC-PR08-8 guest can play |

### PR-09 Logout lands on the wrong page
| Field | Value |
|---|---|
| Area | Authentication |
| Evidence | US-004-AC-01 DEFECT (runtime, one run from `/favorites`); U-3.11 public page not tested |
| Cause | Protected-route guard fires before or after `navigate("/")` (inferred) |
| Impact | User lands on the login page after logging out; session itself is cleared |
| L / S / P | **High** (runtime) / **Medium** (workaround, no data effect) / **P2** |
| Detection | System (UI) |
| Mitigation | Known-defect test; check logout from public pages |
| Stories | US-004 |
| Candidate conditions | TC-PR09-1 logout from a protected page lands on `/`; TC-PR09-2 logout from a public page lands on `/`; TC-PR09-3 reload after logout stays guest; TC-PR09-4 logout API deletes the cookie |

### PR-10 Guest reaches members-only actions
| Field | Value |
|---|---|
| Area | Authorization |
| Evidence | Sidebar and URL redirects work (UF-04). Player heart/rate as guest not tested (U-3.2). Protected endpoints return 401 (`B:authentication.md` §5) |
| Cause | Gating is client-side per control |
| Impact | Confusing errors or unauthorized calls |
| L / S / P | **Medium** (partly untested, several entry points) / **High** (control weakened) / **P2** |
| Detection | System (UI); component integration (401) |
| Stories | US-014, US-016-AC-07, US-020-AC-04 |
| Candidate conditions | TC-PR10-1 guest heart/rate → modal, no API call; TC-PR10-2 `/favorites` and `/recent` → `/auth`; TC-PR10-3 protected endpoints → 401 without a token; TC-PR10-4 modal close options and scroll lock |

### PR-11 Password exposed
| Field | Value |
|---|---|
| Evidence | BCrypt in source; no password in observed responses |
| L / S / P | **Low** (checked) / **Critical** / **P2** |
| Detection | Component integration (all auth and user responses) |
| Stories | US-001-AC-06, US-023-AC-01 |
| Candidate conditions | TC-PR11-1 no response contains a password or hash |

### PR-12 Heart/star state wrong after a hard reload
| Field | Value |
|---|---|
| Evidence | US-011-AC-06 DEFECT; F-5 (detail request sent before refresh completes) |
| L / S / P | **High** / **Medium** (correct after in-app navigation) / **P2** |
| Detection | System (UI after reload, compared with `/player`) |
| Stories | US-011-AC-06 |
| Candidate conditions | TC-PR12-1 favorited and reviewed song shows filled icons after a hard reload; TC-PR12-2 same after in-app navigation |

### PR-13 Like count not updated after favoriting
| Field | Value |
|---|---|
| Evidence | US-015-AC-01 DEFECT; F-6 |
| L / S / P | **High** / **Medium** (corrects on reload) / **P2** |
| Detection | System (UI delta) + component integration (read-back) |
| Stories | US-015-AC-01/02 |
| Candidate conditions | TC-PR13-1 count +1 after favoriting, −1 after unfavoriting, never below 0 |

### PR-14 Missing not-found states
| Field | Value |
|---|---|
| Evidence | US-007-AC-05, US-009-AC-05, US-020-AC-05 DEFECTS (runtime + source); SD-4 |
| L / S / P | **High** / **Medium** (blank page, user can navigate away) / **P2** |
| Detection | Component integration (404 status); system (visible message) |
| Stories | US-007-AC-05, US-009-AC-05, US-011-AC-02, US-020-AC-05 |
| Candidate conditions | TC-PR14-1 unknown category/artist → API 404; TC-PR14-2 visible not-found message for unknown category, artist, song, route |

### PR-15 Stream counting wrong
| Field | Value |
|---|---|
| Evidence | One stream at ~20 s observed once (BR-P1). Dedup on replay/seek/repeat unknown (UNK / U-1.7). Guest at 20 s not reached (U-3.1) |
| Cause | Time-based client trigger; rule spread over client and server |
| Impact | Charts and trending lists wrong; rows permanent |
| L / S / P | **Medium** (single observation, timing) / **High** (shared ranking data, permanent) / **P2** |
| Detection | System through the API + one UI playback check. Approved write environment only |
| Stories | US-021-AC-01/02/03 |
| Candidate conditions | TC-PR15-1 exactly one stream after ≥ 20 s; TC-PR15-2 none before 20 s; TC-PR15-3 none for guests; TC-PR15-4 behavior on replay, repeat-one and seek (expected to be confirmed) |

### PR-16 Search logic wrong once the index works
| Field | Value |
|---|---|
| Evidence | US-010 unblocked 2026-10-08; API search confirmed (Top result, size clamp, empty result, `B:search.md`); repository behavior is the expected behavior (SD-1); suggestion empty state never seen in the browser; artists repeat on every results page (observation) |
| L / S / P | **Medium** (never observed working; debounce, blur timing, ES dependency) / **High** (README feature) / **P2** |
| Detection | System (UI with fulfilled responses); SIT real mode, now runnable (TR-05) |
| Stories | US-010 |
| Candidate conditions | TC-PR16-1 no request under 2 chars; TC-PR16-2 suggestions after 300 ms with loading and empty states; TC-PR16-3 Enter opens `/search?q=<trimmed>`; TC-PR16-4 tabs and limits; TC-PR16-5 Top result on exact match; TC-PR16-6 empty message; TC-PR16-7 clear button; TC-PR16-8 size clamp |

### PR-17 Recommendation popup and failures degrade the page
| Field | Value |
|---|---|
| Evidence | Popup intercepts clicks on player and modal buttons (F-2, high for automation, medium for users). Failure handling observed correct on Home; Song/Category only for abort (REC §8.3) |
| L / S / P | **High** (popup blocking observed) / **Medium** (close button workaround) / **P2** |
| Detection | SIT controlled mode (resilience matrix) |
| Stories | US-022-AC-02/04 |
| Candidate conditions | TC-PR17-1 page usable with tracker down/5xx/empty/timeout/malformed; TC-PR17-2 heading stays, section empty; TC-PR17-3 core controls usable while the popup is shown (expected behavior A-Q6) |

### PR-18 Recommendation card opens the wrong song
| Field | Value |
|---|---|
| Evidence | All 50 Home cards matched the response; clicks 1, 25, 50 correct (REC §8.2). Song/Category/popup comparison not complete (EV §6) |
| L / S / P | **Low** / **Medium** / **P2** (raised: US-022 rated Critical) |
| Detection | SIT controlled mode |
| Stories | US-022-AC-01/07/08/09 |
| Candidate conditions | TC-PR18-1 card n shows item n; TC-PR18-2 click opens `/song/{DomainItemId}` in the same tab with `Rank = n`; TC-PR18-3 for first/middle/last, inline and popup |

### PR-19 Favorite state inconsistent
| Field | Value |
|---|---|
| Evidence | Toggle works (BR-F1); read-modify-write race possible (UNK-48); disabled-while-in-flight not tested |
| L / S / P | **Medium** / **Medium** / **P3** |
| Stories | US-015-AC-03/04/05, US-016 |
| Candidate conditions | TC-PR19-1 heart disabled during the request; TC-PR19-2 `/favorites` correct after a toggle; TC-PR19-3 re-toggle reuses the record |

### PR-20 Telemetry silently breaks
| Field | Value |
|---|---|
| Evidence | Rules match app classes and API paths (REC §8.7); classes are hashed and matched loosely |
| L / S / P | **Medium** / **Medium** (no user impact; loss of data for another team) / **P3** |
| Detection | SIT controlled mode (event wiring) |
| Stories | US-022-AC-13/16 |
| Candidate conditions | TC-PR20-1 each song-card type produces its expected event after consent |

### PR-21 Popularity lists wrong
| Field | Value |
|---|---|
| Evidence | Ordering depends on 7-day streams; Charts order 10, 26, 2, 1 differs from API order (BR-C2); 15-minute client and 10-minute server caches (R-13) |
| L / S / P | **Medium** / **Medium** / **P3** |
| Stories | US-005-AC-01/02/05, US-006, US-008, US-021-AC-03/04 |
| Candidate conditions | TC-PR21-1 section limits (8 genres, 10 artists, 6 sections, 10 charts × 10); TC-PR21-2 ordering by 7-day streams; TC-PR21-3 empty states |

### PR-22 Registration rules wrong
| Field | Value |
|---|---|
| Evidence | Duplicate messages confirmed (BR-A4); long username behavior unknown ("likely rejected") |
| L / S / P | **Medium** / **Medium** / **P3** |
| Stories | US-001 |
| Candidate conditions | TC-PR22-1 empty fields and short password blocked client-side; TC-PR22-2 duplicate email/username messages; TC-PR22-3 username length > 30 |

### PR-23 Errors swallowed without feedback
| Field | Value |
|---|---|
| Evidence | Many client `catch {}` blocks (R-14); error paths not exercised |
| L / S / P | **Medium** / **Medium** / **P3** |
| Stories | US-012-AC-02, US-017-AC-06, US-011-AC-08 |
| Candidate conditions | TC-PR23-1 download failure toast; TC-PR23-2 rating submit failure message; TC-PR23-3 lyric fetch failure handled |

### PR-24 Review date format
| L / S / P | **High** (runtime + source) / **Low** / **P3** |
|---|---|
| Stories | US-017-AC-05 |
| Candidate conditions | TC-PR24-1 new review shows `yyyy-MM-dd`, newest first |

### PR-25 Localization and personalization gaps
| L / S / P | **High** (missing key `genre_category` seen) / **Low** / **P3** |
|---|---|
| Stories | US-018, US-019 |
| Candidate conditions | TC-PR25-1 language switch and `<html lang>`; TC-PR25-2 persistence after reload; TC-PR25-3 fallback to English; TC-PR25-4 translation completeness (manual); TC-PR25-5 theme applied and persisted |

### PR-26 Paging and parameter robustness
| L / S / P | **Medium** (no validation in code, UNK-43/44) / **Low** (no UI caller sends these values) / **P3** |
|---|---|
| Stories | "Technical behaviors" |
| Candidate conditions | TC-PR26-1 `page=0`, `size=0`, missing `keyword` do not return 500 (expected result to be agreed) |

### Considered and not registered

| Item | Reason |
|---|---|
| Login reveals whether a username exists (F-9) | Intended (SD-10) |
| Gmail-only rule enforced only in the UI | Intended (SD-10) |
| Previous username sent to the tracker after logout (F-R1) | Accepted by the stakeholder (REC §8.6). Kept in front of the product owner as A-Q4 |
| Favorites order not persisted | Intended (SD-10) |
| `X-App-Service-Key` visible in the browser | Documented technical behavior; handled as a test-asset risk (TR-12) |
| Access token valid after logout | Documented rule (US-004 rules) |

---

## 4. Test / project risks (detail)

| ID | Risk | Cause | Impact on testing | Evidence | L | S | P | Mitigation | Affected |
|---|---|---|---|---|---|---|---|---|---|
| TR-01 | Test writes pollute a shared database that cannot be cleaned | Local API uses a remote shared PostgreSQL; reviews and streams have no delete path | P1 rules PR-02, PR-03, PR-15 cannot be run safely; other users' data affected | `B:test-data.md` §1; "Technical behaviors"; EV §6 | High | High | **P1** | Approved write environment or cleanup plan from the SUT team; `@write-permanent` tag; until then design only | PR-02, PR-03, PR-15, US-017, US-021 |
| TR-02 | No CI environment for the SUT | No URLs, certificate or secrets in CI; app repo cannot trigger this repo yet | No automated feedback at all in CI | `.github/workflows/playwright.yml`; `test-strategy.md` §8.5 | High | High | **P1** | Ask the SUT team; first CI milestone is lint/type-check plus a reachability check that skips with a reason | All |
| TR-03 | Fragile locators | No test ids; hashed CSS-module classes; icon buttons without names; player controls 2-3 times; names change with language | Tests break on harmless UI changes; false failures | EV §7; F-3; R-2; R-3 | High | High | **P1** | Pin language; prefer `href`/role/heading; scope player to its wrapper; request test ids from the SUT team | PR-08, PR-10, PR-12, PR-13 |
| TR-04 | Recsys tracker unstable and intrusive | Free-tier host; cold starts; "no render" periods; banner and popup intercept clicks | Random failures in any UI suite | F-2; REC §8.1, §8.9 | High | High | **P1** | Block the tracker outside SIT (`levels/system.md` §4); SIT preflight and classification | All UI; PR-04 to PR-06, PR-17, PR-18 |
| TR-05 | Search results depend on index state | Until 2026-10-08 the Elasticsearch key was outdated and every search was empty (SD-1, F-1). The key is now renewed and `ElasticSeeder` (SUT commit `d1a3c44`) copies all songs and artists from PostgreSQL into the indices at every API startup. Songs added after startup are missing and deleted songs stay until the next restart; seeding errors are only logged | Real-result assertions can fail when the index is stale or seeding failed; PR-16 confirmed through the API, browser pending | User-stories SD-1 update; `R:application-overview.md` §2.3; `B:search.md` | Medium | Medium | P3 | Pick test titles from songs that exist before the API starts; a preflight search for a known title before real-mode tests, classified as environment on failure; UI logic still also tested with fulfilled responses | PR-16 |
| TR-06 | No usable test accounts | Existing QA accounts have no stored password; UI sign-up needs a real Gmail mailbox and uses third-party quota | Smoke login depends on the register API; UI sign-up success untestable | `B:test-data.md` §1-2; US-001 BLOCKED | High | Medium | P2 | Create users through the API; one provisioned account in CI secrets; decision on a sign-up mock (A-Q17) | PR-07, PR-22 |
| TR-07 | Async timing | Refresh fires twice; route changes before content; duplicate dev requests; audio buffers ~4 s | Flaky waits | `B:automation-considerations.md` AC-5; F-4 | High | Medium | P2 | Web-first assertions, response waits, `expect.poll`; never count calls | PR-07, PR-08, PR-12 |
| TR-08 | Unstable data | Shared counters changed by others; random next batch and shuffle; popularity depends on time | Assertions on absolute values fail randomly | `B:test-data.md` §4; R-4; R-5 | High | Medium | P2 | Delta assertions; invariants instead of specific songs; check data presence first | PR-13, PR-15, PR-21 |
| TR-09 | Token expiry not testable | 60-minute access-token lifetime | US-003-AC-04/05 unverified | US-003 status; U-2.3 | High | Medium | P2 | Environment with a short token lifetime | PR-07 |
| TR-10 | Weak requirement basis | No formal requirements; several defects proven only by source | Wrong oracles; disputes about expected results | `D:documentation-gaps-and-conflicts.md` G-11 to G-22; EV §1 | Medium | Medium | P3 | `user-stories.md` is the single oracle; open decisions tracked in `levels/acceptance.md` | PR-01 to PR-03, PR-16 |
| TR-11 | Recsys integration testing hard to control | Rules and `loader.js` change remotely; Mode A with fully mocked config not yet tried; real-mode clicks and events enter the service's data | Stale fixtures; noisy real mode; data pollution | AC-13; REC §8.3; `levels/system-integration.md` §3.5 | Medium | High | P2 | Spike for Mode A first; nightly drift detection; test domain key (A-Q8) | PR-04 to PR-06, PR-17, PR-18, PR-20 |
| TR-12 | Secrets leak through test assets | Service key, tokens and domain key in traffic and traces; secrets committed in the SUT repo | Secret exposure from this repo or CI artifacts | R-12; `B:application-overview.md` secrets policy | Medium | High | P2 | `.env` and CI secrets only; redaction; no traces in real mode; short retention | All |
| TR-13 | Dev build differs from production | Vite dev server with StrictMode | Call counts and locator assumptions may not hold in production | F-4; U-3.10 | Medium | Medium | P3 | One comparison on a production build | PR-08, TR-07 |

---

## 5. Risk-based coverage for P1 risks

Levels follow `test-strategy.md` §4: CI = component integration, SYS = system, SIT = system integration, ACC = acceptance.

| Risk | Functionality to cover | Important conditions | Levels | Exploratory? |
|---|---|---|---|---|
| PR-01 | `GET /api/user/{id}`, `GET /api/auth/me` | TC-PR01-1/2/3 | SYS (API), CI | Yes: other user-data endpoints for the same gap (API exploration) |
| PR-02 | Review submission, review count | TC-PR02-1/2/3 | SYS (API), SYS (UI rated state) | No, rule is clear; needs the write environment |
| PR-03 | Review submission | TC-PR03-1/2/3 | SYS (API) | No |
| PR-04 | Tracker traffic before a choice | TC-PR04-1/2 | SIT (real mode) | Yes: every route and both identities |
| PR-05 | Tracker traffic after Decline | TC-PR05-1/2/3 | SIT (real mode), ACC (sign-off) | Yes: all card types, search, rating/review once writes are allowed |
| PR-06 | All tracker endpoints | TC-PR06-1 to 5 | SIT (real mode), ACC (allowlist approval) | Yes: after each rule change; sign-up and logout capture not covered yet |
| PR-07 | Login, reload, refresh, 401 retry, failed refresh | TC-PR07-1 to 4 | CI, SYS | Yes: multiple tabs, expiry, rotation reuse |
| PR-08 | Player controls, song page Play | TC-PR08-1 to 8 | SYS, SIT (S3 failures), ACC (audio quality) | Yes: controls not yet run, duplicated control behavior |
| TR-01 to TR-04 | Not product functionality. Each is an entry condition in `test-strategy.md` §8.5; the P1 product risks above that depend on them stay **designed but not executed** until solved. TR-05 (search) is no longer an entry blocker since the key renewal on 2026-10-08 | - | - | - |

---

## 6. Traceability

The chain is Risk → Story → Functional area → Test condition → Scenario. The scenario column is filled during Test Scenario Design.

| Risk | Stories | FA | Test conditions | Level | Scenario (later) |
|---|---|---|---|---|---|
| PR-01 | US-023 | FA-03 | TC-PR01-1..3 | SYS, CI | - |
| PR-02 | US-017 | FA-10 | TC-PR02-1..3 | SYS | - |
| PR-03 | US-017 | FA-10 | TC-PR03-1..3 | SYS | - |
| PR-04 | US-022 | FA-14 | TC-PR04-1..2 | SIT | - |
| PR-05 | US-022 | FA-14 | TC-PR05-1..3 | SIT | - |
| PR-06 | US-022 | FA-14 | TC-PR06-1..5 | SIT, ACC | - |
| PR-07 | US-002, US-003 | FA-02 | TC-PR07-1..4 | CI, SYS | - |
| PR-08 | US-011, US-013 | FA-06, FA-08 | TC-PR08-1..8 | SYS, SIT | - |
| PR-09 | US-004 | FA-02 | TC-PR09-1..4 | SYS, CI | - |
| PR-10 | US-014, US-016, US-020 | FA-03 | TC-PR10-1..4 | SYS, CI | - |
| PR-11 | US-001, US-023 | FA-01 | TC-PR11-1 | CI | - |
| PR-12 | US-011 | FA-06 | TC-PR12-1..2 | SYS | - |
| PR-13 | US-015 | FA-09 | TC-PR13-1 | SYS, CI | - |
| PR-14 | US-007, US-009, US-011, US-020 | FA-04, FA-13 | TC-PR14-1..2 | CI, SYS | - |
| PR-15 | US-021 | FA-11 | TC-PR15-1..4 | SYS | - |
| PR-16 | US-010 | FA-05 | TC-PR16-1..8 | SYS, SIT | - |
| PR-17 | US-022 | FA-14 | TC-PR17-1..3 | SIT | - |
| PR-18 | US-022 | FA-14 | TC-PR18-1..3 | SIT | - |
| PR-19 | US-015, US-016 | FA-09 | TC-PR19-1..3 | SYS | - |
| PR-20 | US-022 | FA-14 | TC-PR20-1 | SIT | - |
| PR-21 | US-005, US-006, US-008, US-021 | FA-04 | TC-PR21-1..3 | SYS | - |
| PR-22 | US-001 | FA-01 | TC-PR22-1..3 | SYS, CI | - |
| PR-23 | US-011, US-012, US-017 | FA-06, FA-07, FA-10 | TC-PR23-1..3 | SYS, SIT | - |
| PR-24 | US-017 | FA-10 | TC-PR24-1 | SYS | - |
| PR-25 | US-018, US-019 | FA-12 | TC-PR25-1..5 | SYS, ACC | - |
| PR-26 | "Technical behaviors" | FA-04, FA-05 | TC-PR26-1 | CI | - |

Stories without a registered product risk: US-006 (only through PR-21), US-012-AC-01/03 (download naming, guest download), US-016-AC-04/05/06 (drag, show more, playlist download). These are low-risk and covered by broader regression and manual checks (`test-strategy.md` §9).

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Draft 1 |
