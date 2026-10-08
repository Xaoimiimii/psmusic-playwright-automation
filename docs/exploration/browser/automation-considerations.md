# PSMusic - Automation Considerations (from Browser Runtime Exploration)

Implications for a future Playwright + TypeScript suite, derived only from what was observed on 2026-09-30. These are considerations, not test cases or code.

## AC-1 Environment and data safety
- The local API writes to a **remote shared PostgreSQL**. Any test that registers, favorites, reviews or plays for 20 s+ leaves **permanent rows** (reviews and streams have no delete path in the UI). Agree on a dedicated database or a cleanup process before running write tests at scale.
- Base URLs observed: UI `https://localhost:5174`, API `https://localhost:7215/api` (both HTTPS with local certs). Keep them in config (`baseURL`, env vars) and set `ignoreHTTPSErrors` only if the CI certificate differs (UNKNOWN).
- Port 5174 was used here (5173 is occupied by another project on this machine), so the port must be configurable.

## AC-2 Third-party overlays (must be handled)
- **Privacy banner** `#recsys-privacy-banner`: dismiss with `#recsys-decline` on first load, or pre-seed `localStorage.recsys_consent_status` (value not recorded; capture it once).
- **Recommendation popup** `[id^="recsys-popup-host"]` (shadow DOM): appears on song pages and **intercepts clicks**. Options: close it via `button.recsys-close` (verified), register a `page.addLocatorHandler` for it, or block `recsys-tracker-module-*.onrender.com` via `page.route` in UI tests (not tried; would also empty "Recommends for you").
- The tracker is an external free-tier host (onrender.com), a source of latency and flakiness. Consider blocking it outside tests that target recommendations.

## AC-3 Locator strategy constraints
- No `data-testid`; hashed CSS-module classes; many icon buttons without accessible names; player controls rendered 2-3 times. Page objects will need:
  - role/name locators for text controls (pinned language),
  - `href` locators for song/artist/category links (`a[href="/song/1"]`), which are the most stable identifiers available,
  - partial-class locators (`[class*="play-pause-btn"]`) scoped to `[class*="playerWrapper"]` for the player, flagged as fragile,
  - form-scoped locators on `/auth` (both forms are always in the DOM and share `name="name"`).
- Chart/artist-page song titles are **buttons without href**, so the song id is not in the DOM. Use titles plus the resulting URL, or read ids from API responses.
- Requesting `data-testid`/`aria-label` on the player, header icons, and modals from the SUT team would remove most fragility (a request, not a change made here).

## AC-4 Language pinning
All labels (including accessible names) change with `i18nextLng`. Seed `localStorage.i18nextLng = 'en'` via `storageState` or `addInitScript` before navigation. Even in English, server messages and the rating modal are Vietnamese, so assertions must use the actual Vietnamese strings (`Tài khoản không tồn tại`, `Gửi đánh giá`, …).

## AC-5 Waiting and synchronization
- Route change and content swap are not simultaneous (Charts showed the Genres DOM for ~1-2 s after the URL changed). Wait on a page-specific heading or a `waitForResponse` on its API call, not on the URL alone.
- Session restore is async: logged-in UI appears only after `POST /auth/refresh`. Wait for the avatar (or refresh response) before interacting. User-specific flags on `/song/:id/detail` are wrong on hard reload (F-5). Prefer in-app navigation or assert via `/player`.
- Duplicate requests (StrictMode) mean `waitForResponse` resolves on the first of two identical calls. Don't count calls.
- Audio: `audio.currentTime` needed ~4 s to start advancing (network buffering). Use `expect.poll` on `currentTime`, not fixed sleeps.
- Stream recording needs ~20 s of real playback, which is expensive in UI tests. Better covered at API level, with one slow UI test if needed.
- Auth inline messages (`form small`) persist >15 s, so they're safe to assert with web-first assertions.

## AC-6 Authentication for tests
- Tokens are memory-only; the reusable session artifact is the **HttpOnly `RefreshToken` cookie** (7 days). `storageState` after one UI login should restore sessions via `/auth/refresh` (RUNTIME-INFERRED; not exercised with a saved state file).
- API tests must send `X-App-Service-Key` (value from env; it is visible to any browser user but should still not be committed) plus `Authorization: Bearer` from `/auth/login`.
- **UI registration cannot be automated with synthetic data** (external mailbox validation). Create users via `POST /api/auth/register`. Treat UI sign-up as validation-message coverage only, or route/mock the Abstract API call in the browser (`page.route` on `emailreputation.abstractapi.com`). Mocking is a test-design decision for later.

## AC-7 Data-sensitive assertions
- Counters, chart order, trending artists, recommendations, and next-batch are shared or random. Assert structure and deltas, not absolute values or order, unless the environment is seeded.
- A user can review a song only once in the UI. Use a fresh user or a not-yet-reviewed song per rating test.
- Search returned nothing until 2026-10-08 (F-1, outdated Elasticsearch key). The key is renewed and the API returns real results (`search.md`); the browser UI has not been re-run yet. The index is filled only at API startup, so pick search titles from songs that existed before the API started.

## AC-8 Negative/edge coverage available at runtime
Unknown song -> "Song not found" (404); unknown artist/category -> 204 + blank page; unknown route -> blank; missing service key -> 401 JSON; missing bearer on protected endpoints -> 401 empty body; invalid bearer on public endpoints -> 200.

## AC-9 Evidence artifacts
Screenshots: `evidence/psmusic-auth-default.png`, `evidence/psmusic-recsys-popup.png`. Raw Playwright MCP snapshots and console logs from this session were written to the MCP output folder of the other workspace (`foodly-selenium-automation/.playwright-mcp/`), which is not part of this repo.
