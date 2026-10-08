# Test Strategy

| Item | Value |
|---|---|
| SUT | PSMusic (React SPA `psmusic.client` + ASP.NET Core API `PSMusic.Server`), repository `D:\Study\PSMusic`, read-only |
| Automation repository | `psmusic-playwright-automation` (this repository) |
| Stack | Playwright Test + TypeScript, `APIRequestContext` for API, Allure, GitHub Actions (`CLAUDE.md`) |
| Status | Draft 1, 2026-10-01. Updated 2026-10-08 (search unblocked) |
| Inputs | `docs/requirements/user-stories.md` (agreed expectation, stakeholder decisions 2026-10-01), `docs/exploration/exploration-validation.md`, `docs/exploration/{browser,repository,documentation}/`, `CLAUDE.md`, `.claude/skills/` |
| Risk register | `risk-register.md` |
| Level documents | `levels/component-integration.md`, `levels/system.md`, `levels/system-integration.md` (includes the recommendation feature, US-022), `levels/acceptance.md` |

This document says **how** PSMusic is tested and **why**. It does not contain test cases or automation code, and it does not decide automation for individual scenarios. Those decisions belong to the next phases: Risk Analysis, Test Scenario Design, Automation Analysis, Manual and Automated Test Design, Automation Implementation.

### How to read the references

| Reference | Meaning |
|---|---|
| `US-0nn-AC-nn` | User story / acceptance criterion in `user-stories.md` |
| `SD-n` | Stakeholder decision n in the decisions table of `user-stories.md` |
| `EV §n` | Section n of `exploration-validation.md` |
| `B:file`, `R:file`, `D:file` | `docs/exploration/browser/`, `repository/`, `documentation/` |
| `F-n`, `F-Rn`, `BR-xx` | Runtime findings in `B:business-rules.md`, `B:recommendations.md` |
| `R-n` | Automation risks in `R:automation-considerations.md` |
| `QR-nn` | Quality risks defined in section 1.2 of this document |

**Rule for expected results.** `user-stories.md` is the only oracle. Where a story is marked DEFECT, tests assert the story, not the current behavior (EV §9). Behavior that no story or decision covers is a characterization of current behavior. It can be checked, but a difference is reported as an observation, not as a defect.

---

## 1. Test Objectives

### 1.1 Primary objectives

1. **Show that the agreed stories hold.** US-001 to US-023 are verified at the lowest level that gives enough confidence, and every known defect (EV §2, 13 items) has a test that fails until it is fixed.
2. **Protect the listener journey.** A guest or signed-in user can browse, open a song, play it, and (signed in) favorite and rate it. This is the core of the product (README feature list, US-005 to US-017).
3. **Enforce the server-side rules on the server.** Rules that the UI enforces but the API does not are tested through the API (review uniqueness, rating range, profile access). Today these are defects (US-017-AC-09/10, US-023-AC-03).
4. **Keep the app's own pipeline independent of third parties.** Recommendation, email-check, search-index and media problems must not appear as PSMusic failures (US-022 "Test placement", SD-1).
5. **Give fast and trustworthy feedback.** A small, deterministic gate on every change and broader regression on a schedule. A red build must mean something.
6. **Do not damage shared data.** The local API writes to a shared remote PostgreSQL in which reviews and streams cannot be deleted (`user-stories.md` "Technical behaviors", `B:test-data.md` §1).

### 1.2 Quality risks to address

These risks drive the rest of the strategy. Each one is grounded in evidence. Likelihood, severity and priority are assigned in [`risk-register.md`](risk-register.md), where these risks are refined into product risks (PR-nn) and test/project risks (TR-nn).

| ID | Risk | Evidence |
|---|---|---|
| QR-01 | Users can read other users' personal data (email) through the API | US-023-AC-03 DEFECT (source only), `R:repository-unknowns.md` UNK-64 |
| QR-02 | Server accepts duplicate reviews and out-of-range ratings, which corrupts review counts and averages | US-017-AC-09/10 DEFECT (source only), SD-7 |
| QR-03 | Behavior and identity are sent to the recommendation service without, or against, the user's consent | US-022-AC-14/15/17 DEFECT (runtime), SD-9, `B:recommendations.md` §8.5 |
| QR-04 | Session handling fails: lost login after reload, failed token refresh, logout not clearing state | US-003, US-004-AC-01 DEFECT, `B:authentication.md` §6 |
| QR-05 | Members-only actions reachable by guests, or protected endpoints reachable without a token | US-014, US-016-AC-07, `B:authentication.md` §5 |
| QR-06 | Wrong user-specific state shown (heart/star, counters, review date) | US-011-AC-06, US-015-AC-01, US-017-AC-05 DEFECTS, F-5/F-6/F-7 |
| QR-07 | Missing error and not-found handling leaves blank pages | US-007-AC-05, US-009-AC-05, US-020-AC-05 DEFECTS |
| QR-08 | Popularity data (charts, trending) does not reflect real listening, or stream counting is wrong | US-021, BR-P1 (single run), `R:repository-unknowns.md` UNK-03 |
| QR-09 | External dependencies (Elasticsearch, S3 media, Abstract email API, recsys tracker) make features unusable or tests unstable | US-010 BLOCKED until 2026-10-08 (Elasticsearch key), US-001 BLOCKED, F-2, `B:application-overview.md` §5 |
| QR-10 | Test writes pollute a shared database that cannot be cleaned | `user-stories.md` "Technical behaviors", `B:test-data.md` §1 |
| QR-11 | UI changes break automation: no test ids, hashed classes, duplicated player controls, language-dependent names | EV §7, F-3, R-2, R-3 |

### 1.3 Business-critical areas

The stakeholder ranked US-022 as Critical, and the README lists five features. Nothing else has a formal priority. The list below follows from the stories and from QR-01 to QR-10. It is an input to Risk Analysis, not a final ranking.

- **Authentication and session** (US-002, US-003, US-004). Every member feature depends on it.
- **Playback and song page** (US-011, US-013). This is the core product value. Media comes from S3.
- **Favorites and ratings** (US-015, US-016, US-017). These are the only user-generated data, and they have open server-rule defects.
- **Privacy of data sent to third parties** (US-022-AC-10 to AC-17). Rated Critical by the stakeholder and backed by confirmed runtime defects.
- **Authorization of personal data** (US-023-AC-03).

### 1.4 Objectives by quality dimension

| Dimension | Objective | Main stories |
|---|---|---|
| Functional correctness | Each AC has a check at one appropriate level. Client-side validation messages and "no request sent" are checked in the UI. Server rules and response contracts are checked through the API | All |
| Reliability | The PR gate runs without third-party hosts and with no fixed waits. Flaky rate is tracked and quarantined tests have an owner (section 12) | - |
| Security / authentication / authorization | API key enforcement, 401 without a bearer token, guest gating, refresh-cookie behavior, no password in any response, no cross-user profile read. Functional security checks only, no attacks (section 2.2) | US-001-AC-06, US-002, US-003, US-014, US-023, "Technical behaviors" |
| Data integrity | Exactly one stream per qualifying playback, one review per user and song, rating 1-5, favorite toggle symmetry, counters change by exactly ±1 | US-015, US-017, US-021 |
| API / backend behavior | Status codes (including the agreed 404s), the paged shape `{items,page,limit,totalItems,totalPages}`, camelCase, page-size clamping, the `refresh` 200/`isSuccess:false` contract | US-007, US-009, US-010-AC-09, "Technical behaviors" |
| Privacy (data sent to third parties) | Only approved fields leave the browser, and only after consent | US-022-AC-10/11/14/15/17 |

---

## 2. Scope

### 2.1 In scope

| Area | Stories | Note |
|---|---|---|
| Registration (API fully; UI validation messages) | US-001 | UI success path BLOCKED (external mailbox check) |
| Login, session restore, logout | US-002, US-003, US-004 | AC-04/05 of US-003 need a short token lifetime |
| Guest gating and protected routes | US-014, US-016-AC-07, US-020-AC-04 | |
| Discovery pages: Home, Genres, Category, Charts, Artist | US-005 to US-009 | Data-dependent (7-day streams) |
| Search | US-010 | Unblocked 2026-10-08: Elasticsearch key renewed (SD-1). Real results confirmed through the API (`B:search.md`); browser pass pending |
| Song details, lyrics, download | US-011, US-012 | |
| Player | US-013 | Controls rendered 2-3 times (F-3) |
| Favorites and favorites playlist | US-015, US-016 | |
| Rating and review | US-017 | Writes are permanent |
| Language and theme | US-018, US-019 | |
| Navigation, layout, not-found states | US-020 | |
| Stream recording and popularity | US-021 | |
| Recommendations: what is displayed and what is sent | US-022 | Separate suite and CI job, see `levels/system-integration.md` §3 |
| Own profile | US-023 | PROVISIONAL. API-level only until the endpoint is decided |
| Cross-cutting API rules | "Technical behaviors" | `X-App-Service-Key`, 401 shape, paging shape |

### 2.2 Out of scope

| Excluded | Reason |
|---|---|
| Recommendation **algorithm quality** (relevance, ordering, personalization) | Owned by another team. US-022 scope: "We check what the user sees and what data is sent, not the algorithm" |
| Elasticsearch relevance and fuzzy matching beyond the stated ACs | US-010-AC-10 is open and follows Elasticsearch behavior |
| Internals of third-party services (Abstract API, S3, recsys) | Only their effect on PSMusic is tested |
| Admin, roles, content management, playlists created by users, password reset, profile editing | They do not exist (`user-stories.md` "Roles", `R:repository-unknowns.md`, US-023-AC-04 open) |
| Responsive layout / mobile viewports | SD-10: no responsive-layout requirement |
| Load, performance and stress testing | No non-functional requirements (`D:documentation-gaps-and-conflicts.md` G-21), and the shared remote database and free-tier tracker host make load tests harmful. Can be revisited if requirements appear |
| Penetration testing, brute force, rate-limit probing | Not authorized (`B:authentication.md` §2 deliberately did not probe). Functional security checks stay in scope |
| Firefox and WebKit | No supported-browser list exists (G-17), and audio/cookie behavior was only explored in Chromium. Chromium only until a browser list is agreed (open question) |
| Persisted favorites order | SD-10: intended to reset after reload |
| Unit tests of SUT code | The SUT repository has no test project, and this repository must not modify it (`CLAUDE.md` §4). Recommended to the SUT team, not done here |
| Direct database verification | No database access has been granted. The API is the oracle (`R:automation-considerations.md` §4) |

---

## 3. Functional Test Areas

Only areas that exist in PSMusic. There is no cart, checkout, payment or order lifecycle.

| # | Area | Stories | Key behaviors | Main constraints |
|---|---|---|---|---|
| FA-01 | Registration | US-001 | Client validation, uniqueness messages, no auto-login, password never returned | UI success needs a real Gmail mailbox; API accepts any valid email (intended) |
| FA-02 | Authentication and session | US-002, US-003, US-004 | Login messages, token + `RefreshToken` cookie, restore on reload, refresh contract, logout → `/` | Token in memory only; refresh fires twice in the dev build |
| FA-03 | Authorization and gating | US-014, US-016-AC-07, US-020-AC-04, US-023 | Sign-in modal, `/favorites` and `/recent` redirects, 401 on protected endpoints, own-profile only | `GET /api/user/{id}` defect |
| FA-04 | Discovery (Home, Genres, Category, Charts, Artist) | US-005 to US-009 | Section limits, paging, ordering by streams, not-found states, links | Ordering depends on 7-day stream data |
| FA-05 | Search | US-010 | Suggestion threshold and debounce, results tabs, Top result, empty state, size clamp | Results depend on index state: indices are filled only at API startup (TR-05) |
| FA-06 | Song details and lyrics | US-011 | Detail content, lyric display and highlight, other songs, 404 | Hard-reload race (F-5) |
| FA-07 | Download | US-012 | File name sanitizing, error toast, guest allowed | Cross-origin S3 download |
| FA-08 | Player | US-013 | Play/pause/next/previous/repeat/shuffle/volume, auto-advance, title link | Headless audio, random next batch, duplicated controls |
| FA-09 | Favorites | US-015, US-016 | Toggle symmetry, counts, cache invalidation, playlist, play all, drag (client only) | Heart is a `div` in the player bar only |
| FA-10 | Rating and review | US-017 | Modal states, submit, list order and date, server rules | Permanent writes; modal is Vietnamese only |
| FA-11 | Listening statistics | US-021 | One stream per playback after 20 s, guest none, popularity windows | 20 s of real playback; permanent rows |
| FA-12 | Personalization settings | US-018, US-019 | Language switch and persistence, theme switch and persistence | `localStorage` per browser |
| FA-13 | Navigation and layout | US-020 | Sidebar highlight, user menu, not-found page | |
| FA-14 | Recommendations (third party) | US-022 | Display, card → song mapping, failure handling, consent, data sent | `levels/system-integration.md` §3 |

---

## 4. Test Levels

Levels follow ISTQB (CTFL v4.0). A level says **what is under test**. The interface used to reach it (API through `APIRequestContext`, UI through the browser, network capture, manual) is chosen per level inside each level document.

Rule: **test a behavior once, at the lowest level that can observe it.** Move up a level only when the behavior only exists there: rendering, client validation, browser storage, a whole user journey, or the effect of an external system.

### 4.1 Levels and documents

| Level | Test object in PSMusic | Owner | External systems | Document |
|---|---|---|---|---|
| **Component** | Single units of `psmusic.client` and `PSMusic.Server` | **SUT developers.** Not done in this repo (§4.2) | - | This section |
| **Component integration** | Interfaces between PSMusic's own parts: SPA ↔ API contract, API key filter and auth middleware, write → read through the API | QA | Not needed | [`levels/component-integration.md`](levels/component-integration.md) |
| **System** | PSMusic as a whole, against the user stories | QA | Blocked or mocked (recsys tracker blocked in every suite) | [`levels/system.md`](levels/system.md) |
| **System integration** | PSMusic ↔ recsys tracker, Elasticsearch, S3 media, Abstract email API | QA; fixes by the owning side | Test doubles (controlled mode) and real systems (real mode) | [`levels/system-integration.md`](levels/system-integration.md) |
| **Acceptance** | The product against stakeholder expectations | Product owner, with QA support | - | [`levels/acceptance.md`](levels/acceptance.md) |

Each level document has the same structure: test object, test basis, scope, approach and interfaces, entry and exit criteria, environment and data, suites and CI role, story coverage.

### 4.2 Component level

Not done in this repository: the SUT has no test project, and this repository must not modify it (`CLAUDE.md` §4). Checks recommended to the SUT team, because they are cheapest at unit level:
- review date format `yyyy-MM-dd` (US-017-AC-05),
- download file-name sanitizing (US-012-AC-01),
- search page-size clamp (US-010-AC-09),
- rating range and review uniqueness validation (US-017-AC-09/10).

### 4.3 Duplication guard

- Review uniqueness and rating range: system level through the API only. The UI only checks that the rated state hides the form (US-017-AC-04).
- Unknown category or artist: the 404 status is a component integration check, the visible not-found message a system check. Each is asserted once.
- Stream recording: the rule (once per playback) is a system check through the API. At most one slow UI test proves that playback triggers it.
- Recommendations: only the absence of the tracker is checked at system level. Display, clicks, failures and telemetry are system integration. Never both for the same assertion.
- Acceptance does not re-execute automated checks; it reviews their results.

---

## 5. Test Types

| Type | Why it applies to PSMusic | Example areas |
|---|---|---|
| Functional | Every story has acceptance criteria to verify | All FA |
| Negative | Many ACs are failure paths: unknown user, duplicates, unknown ids, guest actions | FA-01, FA-02, FA-03, FA-04, FA-06 |
| Boundary | Explicit limits: password 8 chars, display name 30, search ≥ 2 chars, size clamp to 10, rating 1-5, 20 s stream threshold, 25-char player title, section limits 8/10/6/12/30/4 | FA-01, FA-05, FA-08, FA-10, FA-11, FA-04 |
| Validation | Client-side checks must block the request ("sends no request" in several ACs) | US-001-AC-01/02, US-002-AC-01/02, US-017-AC-01 |
| Error handling | Agreed not-found states and error toasts. Many client `catch {}` blocks swallow errors (R-14) | US-007-AC-05, US-009-AC-05, US-011-AC-02, US-012-AC-02, US-017-AC-06, US-020-AC-05, US-022-AC-04 |
| State transition | Session states (guest → member → expired → refreshed → logged out), favorite on/off, review not-rated → rated, player repeat cycle, consent unset → granted/denied | US-003, US-004, US-013-AC-04, US-015, US-017, US-022 |
| Data integrity | Counters, uniqueness, stream counting, favorite record reuse | US-015-AC-05, US-017-AC-09/10, US-021-AC-01/02 |
| Security-related functional | API key, bearer enforcement, password never returned, cross-user read, guest gating, cookie flags | US-001-AC-06, US-002 rules, US-023, "Technical behaviors" |
| Privacy / data-contract | What leaves the browser to third parties, against an approved allowlist | US-022-AC-10 to AC-17 |
| Robustness / resilience | Third-party failures (recsys, S3 lyrics, Elasticsearch) must not break the page | US-022-AC-04, US-011-AC-08, US-012-AC-02 |
| Localization | Five languages; server messages and rating modal stay Vietnamese (agreed). Mostly manual (section 9) | US-018 |
| Regression | Continuous check that agreed behavior and fixed defects stay correct | Section 10 |
| Smoke | Minimal proof that the build is usable before deeper suites run | Section 10.1 |

Not selected: performance/load, visual-diff regression, accessibility audits. No requirement exists for any of them (G-21). They can be added if requirements appear. Accessibility gaps are already reported as locator constraints (EV §7).

---

## 6. Risk-Based Testing Approach

Effort is set per area from the factors below. Each factor is taken from evidence, not given a number here. [`risk-register.md`](risk-register.md) applies these factors with explicit classification rules (§1) and lists the coverage for P1 risks (§5).

| Factor | How it is judged for PSMusic | Evidence source |
|---|---|---|
| Business importance | Stakeholder priority (US-022 Critical), README features, core journey (play a song) | `user-stories.md`, D1 README |
| Impact of failure | Who is harmed and how badly: personal data exposure > lost user data > wrong counts > cosmetic | QR-01 to QR-07 |
| Likelihood | Known defects and source-only defects first. Then untested code paths, and code with swallowed errors | EV §2, R-14 |
| Technical complexity | Async session restore, token refresh, audio, shadow-DOM tracker, caches (15 min client, 10 min server) | `B:automation-considerations.md` AC-5, R-13 |
| User exposure | Guest browse/play paths are used by everyone; member paths by fewer users; profile has no UI | Roles table |
| Failure consequence | Permanent data (reviews, streams) and privacy issues cannot be undone. UI glitches can | QR-03, QR-10 |
| Integration dependencies | Elasticsearch, S3, Abstract API, recsys tracker, remote PostgreSQL | `B:application-overview.md` §5 |
| Observed instability | Recsys cold start and "no render" episodes, search empty until the key renewal on 2026-10-08, duplicate requests in the dev build | `B:recommendations.md` §8.1/8.9, F-1, F-4 |

**How this changes effort:**
1. **Areas with a known defect or a privacy/authorization impact** (QR-01, QR-02, QR-03, US-004-AC-01) get explicit negative tests at the API or network level and a regression test that stays until the fix is verified.
2. **Core journey areas with high exposure** (FA-02, FA-06, FA-08) get smoke coverage plus a small set of E2E journeys.
3. **Areas whose results depend on data or time** (FA-04 ordering, FA-11) are covered by API rules with controlled or relative assertions. UI checks only structure.
4. **Blocked areas** (FA-05 search, UI sign-up success) are designed now and parked with a clear entry condition (section 8.5). They are not counted as passing.
5. **Low-impact areas** (theme, language persistence) get a thin automated check plus manual review of the content.
6. **Effort is re-assessed** when a defect is fixed, a blocked item is unblocked, or the tracker configuration changes.

---

## 7. Test Data Strategy

### 7.1 Required entities

| Entity | Source | Reuse |
|---|---|---|
| Guest | Fresh browser context, empty storage | Per test |
| Member account | Created through `POST /api/auth/register` with a unique username and email (UI sign-up is blocked for synthetic emails) | Per test or per worker |
| Member with a known history (favorited or reviewed songs) | API setup at test start | Per test |
| Second member | Needed for cross-user authorization (US-023-AC-03) | Per test |
| Catalog: categories 1, 2, 10, 26, songs (e.g. 1, 2179, 581), artists (e.g. 1, 166) | Existing read-only data (`B:test-data.md` §3) | Shared, never modified |
| Song with MP3 and lyrics | Song 1 is known to work | Shared, read-only for playback |
| Song **without** lyrics | Not identified yet | Open (needed for US-011-AC-03) |
| Unknown ids | `99999999` for song, artist, category | Shared |
| Search keywords that exist in the index | `Binz` (artist 27), `Chờ Anh Nhé` (song 1), `Em` (song 1176, more than 10 matches), `Dương Domic` (artist 13); no-match `xyzqwvzz`. Valid while they exist in PostgreSQL when the API starts | Shared, read-only (`B:search.md` §5) |
| Recommendation fixtures | Recorded tracker configuration and responses, redacted | `levels/system-integration.md` §3.10 |

Existing accounts `psmusicqa_browser01`, `psmusicqa_7193372` and `psmusicqa_priv…` have no stored passwords (`B:test-data.md` §1). Automation must not depend on them.

### 7.2 Reusable vs dynamic data

- **Reusable:** catalog ids, unknown ids, language and theme names, fixed server messages (Vietnamese literals).
- **Dynamic:** usernames and emails (prefix + run id + worker id, display name ≤ 30 chars, US-001 rules), review comments with a run marker, consent state, recommendation identity.
- Keep data in factories and fixture files, not in test bodies (`CLAUDE.md` rule 13).

### 7.3 Isolation

- Each test creates its own user and state (`CLAUDE.md` rule 15). Workers never share a user.
- Shared counters (favorites, reviews, charts) are asserted as **deltas**, not absolute values (`B:test-data.md` §4, R-5).
- Tests that change counters on the same song do not run in parallel against that song.
- Browser storage is reset per test: `i18nextLng` pinned to `en`, all `recsys_*` keys cleared (F-R1: a previous user's identity leaks into later sessions).

### 7.4 Cleanup

| Data | Cleanup possible? | Approach |
|---|---|---|
| Favorites | Yes (toggle off) | Test toggles back in teardown |
| Users | No delete API | Use a recognizable prefix. Ask the SUT team for periodic cleanup |
| Reviews | **No** (no edit or delete API, US-017 rules) | Only in an approved environment. Each review needs a fresh user or an unreviewed song |
| Streams | **No** | Only in an approved environment. Streams affect popularity rankings (US-021) |
| External email checks | Quota consumed | Do not call the real Abstract API from automation (mock or skip) |

**Entry condition for write tests that cannot be cleaned up** (reviews, streams, mass user creation): an environment with its own database, or written approval from the SUT team for the shared database. Until then these tests are designed but not executed (EV §6).

### 7.5 Stale-data handling

- Popularity lists depend on streams from the last 7 days (US-005-AC-05) and can be empty. Tests check for data first and report "environment has no data" instead of failing a functional assertion, or they seed streams in an approved environment.
- The 15-minute client cache and 10-minute server output cache (R-13) mean that a new context or reload is used before checking changed lists.
- The recommendation list is cached per tab in `sessionStorage` (`B:recommendations.md` §8.1). It is cleared before failure tests.

### 7.6 State-dependent data

- Rating form shown only for users who have not reviewed the song (US-017-AC-01/04).
- Favorite state starts unknown, so read it before toggling.
- Session restore depends on the refresh cookie and the order of requests on hard reload (F-5). Tests use in-app navigation, or assert through `/player`.

### 7.7 Sensitive data

- Never commit: passwords, `X-App-Service-Key` value, JWTs, cookies, recsys domain key, Abstract API key (`CLAUDE.md` rule 14, R-12). They come from `.env` locally and from GitHub secrets in CI.
- Do not copy secrets that are committed in the SUT repository (`R:application-overview.md` security note).
- Test users use synthetic `@example.com` emails through the API, with no real personal data.
- Do not record other users' names or review texts in reports (`B:application-overview.md` secrets policy).
- Reports and traces are redacted (section 11.5).

---

## 8. Environment Strategy

### 8.1 Required environments

| Environment | Purpose | Status |
|---|---|---|
| Local developer machine | Writing and debugging tests. UI `https://localhost:5174` (Vite), API `https://localhost:7215/api` | Available. Uses the shared remote PostgreSQL and cloud Elasticsearch |
| CI environment for the app gate | PR and main-branch suites | **Not available.** The workflows (`ci.yml`, `regression.yml`, see `docs/ci-cd.md`) are ready but have no reachable SUT, base URL or secrets yet |
| Approved write environment | Reviews, streams, mass user creation | **Not available** (EV §6) |
| Real recommendation service | Scheduled recsys integration suite | Reachable (free-tier host). A test domain key is an open question (`levels/acceptance.md` A-Q8) |

### 8.2 Assumptions

- UI and API base URLs, the service key and credentials are configuration (`.env`, CI secrets). Port 5174 is local only (5173 is used by another project), so the port must be configurable (`B:automation-considerations.md` AC-1).
- HTTPS uses local certificates. `ignoreHTTPSErrors` only where the CI certificate requires it (unknown).
- The dev build doubles requests (StrictMode, F-4). Tests never count identical calls. A production-build comparison is still open (EV §6).
- Chromium only (section 2.2).

### 8.3 External dependencies

| Dependency | Used by | Strategy |
|---|---|---|
| Remote PostgreSQL (Neon) | All data | Shared. Read-only tests are safe; write rules in section 7.4 |
| Elasticsearch (cloud) | Search | Real behind the API. Key renewed 2026-10-08 (SD-1); indices refilled from PostgreSQL at every API startup. API fails to start without valid config (`R:automation-considerations.md` §1) |
| S3 (`psmusic.s3…`) | MP3, lyrics | Real in all suites (core playback). Lyric failure tested by blocking the request in the browser |
| Image CDNs | Covers | Real. Not asserted pixel-wise |
| Abstract email API | UI sign-up | Never called from automation. Mocked in the browser for the UI success path, if the product team approves (open item) |
| Recsys tracker (`tracking-sdk` S3 loader + `onrender.com` API) | Recommendations, privacy banner, popup | **Blocked in every suite except the recommendation suites** (US-022 test placement). See `levels/system.md` §4 |

### 8.4 Accounts and roles

Only two roles exist: guest and registered user (no admin). Users are created through the API per run. One pre-provisioned account with a known password (in CI secrets) is useful for the smoke login check, so smoke does not depend on the register endpoint. **Open:** the SUT team needs to provide it.

### 8.5 API availability, backend access and limitations

- The API needs `X-App-Service-Key` for every `/api/*` call. Swagger exists only in Development at `https://localhost:7215/swagger` (G-01, G-04).
- No database access. Side effects are verified through the API.
- Known limitations and their entry conditions:

| Limitation | Blocks | Entry condition to unblock |
|---|---|---|
| UI sign-up needs a real mailbox | US-001-AC-03 (UI) | Product decision: real mailbox or approved mock |
| 60-minute token lifetime | US-003-AC-04/05 | Environment with a short token lifetime |
| Shared database, permanent writes | US-017 write paths, US-021 | Approved write environment or cleanup plan |
| Profile endpoint undecided | US-023 | Endpoint decision |
| No CI environment for the SUT | Every CI suite | SUT team provides a URL pair, certificate and secrets, or a way to run the app in CI |

---

## 9. Manual vs Automation Strategy (principles only)

Final decisions per scenario are made in the Automation Analysis phase.

| Category | Generally suited for | Why | PSMusic examples (indicative) |
|---|---|---|---|
| Deterministic rules with a clear oracle | **Automated, API** | Fast, stable, independent of UI changes | Auth contract, status codes, paging, authorization |
| Repeatable UI behavior with stable locators | **Automated, UI** | High repeatability, user-visible | Login validation, gating modal, redirects, not-found pages |
| Data sent over the network | **Automated, network capture** | Humans cannot reliably inspect payloads every time | Recommendation privacy allowlist |
| Behavior that depends on real time, audio or randomness | **Automated with care, or manual** | Expensive and flaky; reduce to network and state assertions | Stream after 20 s, shuffle, lyric highlight |
| Visual and language quality | **Manual / periodic** | No oracle for "looks right" or "reads well" | Theme colors, translation completeness (US-018-AC-04), Vietnamese-only modal |
| New or changed areas, unclear behavior | **Exploratory** | Finds unknowns before scripting | Production-build behavior, search after key renewal, new tracker rules |
| One-off or rarely changing checks | **Periodic manual verification** | Not worth the maintenance | Download file naming across odd titles, playlist download timing |
| Privacy and data-handling judgement | **Manual review** (supported by automated capture) | Deciding whether a field is acceptable is a human decision; detecting it is automated | New fields sent to the tracker, review text sent to the tracker |
| Blocked by the environment | **Designed, not executed** | Avoid false passes | Search, UI sign-up success, token expiry |

Principle: automate the **detection**. Leave **judgement** (is this acceptable, does this look right) to people.

---

## 10. Regression Strategy

### 10.1 Smoke suite

Goal: in a few minutes, show that the build is usable. Third-party hosts are blocked, and the suite is read-only except for login.
- App loads, layout shows, guest can open Home, Genres, Charts and a song page (US-005, US-006, US-008, US-011, US-020-AC-01).
- Song plays in the player (US-013-AC-01).
- Login with valid credentials works, and a reload keeps the session (US-002-AC-03, US-003-AC-01).
- Guest is gated from `/favorites` (US-016-AC-07).
- API health: one public endpoint with the key, and 401 without it ("Technical behaviors").

Not in smoke: search (results depend on index state, TR-05), recommendations (US-022 placement), anything that writes permanent data.

### 10.2 Critical regression

Smoke plus the high-risk rules:
- Full auth contract and session handling (US-001 API, US-002, US-003, US-004).
- Authorization and gating (US-014, US-023-AC-02/03).
- Favorite toggle and favorites page (US-015, US-016).
- Not-found and error states (US-007-AC-05, US-009-AC-05, US-011-AC-02, US-020-AC-05).
- Server rules for reviews (US-017-AC-09/10). Only in an approved write environment.
- Every known-defect test (EV §2).

### 10.3 Broader regression

Critical regression plus: discovery details and paging (US-005 to US-009), player controls (US-013), download (US-012), language and theme (US-018, US-019), stream recording (US-021, approved environment), search (US-010), and the external-dependency integration checks.

### 10.4 Frequency and triggers

| Trigger | Runs |
|---|---|
| Pull request in this repository | Smoke + tests touched by the change. Lint and type-check |
| Change in the SUT (when the SUT can trigger this repository, open item) | Smoke, then critical regression |
| Merge to main in this repository | Critical regression |
| Nightly | Broader regression + system integration suites (`levels/system-integration.md`) + external-dependency checks |
| Before a release / demo, manual | Broader regression + manual checklist (section 9) |
| Defect fixed by the SUT team | The defect's regression test + the area's critical tests |
| Tracker configuration changed (detected nightly) | Recommendation suites + privacy review |

### 10.5 Areas that need high repeatability

Session handling, gating, favorite toggle symmetry, API contracts and the privacy allowlist. These run on every gate and must have a flaky rate near zero. Any instability here is fixed before new tests are added.

---

## 11. CI Strategy (intent, not configuration)

### 11.1 Roles of each stage

| Stage | Content | Blocking? |
|---|---|---|
| Pre-merge static checks | ESLint, `tsc --noEmit`, `forbidOnly` | Blocks |
| Pre-merge tests (PR in this repo) | Smoke + changed specs, Chromium, tracker blocked | Blocks |
| Post-merge (main) | Critical regression | Blocks the next release, alerts the owner |
| Scheduled (nightly) | Broader regression, recommendation suites, external-dependency checks | Reports. Does not block merges |
| Manual (`workflow_dispatch`) | Any suite, any environment URL, for releases and investigation | Informational |

### 11.2 Environment dependencies

- Each job needs: UI and API base URLs, `X-App-Service-Key`, test account credentials, and recsys settings for the recommendation jobs only. All are GitHub secrets or variables.
- **Today none of this exists in CI** (section 8.5). The first CI milestone is lint and type-check only, plus an "environment reachable" step that skips the suite with a clear message when the SUT is not reachable, instead of failing it.
- Tests are tagged (`@smoke`, `@critical`, `@regression`, `@recsys`, `@external`, `@write-permanent`, `@known-defect`) so jobs choose suites by tag, not by file list.

### 11.3 Failure handling

Every failure is classified before it is reported. See also `levels/system-integration.md` §2.3 for external-system failures.

| Class | Meaning | Action |
|---|---|---|
| App defect | PSMusic fails an agreed story with controlled inputs | Fails the job. Defect raised for the SUT team |
| Known defect | Test linked to an EV §2 defect fails as expected | Reported in a separate list. Does not fail the job. Flips to a real failure if it starts passing unexpectedly (so the fix gets noticed) |
| Integration / contract defect | Contract between PSMusic and a dependency broken (schema change, selector rule no longer matches) | Fails the nightly integration job. Routed to the owner of the side that changed |
| External outage | Dependency unreachable, 5xx, timeout, cold start | Marked as an environment issue, not a test failure. Retried once |
| Environment / test-data issue | SUT not reachable, no popular data, missing secret | Skipped with a reason |
| Test defect | Locator broken by an app change, bad wait | Fixed in this repository. Quarantine only with an owner and a deadline |

Retries: at most 1 in CI (the current config has 2). A test that passes on retry is reported as flaky, never silently green.

### 11.4 Reporting

- Allure report per run, published as an artifact. Playwright HTML report as backup.
- Summary in the job output: counts per class (section 11.3) and per tag.
- Known-defect list and quarantine list visible in each report.

### 11.5 Evidence and redaction

- Trace and screenshot on failure; video only on retry.
- Network capture for recommendation suites.
- Before upload, redact: `x-app-service-key`, `Authorization`, `Cookie`/`Set-Cookie`, `DomainKey`, passwords and tokens in bodies. Artifact retention is short (for example 14 days).

---

## 12. Reliability and Flakiness Strategy

### 12.1 Likely causes (observed in PSMusic)

| Cause | Evidence | Principle |
|---|---|---|
| Asynchronous session restore | Login UI appears only after `auth/refresh` (AC-5) | Wait for the logged-in signal (avatar or refresh response), never a fixed delay |
| Route change before content swap | Charts showed the Genres DOM for 1-2 s (UF-02) | Wait on a page-specific heading or API response, not the URL alone |
| Duplicate requests in the dev build | F-4 | Never count calls. Wait for "at least one" |
| Third-party overlays | Privacy banner and recsys popup intercept clicks (F-2) | Block the tracker outside recommendation suites |
| Third-party availability | Recsys cold start, "no render" episodes (`B:recommendations.md` §8.1/8.9) | Real-service tests only in non-blocking jobs |
| Audio buffering | `currentTime` needed ~4 s to move (AC-5) | `expect.poll` on state, never `waitForTimeout` (`CLAUDE.md` rule 10) |
| Random data | Next batch, shuffle, recommendations (`B:test-data.md` §4) | Assert structure and invariants, not specific songs |
| Shared mutable counters | Other users change favorites and reviews | Delta assertions, no parallel writes to the same song |
| Caches | 15 min client, 10 min server, recsys `sessionStorage` | Fresh context, cleared storage |
| Language-dependent locators | All role names change (AC-4) | Pin `i18nextLng = 'en'` before navigation |
| Fragile DOM | Hashed classes, duplicated player controls (F-3) | Prefer `href`, role and heading locators; scope player locators to the wrapper; request test ids from the SUT team |
| Leaked third-party identity | `recsys_cached_user_info` survives logout (F-R1) | Clean storage per test |
| Environment instability | Remote database, free-tier hosts | Reachability check before the suite; external failures are classified, not counted |

### 12.2 Principles

1. Independent tests with their own data. No order dependence.
2. Web-first assertions and response waits only.
3. Control what PSMusic does not own (tracker, email API) in the gate. Use the real thing only in separate jobs.
4. A test that is flaky twice in a week is either fixed or quarantined with an owner, a reason and a date.
5. Measure: flaky rate per suite from CI history. The gate suite has the strictest target (set in the planning phase).

---

## 13. Traceability

### 13.1 Decisions → sources

| Decision in this strategy | Traced to |
|---|---|
| Assert the story, not current behavior, for known defects | EV §9 |
| Recommendation tests never in smoke or the app gate; tracker blocked elsewhere | US-022 "Test placement" (stakeholder) |
| Do not test recommendation relevance | US-022 scope |
| Search executed against the real index (unblocked 2026-10-08) | SD-1 update, TR-05 |
| UI sign-up success not automated against the real email check | US-001 BLOCKED, `B:authentication.md` §3, R-1 |
| Users created through the API | `B:test-data.md` §2, AC-6 |
| Permanent writes only in an approved environment | "Technical behaviors", `B:test-data.md` §1, EV §6 |
| API as backend oracle, no database checks | No database access, `R:automation-considerations.md` §4 |
| Server rules tested at system level through the API | US-017-AC-09/10, US-023-AC-03 (source-only defects) |
| No responsive or mobile testing | SD-10 |
| Chromium only | G-17, browser exploration in Chromium only |
| No performance or penetration testing | G-21, `B:authentication.md` §2 |
| Language pinned to English; Vietnamese server strings asserted literally | US-018 rules, AC-4 |
| Delta assertions for counters | `B:test-data.md` §4, R-5 |
| Storage reset per test | F-R1, `B:recommendations.md` §6 |

### 13.2 Story coverage by level (planning view)

Component level is owned by the SUT developers and is not listed. Acceptance covers every story (review of results and sign-off); the column marks stories with extra manual acceptance checks.

| Story | Component integration | System | System integration | Acceptance (manual) | Status note |
|---|---|---|---|---|---|
| US-001 | ● (register contract) | ● (UI validation) | ● (email check, only if approved) | | UI success BLOCKED |
| US-002 | ● | ● | | | AC-05 not yet run |
| US-003 | ● (refresh contract) | ● | | | AC-04/05 need short token |
| US-004 | ● (logout contract) | ● | | | DEFECT AC-01 |
| US-005 to US-009 | ● (paging, 404) | ● | | | DEFECTS US-007/009-AC-05 |
| US-010 | ● | ● | ● (Elasticsearch) | | Unblocked 2026-10-08; API confirmed, browser pending |
| US-011 | ● | ● | ● (S3 lyrics) | | DEFECT AC-06 |
| US-012 | | ● | ● (S3 media) | ● | |
| US-013 | ● (player, next-batch) | ● | ● (S3 audio) | ● (audio quality) | |
| US-014 | ● (401) | ● | | | |
| US-015, US-016 | ● | ● | | | DEFECT US-015-AC-01 |
| US-017 | ● | ● | | | DEFECTS AC-05/09/10; writes permanent |
| US-018, US-019 | | ● | | ● (translations, colors) | |
| US-020 | | ● | | | DEFECT AC-05 |
| US-021 | ● | ● | | | Writes permanent |
| US-022 | | ● (tracker controlled) | ● (real service, privacy) | ● (privacy approval) | DEFECTS AC-14/15/17 |
| US-023 | ● | ● (authorization rule) | | ● (endpoint decision) | PROVISIONAL; DEFECT AC-03 |

● = planned level. Final per-scenario allocation happens in Automation Analysis.

### 13.3 Open questions (owner: SUT team / product)

1. CI environment for the SUT: URLs, certificate, secrets, and whether the SUT repository can trigger this repository.
2. Approved write environment or cleanup process for reviews, streams and users.
3. A pre-provisioned test account with a known password.
4. Supported browsers.
5. ~~Elasticsearch key renewal and known indexed titles~~ (done 2026-10-08, `B:search.md`).
6. UI sign-up approach (real mailbox or approved mock).
7. Short token lifetime environment.
8. Profile endpoint and UI (US-023).
9. Review comment length limit and the status code for rejected reviews (US-017).
10. Test ids or accessible labels on the player, header icons and modals.
11. Product and third-party decisions: see `levels/acceptance.md` §5.

---

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Draft 1 from user stories (stakeholder decisions 2026-10-01) and exploration validation |
| 2026-10-01 | Level details moved to `levels/`; recommendation strategy merged into `levels/system-integration.md`; §4 reduced to a summary |
| 2026-10-01 | Section 4 and 13.2 reorganized by ISTQB test level (component, component integration, system, system integration, acceptance) |
| 2026-10-08 | Search (US-010, FA-05) unblocked: Elasticsearch key renewed; SUT seeds the `songs` and `artists` indices at API startup (`d1a3c44`). Limitation row removed from §8.5. Real search confirmed through the API; known titles added to §7.1 |
