# PSMusic - System Integration Test Strategy

| Item | Value |
|---|---|
| Level | System integration (ISTQB): interactions between PSMusic and external systems |
| Parent | `../test-strategy.md` (objectives, scope, data, environment, CI and traceability rules apply here unless this file says otherwise) |
| Related levels | `system.md` (tracker-blocked rule), `acceptance.md` (privacy approvals, open decisions) |
| Status | Draft 1, 2026-10-01 |

Abbreviations: **REC** = `docs/exploration/browser/recommendations.md`. Other references as in `../test-strategy.md` ("How to read the references").

---

## 1. Level definition

### 1.1 Test object

PSMusic's interfaces with systems it does not own:

| External system | Interface | Used by | Section |
|---|---|---|---|
| Recsys tracker (S3 `loader.js` + `recsys-tracker-module-*.onrender.com`) | Browser ↔ third party | Recommendations, privacy banner, behavior tracking (US-022) | §3 |
| Elasticsearch (cloud) | API server ↔ Elasticsearch | Search (US-010) | §4 |
| S3 media (`psmusic.s3…`) and image CDNs | Browser ↔ S3/CDN | Playback, lyrics, download, covers (US-011, US-012, US-013) | §5 |
| Abstract email reputation API | Browser ↔ third party | UI sign-up (US-001) | §6 |
| Remote PostgreSQL (Neon) | API server ↔ database | All data | §7 (environment only) |

### 1.2 What this level proves, and what it does not

- **Proves:** PSMusic handles each external system correctly, both when it works and when it fails. The shared contracts (fields, ids, routes, selectors) hold. Only approved data leaves PSMusic. The real systems are reachable and compatible.
- **Does not prove:** PSMusic's own business rules. Those are checked at `system.md` with external systems blocked or mocked. It also does not check the external systems' internal quality, for example recommendation relevance or search ranking.

### 1.3 Test basis

US-001, US-010, US-011-AC-08, US-012-AC-02, US-013, US-022, stakeholder decisions SD-1 and SD-9, observed integration contracts (REC, `B:api-inventory.md` §5), `exploration-validation.md` §2 and §6.

### 1.4 Owners

QA (this repository) writes and runs the tests. Fixes go to the owner of the side that broke: the PSMusic team, the recsys team, or whoever runs Elasticsearch/S3.

---

## 2. Common approach

### 2.1 Two ways to test an interface

| Mode | What runs | Use | Blocks the app? |
|---|---|---|---|
| **Controlled (test double)** | Real PSMusic, the external system replaced by `page.route` fixtures or fault injection | PSMusic's handling of the interface: rendering of external data, failures, timeouts, malformed data, event wiring | Never the app gate. Own job, warning + issue |
| **Real** | Real PSMusic + real external system; network captured, never modified | Availability, real contract, drift, real data sent (privacy) | Never. Scheduled and manual |

**Blocked** (the external system aborted entirely) is not a test mode of this level. It is the standing condition of `system.md` suites.

### 2.2 Preflight for real-mode runs

Every real-mode job starts with a small health check of the external system, with a generous timeout and one retry for cold start. If it fails, the job is marked **external unavailable** and its tests are skipped, not failed.

### 2.3 Failure classification

| Class | Signal | Reported to |
|---|---|---|
| **App defect** | Fails in controlled mode (inputs are fixed, so the external system is excluded) | PSMusic team |
| **App-side integration defect** | A controlled wiring test fails after an app change (for example a class that a tracker rule depends on was renamed) | PSMusic team, external owner informed |
| **Integration contract defect** | Real-mode preflight is healthy, but the response, configuration or script differs from the approved snapshot, or an unapproved field is sent | External owner (+ PSMusic team if the shared contract changes) |
| **Third-party defect** | Passes in controlled mode, fails in real mode with a healthy preflight and an unchanged contract | External owner |
| **Third-party availability failure** | Preflight fails: 5xx, 503, timeout, DNS, cold start beyond the retry | External owner notified. **No defect** for either team |
| **Privacy defect** | Allowlist, canary or consent assertion fails | External owner + product owner, high severity |
| **Known defect** | Linked to an `exploration-validation.md` §2 item | Known-defect list |

Nightly triage rule: run the same scenario in controlled and real mode and compare. *Fails both* → app. *Passes controlled, fails real, preflight OK, contract OK* → third party. *Snapshot diff* → contract. *Preflight fails* → availability.

### 2.4 Entry criteria

- The PSMusic environment is reachable (UI and API URLs and the service key are configured).
- For controlled mode: the fixtures for that interface are recorded, redacted and approved.
- For real mode: the preflight passes. For the recsys tracker, see open question 8 in §3.13 (test domain key).
- For search: the Elasticsearch key is renewed and known indexed titles are listed (SD-1).

### 2.5 Exit criteria

- Every row of the resilience matrices (§3.8, §4, §5) has a result or a recorded "confirm" decision.
- No open privacy defect without an owner. Known defects are linked to their story.
- Real-mode results for the last nightly run are classified (§2.3). None is left as "unknown".
- Contract snapshots match the real systems, or each drift has an issue.

### 2.6 Evidence and redaction

| Evidence | Controlled mode | Real mode | Note |
|---|---|---|---|
| Playwright trace | Yes (`retain-on-failure`) | **No** by default | Traces store full network bodies and headers, which cannot be redacted reliably. Real mode uses the redacted log below instead |
| Screenshot | Yes | Yes | |
| Video | Only on retry | Only on retry | |
| Console logs + page errors | Yes | Yes | Page errors are part of resilience assertions |
| Network log of the external host (method, path, status, timing, bodies, beacon payloads) | Yes | Yes, **redacted** | Own JSON attachment |
| Preflight result, external status and latency | - | Yes | Separates outage from defect |
| Contract/config/script hash | - | Yes | For drift reports |
| Classification label | Yes | Yes | Allure category per §2.3 |

Before upload, mask: `X-App-Service-Key`, `Authorization`, `Cookie`/`Set-Cookie`, tokens, the recsys `DomainKey`, `AnonymousId` (hash it so runs can still be compared), third-party API keys, and canary values. Never include other users' data. Short retention (for example 14 days).

### 2.7 CI role

| Check name | Content | Required status? |
|---|---|---|
| `sit-controlled` | Controlled-mode tests of all interfaces | No. Warning + issue. Required only for PRs **in this repository** that change these tests or their fixtures |
| `sit-live` | Real-mode preflight, contract and drift checks, 1-2 real journeys | No |
| `sit-privacy` | Real-mode data-contract and consent checks | No. A new failure is a privacy defect |

Only the system-level `app-gate` is a required status (`../test-strategy.md` §11). The nightly summary lists counts per class (§2.3) and links the open issues per owner.

---

## 3. Recommendation tracker (US-022)

Out of scope everywhere in this section: **whether a recommended song is relevant** (US-022 scope).

### 3.1 How the integration actually works

Verified at runtime and in source. Where these facts differ from generic assumptions, the observed fact is used.

| Fact | Evidence | Consequence for testing |
|---|---|---|
| The PSMusic **server does not talk to the recommendation service.** `index.html` sets a domain key and loads `tracking-sdk.s3-ap-southeast-2.amazonaws.com/dist/loader.js`. That script calls `recsys-tracker-module-d8ty.onrender.com` **directly from the browser** | `index.html`, REC §1, `R:user-flows.md` ("not implemented" in app code) | Every request and response is visible to Playwright in the browser. No backend double is needed, and there is no component integration test for this interface |
| The app only provides empty containers and headings: `.recommendSys` (Home), `.recommendSongDetails` (Song), `.recommendCategoryDetails` (Category) | REC §8.7 return methods, US-022 scope | The app-owned surface is small: containers, headings, page stability |
| Cards, the popup, the privacy banner and the consent logic are rendered by the **third-party script inside shadow DOM** | REC §3, §8.5 | Card markup (`.recsys-item`) is controlled by another team and can change without any app change |
| **What** is tracked is decided by rules downloaded at runtime (`/rule/domain/<key>`). The rules point to **app** CSS classes and **app** API paths (`.btn-play`, `.sr-song-tab`, `/api/song/:id/player`, `/api/rating/:id/add-review`, …) | REC §8.7, US-022-AC-13 | Telemetry can break from **either** side: the app renames a class, or the service changes a rule |
| Endpoints: `POST /recommendation`, `/evaluation`, `/event` (sent by `navigator.sendBeacon`), `/recommendation/push-keyword`, plus config `GET`s | REC §8.7 | `sendBeacon` bodies are not visible through `request.postData()`. An init script that wraps `sendBeacon` is needed (verified in exploration) |
| The service is a **free-tier host**: cold starts, empty first visits, and periods of "no render" were all observed | REC §8.1, §8.9 | The real service cannot sit in a blocking gate |
| Result cached per tab in `sessionStorage`; identity in `localStorage` (`recsys_anon_id`, `recsys_cached_user_info`) that survives logout | REC §8.1, F-R1 | Full storage reset per test |
| **Stakeholder placement rule:** regression or a separate recommendation/security suite, never smoke, never the gate of the app's own CI. Tag the tests, run them in their own job, block the tracker in every other suite. A failure is a third-party issue, not an app failure | US-022 "Test placement" | No recommendation test in smoke or the app gate. Controlled tests run in their own non-blocking job (§3.7) |
| Confirmed defects: data sent before a consent choice (AC-17), behavior and identity sent after Decline (AC-14, AC-15) | `exploration-validation.md` §2 | Tests assert the agreed story and run as known defects until fixed |

```
                        PSMusic SPA (browser)                                Third party (another team)
  ┌──────────────────────────────────────────────────────────┐
  │ App-owned:                                               │
  │  index.html → loads loader.js + domain key               │      tracking-sdk S3: loader.js
  │  containers .recommendSys / .recommendSongDetails /      │ ───► recsys-tracker-module-*.onrender.com
  │   .recommendCategoryDetails + headings                   │        GET  config (domain, rule, return-method,
  │  classes & API calls that rules hook on                  │              search-keyword-config, user-identity)
  │   (.btn-play, .sr-song-tab, /api/song/:id/player, …)     │        POST /recommendation      (identity → items)
  │  /song/{id} route (target of a card click)               │        POST /evaluation          (Rank of clicked card)
  │                                                          │        POST /event  (sendBeacon) (behavior)
  │ Third-party-owned, running in the page:                  │        POST /recommendation/push-keyword
  │  loader.js, privacy banner, consent, popup, cards        │
  │  (shadow DOM), event capture                             │
  └──────────────────────────────────────────────────────────┘
          ▲ PSMusic API (localhost:7215) is NOT on the recommendation path

  Playwright modes
  ────────────────
  Mode 0  BLOCKED      route onrender + loader → abort    system level (system.md), every app suite
  Mode A  CONTROLLED   real loader.js, onrender API fulfilled from recorded fixtures
                       → SIT: UI, resilience, event wiring
  Mode B  REAL         real loader.js + real service, network captured, never fulfilled
                       → SIT: integration, contract drift, privacy/telemetry with real rules

  Telemetry / data-contract checks:
    browser network capture (page.on('request') + sendBeacon wrapper)
    → per-request allowlist check  → Mode A (wiring) and Mode B (real rules, privacy)
```

### 3.2 Ownership split

| Owner | Behavior | Who receives a failure |
|---|---|---|
| **App (PSMusic)** | Containers and headings on Home, Song and Category. Page loads and core features work whatever the tracker does. The CSS classes and API calls that tracker rules depend on stay stable (or changes are announced). `/song/{id}` resolves for ids the service returns | PSMusic team |
| **Integration (shared contract)** | `DomainItemId` = PSMusic song id. Rule selectors match app elements. Return-method containers exist on the configured routes. Only approved fields are sent | Whichever side changed; both are informed |
| **Third party** | Service availability, response content, card rendering, popup, banner and consent logic, which events the rules produce | Recsys team |

### 3.3 Scope

**A. UI / functional (US-022-AC-01/02/03/07/08/09)**
- Inline section present with its heading on Home, Song and Category. Popup present on Song, Category, Genres and Charts. Absent on Artist and Auth (REC §8.1).
- Each card shows an image, title and artist. None blank or broken (AC-01).
- Card n shows item n of the response (AC-07). Clicking card n opens `/song/{DomainItemId}` in the same tab and sends `/evaluation` with `Rank = n` (AC-08), for the first, a middle and the last card, inline and popup (AC-09).
- Popup can be closed with `button.recsys-close` (AC-02). Recommendations stay present across page changes (AC-03).
- Empty state: heading stays and the section is empty (AC-04).
- Not asserted: exact item counts per page as a hard rule. They come from server configuration (`maxItems` 50/10/20) and changed with the entry path (F-R2). Count is checked against the **configured** value in Mode A only.

**B. Real-service integration (Mode B)**
- Connectivity, config endpoints reachable, `/recommendation` response shape (`item[]` with `Id`, `DomainItemId`, `Title`, `Artist`, `ImageUrl`), returned `DomainItemId`s resolve to real songs, `/evaluation` accepted.
- Drift of rules and return methods against the approved snapshot (AC-13: rules can change without any app change).
- Authentication to the service is only the domain key in the body. No PSMusic credential is involved (REC §8.4).

**C. Resilience** (matrix in §3.8). Service unavailable, timeout, 4xx, 5xx, empty, malformed, config failure, loader unavailable. Core functions (play, favorite, rating, search UI, navigation) stay usable.

**D. Behavioral telemetry** (matrix in §3.9). Song card play overlay, song rows, dual-column rows, song-page Play and Download, player-bar heart, rating, review, recommendation-card click, search keyword. Event type, item id, identity, required metadata, destination.

**E. Data / privacy.** Approved-field allowlist per endpoint, consent states (unset, granted, denied), canary-based leak detection.

**Out of scope:** recommendation relevance and ordering, personalization effect of events, service performance, load against the free-tier host, the service's own security.

**Technical validation vs formal privacy requirements.** This level only checks **technical facts**: which fields are sent, when, and whether they match the agreed rules. The agreed rules come from stakeholder decisions (SD-9, US-022-AC-10/11/14/15/16/17), not from a legal analysis. Whether they are legally sufficient (for example whether the username or review text may be shared, retention, a data-processing agreement with the other team) is decided at acceptance (`acceptance.md`).

### 3.4 Scenario allocation

| Scenario group | Level | Interface | Mode | Why |
|---|---|---|---|---|
| Page loads with the tracker blocked; core features work | System | UI | 0 | Standing condition of every app suite (`system.md`). Not repeated here |
| Containers and headings exist with tracker data | SIT | UI | A | Checked once with fixture data |
| Card content = response item n | SIT | UI, one page | A | Needs rendered shadow DOM; fixture makes it deterministic |
| Card click → `/song/{DomainItemId}` + `/evaluation` Rank | SIT | UI + network | A | Navigation and the request are only observable in the browser |
| Same, for inline Home/Song/Category and popup | SIT | UI, parameterized by location, **not** separate journeys | A | Avoid one expensive journey per location |
| Failure matrix (§3.8) | SIT | UI + fault injection (`route.fulfill`/`abort`) | A | Faults cannot be produced on demand with the real service |
| Core features usable under each tracker failure class | SIT | UI, one check per class on a song page | A | One representative page per class is enough |
| Event wiring: an app action produces the expected `/event` | SIT (app side of the contract) | UI + network (beacon wrapper) | A (fixture rules) | Detects app-side breaks (renamed class or API path) without depending on the live service |
| Privacy allowlist, consent states, canary leak | SIT | Network capture in the browser | B (real rules) | What is sent depends on live rules (AC-13); a fixture would hide a rule change |
| Live service health, response shape, config drift, returned ids resolve | SIT | Direct `APIRequestContext` calls to the service + one browser load | B | Contract and availability can only be proven against the real service |
| One real journey: real load → real cards → click → song page | SIT | UI | B | Proves the whole chain once a night. Only one or two of these |
| Approval of a new or changed field | Acceptance | Manual privacy review | - | Approval is a human decision (`acceptance.md`) |
| Banner wording, popup layout, overlap with player controls | Acceptance (manual / exploratory) | Manual | - | Visual and subjective |

API tests against the PSMusic server are **not** used for this interface. The server is not on the recommendation path.

### 3.5 Dependency modes

**Mode 0: Blocked (system level).** `page.route` aborts the loader URL and the onrender host for every app suite. This removes the banner and popup that intercept clicks (F-2), the cold-start latency and the identity leakage (F-R1). It is also, in practice, the "loader unavailable" resilience case for every page. Defined and owned in `system.md`.

**Mode A: Controlled (mocked service, real loader).**
- The real `loader.js` runs. All requests to the onrender host are fulfilled from **recorded fixtures**: config endpoints (rules, return methods, keyword config, user identity) and `/recommendation`, `/evaluation`, `/event`, `push-keyword`.
- The `/recommendation` fixture is deterministic (§3.10). Fault variants replace it per test (§3.8).
- **Why this suits fast feedback:** no cold start, no outage, the same input every run, any fault on demand, and no pollution of the service's real data. A failure here cannot be blamed on service availability. It points to the app, a stale fixture, or a changed `loader.js`.
- **Limits:**
  1. `loader.js` is still fetched live from S3 and has no version in the URL. A new loader can change behavior under Mode A. Mitigation: `sit-live` records the loader hash every night and flags a change. Do not vendor a copy unless loader changes cause repeated noise (decision for Automation Analysis).
  2. Fully mocking the config endpoints **has not been tried yet.** Exploration only modified `/recommendation` (abort, 500, empty) while the config was real (REC §8.3). The first Automation Analysis task is a spike to confirm that the loader renders from fixtures alone. If it cannot, Mode A falls back to real config + mocked `/recommendation`, and that dependency is recorded.
  3. Fixtures go stale. They are refreshed only through an agreed change after `sit-live` reports drift, never automatically.

**Mode B: Real service.**
- Real loader and real service. The network is **captured, never modified.**
- Validates connectivity, the domain-key "authentication", the response contract, live rules, real rendering, and what is really sent (privacy).
- **Why it is not the PR gate:** the host is free tier with observed cold starts and "no render" periods (REC §8.1, §8.9). Its output is not deterministic, it changes without any PSMusic change (AC-13), and the stakeholder ruled it out of the app gate. A gate on it would block app PRs for reasons the app team cannot fix.
- **Data pollution:** Mode B sends real `/evaluation` and `/event` calls into the service's data for that domain key. Test traffic should use a **separate test domain key** or an agreed marker (§3.13 Q8). Until then Mode B keeps interactions to the minimum needed per run.
- Preflight (§2.2): config `GET` + one `/recommendation`.

### 3.6 Suites

All recommendation tests carry `@recsys` plus one suite tag. They reset browser storage (cookies, `localStorage`, `sessionStorage`, IndexedDB) and pin `i18nextLng = en`.

| Suite | Purpose | Mode | Typical tests | Frequency | Blocks |
|---|---|---|---|---|---|
| **`@recsys-controlled`** (part of `sit-controlled`) | Recommendation UI, resilience and event wiring with deterministic inputs | A | Section/popup presence per route; card n = item n; click → song + Rank (first/middle/last, inline + popup); popup close; persistence across pages; empty/4xx/5xx/timeout/malformed/config failure; core features under failure; app action → `/event` with fixture rules | App change (own job), merge, nightly | Does **not** block the app. Warning + issue. Blocks PRs **in this repository** that change recommendation tests or fixtures |
| **`@recsys-privacy`** (`sit-privacy`) | Data contract and consent with the real rules | B (capture only) | Consent unset / granted / denied × actions; allowlist per endpoint; canaries (password, email, token, service key); identity rules; no `/event` without interaction | Nightly; on config drift; before release | Does not block app delivery. A failure is a **privacy defect**, high severity |
| **`@recsys-live`** (`sit-live`) | Real-service integration and contract drift | B | Preflight; response shape; returned ids resolve (`GET /api/song/{id}/detail` = 200); config and loader drift vs snapshot; real load → cards → click → song page | Nightly; manual | Never blocks. Classified per §2.3 |

Resilience and UI share one suite (`@recsys-controlled`) because they share the same mode, fixtures and run conditions.

### 3.7 CI triggers

Assumed model: the PSMusic app repository triggers this repository. **This trigger does not exist yet** (`../test-strategy.md` §13.3). Until it does, "app change" means a manual dispatch or the nightly run.

| Trigger | `@recsys-controlled` | `@recsys-privacy` | `@recsys-live` | App gate (system level) |
|---|---|---|---|---|
| **PR in app repo** (dispatch) | Runs in its **own job**, in parallel with the gate. Warning check + issue, not blocking | No | No | Runs with tracker blocked (Mode 0), blocking |
| **PR in this repo** | Runs only if recommendation tests, fixtures or helpers changed. **Blocking for this PR** (it validates test code, not the app) | No | No | Smoke + changed specs |
| **Merge to main** (app or this repo) | Runs. Warning + issue | No | No | Critical regression |
| **Nightly** | Runs (compared with Mode B, §2.3) | Runs | Runs first (its preflight decides whether Mode B suites run) | Broader regression |
| **Manual** (`workflow_dispatch`) | Before release, after a fixture refresh, while investigating | Before release; after the recsys team announces a change; after a privacy fix | During incidents; to confirm an outage is over | Any |
| **Config or loader drift detected** | Re-run after the fixture update | Runs at once | - | - |

| Suite result | Effect |
|---|---|
| `@recsys-controlled` fails | **Warning** on the PR/commit + issue labelled `recsys:app-or-wiring` |
| `@recsys-privacy` fails (new failure, not a known defect) | **Separate privacy defect** to the recsys team and product owner. Whether it blocks a release is a product decision (Q12) |
| `@recsys-live` preflight fails | **External dependency failure** status, recsys owner notified. No app issue |
| `@recsys-live` contract or drift check fails | **Integration contract defect** to the recsys team (and app team if the shared contract is affected) |
| Known defects AC-14/15/17 | Known-defect list. Not counted as new failures. A sudden pass is reported so the fix gets verified |

Failure examples per class:

| Class (§2.3) | Recommendation example |
|---|---|
| App defect | Valid fixture, but the section heading or container is missing; page crashes when `/recommendation` fails; card click lands on a broken `/song/{id}` route |
| App-side integration defect | App renamed `.btn-play`, so rule 172 no longer fires |
| Integration contract defect | Service renames `DomainItemId` or changes the item shape, so cards break or link to wrong songs; a new rule sends a new field. Detected by `@recsys-live` drift/contract checks, or `@recsys-privacy` for fields. PSMusic does not parse the response itself (the tracker does), so the app-relevant contract is: `DomainItemId` = song id, and `Title`, `Artist`, `ImageUrl` present |
| Third-party defect | Service returns 201, but cards render blank |
| Availability failure | Real service returns 503 |
| Privacy defect | Email found in a beacon; behavior sent after Decline |

### 3.8 Resilience matrix

"Observed" = seen in exploration. "**Confirm**" = expected behavior not agreed yet (listed in `acceptance.md`). All rows run in Mode A on a page with an inline section, with `sessionStorage` cleared first (cached results would hide the failure, REC §8.1).

| Third-party condition | Expected application behavior | Basis | Test type | Suite |
|---|---|---|---|---|
| Valid recommendations | Section shows cards matching the response (item n → card n), popup where configured, card click works | AC-01/02/07/08, observed | Functional UI + network | `@recsys-controlled`; once a night in `@recsys-live` |
| Valid, but popup open | Core actions (player controls, auth modal buttons) can still be used. Today the popup **intercepts clicks** (F-2) | **Confirm** whether F-2 is acceptable or a defect | Usability / functional | `@recsys-controlled` (after confirmation) |
| Empty list `{ item: [] }` | Page loads, heading stays, section empty, no page error | AC-04. Observed on **Home only**; popup behavior on Song/Category **confirm** | Error handling | `@recsys-controlled` |
| HTTP 4xx (400/401/403/404) | Same as a failed call: page loads, heading stays, section empty | AC-04 says "fails". **Confirm** 4xx is included; not observed | Error handling | `@recsys-controlled` |
| HTTP 5xx | Page loads, heading stays, section empty, no page error | AC-04. Observed 500 on **Home only** | Error handling | `@recsys-controlled` |
| Network failure (abort) | Same as 5xx | Observed on Home, Song and Category | Error handling | `@recsys-controlled` (also implicit in Mode 0) |
| Timeout / very slow response | Page and core features usable while waiting. No blocking spinner. **Confirm:** whether late cards may appear after the user has moved on, and any time limit | Not in any story; not observed | Robustness | `@recsys-controlled` (delayed `route.fulfill`) |
| Malformed response (invalid JSON, `item` not an array) | Page loads, no app error, section empty | Not in any story. **Confirm** (minimum assumed: app unaffected) | Robustness | `@recsys-controlled` |
| Partial items (missing `ImageUrl` / `Title`, unknown `DomainItemId`) | No blank or broken card (AC-01). **Confirm** whether the bad item is hidden or shown with a placeholder, and what a click on an unknown song id should do | AC-01 + US-011-AC-02 | Robustness | `@recsys-controlled` |
| Config endpoint failure (`/rule`, `/return-method`) | Page loads; no section content; core features usable | Not observed. **Confirm** | Robustness | `@recsys-controlled` (if the Mode A spike allows) |
| Loader script unavailable (S3) | App fully usable; empty containers | Implied by AC-04; this is Mode 0 | Robustness | Implicit in every system-level suite + one explicit check |
| Real service cold or down | Same as 5xx/timeout for the user; for CI, classified as an outage | REC §8.1, §8.9 | Integration | `@recsys-live` preflight |

For every failure class, one check confirms that **play, favorite (signed in), rating modal opening, search input and sidebar navigation** still work on that page.

### 3.9 Telemetry / data contract

**Principle.**

> Validate against an **explicitly approved data contract**, not against whatever the current payload contains.

Today the approved contract is partial. It consists of the stakeholder decisions (US-022-AC-10/11/12/14/15/16/17, REC §8.6). The observed payloads (REC §8.7) are only a **candidate baseline**. Turning the candidate into an approved per-endpoint allowlist is an acceptance-level task (`acceptance.md`). Until a field is approved, a test reports it as `UNAPPROVED FIELD`. This is a finding, not an automatic pass.

**Matrix (consent granted, signed-in user).** Common to every behavior event: destination `POST https://recsys-tracker-module-*.onrender.com/event` via `sendBeacon`. Observed fields `{ Timestamp, EventTypeId, ActionType, TrackingRuleId, DomainKey, AnonymousId, UserId, ItemId }` (REC §8.7).

| User action | Expected event | Required fields (candidate) | Identifier | Fields that must NOT be sent |
|---|---|---|---|---|
| Play from song card overlay / song row / dual-column row / song-page Play | `/event` Click, `ActionType` View, rule 169 / 170 / 171 / 172 (by card type) | `ItemId` = the PSMusic song id played, `EventTypeId`, `TrackingRuleId`, `Timestamp`, `DomainKey` | `UserId` = username, `AnonymousId` | Password, email, phone, PSMusic access token, refresh cookie, `X-App-Service-Key`, `Authorization`/`Cookie` headers, numeric user id (`sub`), `avatarUrl`, other profile fields |
| Download on song page | `/event` Click, `AddToCart`, rule 168. Observed **two events per click**: **confirm** if intended | as above | as above | as above |
| Favorite in player bar | `/event` Click, `AddToFavorite`, rule 167, on each toggle | as above | as above | as above |
| Rate song | `/event` Rating, rule 165, rating value from the review request | `ItemId` (from URL), rating value | as above | as above + the review comment in a Rating event. **Not observed yet** (writes permanent data) |
| Review song | `/event` Review, rule 166, **`comment` (free text) taken from the review body** | `ItemId`, comment | as above | as above. **Confirm** that sending free-text comments is approved, because users can type personal data into them |
| Click recommendation card | `POST /evaluation` `{ DomainKey, Rank }` | `Rank` = 1-based position | None today | Identity fields are not expected here; item id is absent (F-R5, observation only) |
| Submit header search (Enter) | `POST /recommendation/push-keyword` `{ UserId, AnonymousId, DomainKey, Keyword }` | `Keyword` = trimmed query | `UserId`, `AnonymousId` | as above. Accepted by AC-12 |
| Page load / browsing without interaction | **No `/event`** (AC-16) | - | - | any behavior event |

**Consent dimension.**

| Consent state | Expected (agreed) | Today |
|---|---|---|
| Unset (banner visible) | **Nothing sent** (AC-17) | `/recommendation` with `UserId` and `AnonymousId` sent. **DEFECT** |
| Granted | Behavior only on interaction with song cards (AC-16). Identity limited to `UserId` and `AnonymousId` (AC-11) | Matches for the checked card types |
| Denied | Recommendations still shown and clickable; **no behavior** (`/event`, `/evaluation`, `push-keyword`) and **no identity** (AC-14, AC-15) | `/evaluation` and `push-keyword` still sent, identity still sent. **DEFECT** |

**Contradiction to confirm (Q1):** AC-17 and REC §8.6 allow "default results may still be received" but forbid sending anything. The tracker can only receive results by sending a `/recommendation` request. The likely meaning is "a request with no identity is allowed", but this needs to be confirmed before the oracle is final.

**What the tests detect.**

| Check | How |
|---|---|
| Unexpected fields | Each captured body is compared to the endpoint allowlist; extra keys fail |
| Unexpected identifiers | Only `UserId` (equal to the test username) and `AnonymousId` (equal to `localStorage.recsys_anon_id`) may appear. Any other id-like key fails |
| Sensitive data leakage | **Canaries:** the test user is created with unique canary strings as password and email. The suite searches every recsys URL, query string, header and body (including beacons) for them, plus the access token, service key and refresh cookie values captured from the app side. Exact matches only: a generic phone regex produced a false positive on the username (REC §8.4) |
| Missing required fields | Allowlist marks required keys per endpoint |
| Wrong event type | `EventTypeId` / `ActionType` / `TrackingRuleId` compared with the approved rule for the action |
| Wrong entity id | `ItemId` compared with the song id the test acted on (known from the app request `GET /api/song/:id/player` or the URL) |
| Consent violations | Same capture in all three consent states |
| Unexpected channels | Fail if any WebSocket or non-allowlisted third-party host is contacted during a recommendation test |

**How Playwright observes the traffic.**
- **Browser → third party directly (PSMusic today):** `page.on('request')` gives URL, headers and `postData()` for fetch/XHR. `page.route` can also fulfill or abort (Mode A). `sendBeacon` requests show up, but `postData()` is empty, so an `addInitScript` that wraps `navigator.sendBeacon` records the payload before calling the original (verified in REC §8.7). Shadow DOM is open, so locators reach the cards.
- **Limitation if a backend ever sends events (not the case today):** Playwright only sees browser traffic. Server-to-server calls would be invisible. Options then: point the server's recsys URL at a test double in the test environment and assert on what it received; contract tests in the SUT's own pipeline; or server request logs. If the integration moves server side, this section must be revised.

### 3.10 Test data

| Data | Purpose | How |
|---|---|---|
| Guest, fresh identity | Baseline, consent unset | New context, all storage cleared; the tracker creates `AnonymousId` |
| Signed-in user | `UserId` presence, events with identity | Created through `POST /api/auth/register` with a run-unique username and **canary** password/email (`../test-strategy.md` §7) |
| User after logout | F-R1 (previous username sent): **accepted** by the stakeholder | Same context after UI logout |
| `anonId` only / `userId` + `anonId` | Identity rules | Guest vs signed-in in the same fresh context |
| Consent unset / granted / denied | Consent dimension (§3.9) | Click banner `#recsys-accept` / `#recsys-decline`, or no click. Seeding `recsys_consent_status` is allowed in Mode A only; Mode B uses the real banner |
| Insufficient vs sufficient history | Only to confirm that a cold identity still gets a list or the empty state. **No relevance assertions** | Fresh identity vs an identity used for a few interactions in Mode B |
| Deterministic fixture (Mode A) | Card mapping, clicks, counts | Built from a recorded real response, redacted (no domain key). 50 items, unique `Id`s, `DomainItemId`s that are **real catalog songs** (for example 2179, 4, 1716) so clicks land on valid pages. Variants: empty, 4xx, 5xx, delayed, malformed, partial item, unknown `DomainItemId`. Long titles and multi-artist strings included |
| Config fixtures (Mode A) | Rules, return methods | Recorded from the real config, stored with the date and an approval note. Refreshed only after drift is reported |
| Approved allowlist + config snapshot | Oracles for §3.9 and drift | Versioned in this repository, with the approver and date |

**Isolation from production.**
- Only synthetic users (prefix `psmusicqa_`, `@example.com`). No real user data is used or needed.
- Mode A sends nothing to the real service.
- Mode B traffic goes to the real service under the app's domain key, which mixes test interactions into the domain's behavioral data. Use a **test domain key** or an agreed test marker (Q8). Keep Mode B interactions to a minimum until then.
- Rating and review events need a permanent review in PSMusic. They run only in the approved write environment (`../test-strategy.md` §7.4).

### 3.11 Correlation

The service returns no request id. Correlation uses the run id, the `/evaluation` response `Id` and the response `date` header. Mode A uses fixture id + test id.

### 3.12 Automation boundaries

**Automate:**
- Mode A: section/popup presence per route, card ↔ response mapping, click → song + Rank (first/middle/last × locations, parameterized), popup close, persistence across pages, the whole resilience matrix, event wiring per card type.
- Mode B: preflight, response schema, returned ids resolve, rules/return-method/loader drift, one or two real click-throughs.
- Privacy capture: allowlist, canaries, consent × actions, "no event without interaction".

**Keep manual or exploratory** (acceptance level):
- Approval of new or changed fields (judgement).
- Banner wording, popup layout and its overlap with the player (F-2) until expected behavior is agreed.
- First check of new tracker features or new routes (for example the `/search` and logged-in `/favorites` popups, which are configured but were never observed).
- Rating/review telemetry until an approved write environment exists.

**Do not automate:**
- Relevance or ordering of recommendations.
- Exact counts outside Mode A (they come from remote configuration).
- Assertions on specific songs in Mode B.
- Load or performance against the free-tier host.
- Any check that would need the real service in the app gate.

**Locator notes:** `.recsys-item`, `.recsys-name`, `.recsys-value`, `[id^="recsys-popup-host"]`, `button.recsys-close`, `#recsys-accept`, `#recsys-decline` belong to the third party (`exploration-validation.md` §7). Keep them in one page component so a tracker change is a one-file fix. App containers use `[class*="recommendSongDetails"]` style selectors because classes are CSS-module hashed.

### 3.13 Open questions

These are listed with owners in `acceptance.md` §5 (A-Q1 to A-Q14 map to Q1 to Q14 here).

| # | Question |
|---|---|
| Q1 | Does "nothing is sent" before a choice (AC-17) and after Decline (AC-14/15) still allow an anonymous `/recommendation` request with no identity? |
| Q2 | Approved field allowlist per endpoint (`/recommendation`, `/event`, `/evaluation`, `push-keyword`), including `Timestamp`, `EventTypeId`, `TrackingRuleId`, `DomainKey` |
| Q3 | May review comment text (rule 166) be sent? May the search keyword include anything a user types (AC-12 accepts it)? |
| Q4 | Is the username an acceptable `UserId`, or should it be a pseudonymous id? (Currently accepted, including after logout) |
| Q5 | Expected behavior for timeout, 4xx, malformed response, partial items, config failure, and empty popup on Song/Category |
| Q6 | Is the popup intercepting clicks on core controls (F-2) acceptable? |
| Q7 | Download sends two events per click: intended? |
| Q8 | A test domain key (or test marker) so Mode B traffic does not mix with real behavioral data |
| Q9 | Notice of rule/config and `loader.js` changes, and whether the loader can be versioned |
| Q10 | Can the banner and popup be turned off in test builds (U-4.2)? |
| Q11 | How should the app repo trigger this repo, and who receives `recsys-*` notifications? |
| Q12 | Should a new privacy defect block a release (not a PR)? |
| Q13 | Is "Recommends for you" on a song page meant to be specific to that song? (Accepted as is by SD-10) |
| Q14 | Is the tracker clock offset (about +14 h on `/evaluation` timestamps, F-R4) a recsys issue to report? |

---

## 4. Elasticsearch (search, US-010)

| Item | Strategy |
|---|---|
| Interface | API server ↔ Elasticsearch `songs` index. Not visible to the browser; reached through `GET /api/song/search` |
| Status | **BLOCKED.** Outdated API key; every search returns `total: 0` (SD-1, F-1). The API fails to start without valid Elasticsearch config (`R:automation-considerations.md` §1) |
| Controlled mode | Not available from this repository: the double would have to replace Elasticsearch behind the server. PSMusic's search UI logic (debounce, 2-char threshold, tabs, empty state) is tested at **system level** by fulfilling `GET /api/song/search` in the browser with recorded responses |
| Real mode | After the key renewal: preflight = one search for a known indexed title. Checks: known titles are found (US-010-AC-03/05), "Top result" for an exact name (AC-08), size clamp to 10 (AC-09), empty result message (AC-06) |
| Not tested | Fuzzy matching and diacritic behavior beyond the ACs (AC-10, open), index freshness and who fills the index (unknown) |
| Failure classes | Search error or 5xx with a healthy API → availability or contract; empty results for known titles → environment issue until the index content is confirmed |
| Entry criterion | Key renewed + list of known indexed titles from the SUT team |
| Suite | `sit-live` (`@search-live`), nightly |

## 5. S3 media and image CDNs (US-011, US-012, US-013)

| Item | Strategy |
|---|---|
| Interface | Browser ↔ S3 (`psmusic.s3.ap-southeast-2.amazonaws.com`) for MP3 and LRC; image CDNs for covers |
| Controlled mode | Fault injection with `page.route`: lyric file fails → no lyrics shown, page usable (US-011-AC-08, open); MP3 fails → player handles it (expected behavior **confirm**); download fails → `download_error` toast (US-012-AC-02) |
| Real mode | Song 1 MP3 and LRC reachable; audio `currentTime` advances (`expect.poll`); download produces an `.mp3` named per US-012-AC-01 |
| Not tested | Audio quality (acceptance, manual), CDN image content |
| Note | System-level playback tests use real S3, because playback is core product value. A real S3 outage in the gate is classified as availability (`../test-strategy.md` §11.3) |
| Suite | `sit-controlled` (`@media-controlled`), `sit-live` (`@media-live`) |

## 6. Abstract email reputation API (US-001)

| Item | Strategy |
|---|---|
| Interface | Browser ↔ `emailreputation.abstractapi.com` during UI sign-up |
| Status | UI success path **BLOCKED**: synthetic addresses are rejected; a real deliverable Gmail mailbox is needed |
| Controlled mode | Only if the product team approves a mock (open item in `../test-strategy.md` §13.3): fulfil the check with "deliverable" and "not deliverable" responses, then verify the register call and messages. Error and timeout of the check → expected UI behavior **confirm** |
| Real mode | **Not run from automation**: each call uses third-party quota and needs a real mailbox |
| Suite | `sit-controlled` (`@email-controlled`), after approval |

## 7. Remote PostgreSQL (environment, not a test target)

The database is reached only through the PSMusic API. It is shared and cannot be cleaned (`../test-strategy.md` §7.4). No test at this level targets it directly. Its unavailability is classified as an environment failure.

---

## 8. Traceability

| Decision | Traced to |
|---|---|
| Recommendation tests never in smoke or the app gate; tracker blocked elsewhere | US-022 "Test placement" |
| Controlled mode for deterministic integration checks; real mode scheduled and non-blocking | REC §8.1/8.9 (instability), US-022 placement |
| No relevance testing | US-022 scope |
| Approved allowlist instead of observed payload | US-022-AC-10/11, SD-9, REC §8.6 |
| Privacy defects asserted as known defects | `exploration-validation.md` §2 (AC-14/15/17) |
| Search real mode only after key renewal | SD-1, US-010 BLOCKED |
| No real Abstract API calls from automation | US-001 BLOCKED, `B:authentication.md` §3, `B:test-data.md` §1 (quota) |
| Lyric failure handled | US-011-AC-08 |

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Created from `recommendation-test-strategy.md` (now merged here) and the system-integration part of `test-strategy.md` §4. Mode A reclassified from system to system integration. Sections for Elasticsearch, S3 and Abstract API added |
