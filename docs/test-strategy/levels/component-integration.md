# PSMusic - Component Integration Test Strategy

| Item | Value |
|---|---|
| Level | Component integration (ISTQB): interfaces between PSMusic's own parts |
| Parent | `../test-strategy.md` |
| Related levels | `system.md` (business rules and user-visible behavior), `system-integration.md` (external systems) |
| Status | Draft 1, 2026-10-01 |

---

## 1. Test object

The interfaces **inside** PSMusic:

| Interface | Example |
|---|---|
| SPA ↔ API contract | The SPA sends the request the API expects, and the API returns the shape the SPA reads |
| API key filter and auth middleware ↔ controllers | `X-App-Service-Key` on every `/api/*` call; bearer token on protected endpoints |
| API ↔ database (seen through the API) | A write through one endpoint is visible through another endpoint |

Not in this level: business rules as the user experiences them (`system.md`), and external systems (`system-integration.md`).

## 2. Test basis

`user-stories.md` "Technical behaviors", the API contract as observed (`B:api-inventory.md`, `R:api-inventory.md`), US-002, US-003, US-004, US-007-AC-05, US-009-AC-05, US-011-AC-02, US-010-AC-09, US-023-AC-02.

The README API description is outdated (G-01 to G-04). Swagger at `https://localhost:7215/swagger` is used for reference only (Development only, no descriptions). Where a story exists, the story wins over the observed contract.

## 3. Scope

| In scope | Stories / evidence |
|---|---|
| `X-App-Service-Key` missing or wrong → 401 `{"message":"Unauthorized Access"}` | "Technical behaviors", X-1 |
| Protected endpoints → 401 with an empty body without a valid bearer; invalid bearer on a public endpoint → served as guest (200) | "Technical behaviors", X-7 |
| Auth contract: register (no token returned, password never returned), login (token + user + `RefreshToken` cookie with its flags), refresh (200 with `isSuccess:false` on failure; refresh token re-issued with a renewed 7-day expiry each time), logout (cookie deleted, message), `GET /api/auth/me` | US-001-AC-04/05/06/07, US-002-AC-03/04/05, US-003-AC-02, US-004-AC-02 |
| Paged shape `{ items, page, limit, totalItems, totalPages }`, camelCase | "Technical behaviors", X-4, X-8 |
| Page-size clamp (search size below 10 raised to 10) | US-010-AC-09 (runs once search is unblocked) |
| Status codes for unknown ids: song 404; category and artist **404 agreed** (today 204, DEFECT) | US-007-AC-05, US-009-AC-05, US-011-AC-02, SD-4 |
| Write → read consistency: favorite toggle → `/player` and `/song/favorites`; review → `/rating/{id}/reviews`; login → `/auth/me` | US-015-AC-01/02/04, US-017-AC-02 |
| SPA → API request shape for actions: player heart sends `POST /favorite-toggle` with no body; rating submit sends `{rating, comment}` (and an ignored `user`) | `B:api-inventory.md` 2.10, 3.9 |
| Server messages are the agreed Vietnamese literals | "Technical behaviors" |

| Out of scope at this level | Where it goes |
|---|---|
| Review uniqueness, rating range, stream counting, cross-user profile read (business rules) | `system.md` |
| Rendering, client validation, redirects | `system.md` |
| Elasticsearch, S3, recsys, email check | `system-integration.md` |
| Unit-level logic of PSMusic | Component level, owned by the SUT team (`../test-strategy.md` §4) |
| Edge cases still being explored: `page=0`, `size=0`, missing `keyword`, unknown song id for favorite/stream | First explored manually (`exploration-validation.md` §8), then added here once the expected result is agreed |

## 4. Approach

- **Interface:** mainly `APIRequestContext` against `PSMusic.Server`. A browser is used only when the SPA side of the contract is under test (does the UI action send the right request); the assertion is then on the captured request, not on the screen.
- **Oracle:** the agreed story; otherwise the observed contract, reported as an observation when it differs.
- **Assertions:** status, body shape (schema), headers, cookie flags. No absolute counts on shared data (assert deltas).
- **External systems:** not needed, except that the API server cannot start without valid Elasticsearch configuration (`system-integration.md` §4).

## 5. Entry criteria

- PSMusic API reachable; service key and base URL configured.
- Test users can be created through `POST /api/auth/register`.
- For the 401-retry and expiry paths (US-003-AC-04/05): an environment with a short token lifetime.

## 6. Exit criteria

- Every in-scope contract has a passing check, or a failing check linked to a known defect (US-007-AC-05, US-009-AC-05).
- No schema difference left unexplained (each is a defect or an approved contract change).

## 7. Environment and data

- Local or CI environment per `../test-strategy.md` §8. No browser needed for most tests.
- Data per `../test-strategy.md` §7: run-unique users created through the API; read-only catalog ids; unknown ids `99999999`. Favorites toggled back in teardown. No permanent writes at this level, except reviews in the approved write environment for the write → read check.

## 8. Suites and CI role

| Tag | Content | CI |
|---|---|---|
| `@ci-contract` + `@smoke` | API key 401, one public endpoint, login contract | App gate (blocking) |
| `@ci-contract` + `@critical` | Full auth contract, 401 shapes, paging shape, unknown-id status codes, write → read | Merge to main (blocking) |
| `@ci-contract` + `@known-defect` | 204 vs agreed 404 | Reported as known defects |

Component integration tests are the fastest UI-free checks. They run first in every pipeline, so a contract break fails quickly before slower system tests start.

## 9. Story coverage

| Story | Covered here |
|---|---|
| US-001 | Register contract, duplicates, no token, no password returned |
| US-002 | Login contract, error messages, cookie flags |
| US-003 | Refresh contract; 401-retry once the environment allows |
| US-004 | Logout contract |
| US-005 to US-009 | Paging shape, status codes for unknown ids |
| US-010 | Size clamp (after unblock) |
| US-011 | 404 for unknown song; detail/player contract |
| US-014 | 401 on protected endpoints |
| US-015, US-016 | Toggle response and read-back |
| US-017 | Submit contract and read-back |
| US-021 | Stream endpoint contract (the counting rule is in `system.md`) |
| US-023 | `GET /api/auth/me` 401 without a token (AC-02) |

## Revision history

| Date | Change |
|---|---|
| 2026-10-01 | Created from `../test-strategy.md` §4 (component integration row) |
