# PSMusic - Recommendations (Browser Runtime Exploration)

Focused pass on 2026-09-30 (second session). Scope: (1) the `/recommendation` response body and how it maps to the rendered cards, (2) where clicking a recommendation card goes, in the in-page section and in the popup. Labels as in `application-overview.md`. The recsys domain key and the anonymous id are redacted.

Session state: browser storage persisted from the first session (same `recsys_anon_id`). The test user `psmusicqa_browser01` was **logged out**, but `recsys_cached_user_info` was still present (see F-R1).

## 1. Where recommendations come from - RUNTIME-OBSERVED
- **Not the PSMusic API.** A third-party script calls `POST https://recsys-tracker-module-d8ty.onrender.com/recommendation` (Express behind Cloudflare, `201`, ~0.7 s).
- **Two calls per full page load of `/song/:id`:**

| Call | Request body | Response items | Feeds |
|---|---|---|---|
| A | `{ AnonymousId, DomainKey, NumberItems: 50, UserId }` | 50 | Popup "Recommendations just for you" (50 items) |
| B | `{ AnonymousId, DomainKey, NumberItems: 10, UserId }` | 10 | In-page "Recommends for you" section (10 items on a fresh load) |

- Response B's 10 items were **identical, in the same order, to the first 10 of A**.
- **No new `/recommendation` call on in-app navigation** between song pages; both lists stayed identical on `/song/1`, `/song/2179`, `/song/1716`, `/song/581`. Recommendations are **not specific to the song being viewed**. They depend only on the anonymous id / user id sent (RUNTIME-INFERRED).
- The recommended order in this session matched the first session's (starting "Đổi Thay", "Nàng Thơ", "Chuyện Của Mùa Đông", …), so it is stable for the same identity over at least ~30 min.

## 2. Response body - RUNTIME-OBSERVED

```json
{
  "item": [
    {
      "Id": 38081,
      "DomainItemId": "2179",
      "Title": "Đổi Thay",
      "Description": "<English marketing-style paragraph about the song>",
      "ImageUrl": "https://image-cdn.nct.vn/song/…/….jpg",
      "Categories": ["Nhạc Trẻ", "Nhạc Việt"],
      "Artist": "Noo Phước Thịnh"
    }
  ],
  "search": "",
  "lastItem": ""
}
```

| Field | Type | Observed meaning | Evidence |
|---|---|---|---|
| `item` | array | Recommendations, length = `NumberItems` (50 / 10) | RUNTIME-OBSERVED |
| `item[].Id` | number | The **recsys service's own id** (e.g. 38081). Rendered as `data-id` on each card | RUNTIME-OBSERVED |
| `item[].DomainItemId` | string | The **PSMusic song id**: `"4"` -> "Nàng Thơ" = `/song/4`; `"2179"` -> `/song/2179` "Đổi Thay"; `"1716"` -> `/song/1716` "Chuyện Của Mùa Đông" | RUNTIME-OBSERVED |
| `item[].Title` | string | Card title (also the `img alt` and `.recsys-name[title]`) | RUNTIME-OBSERVED |
| `item[].Artist` | string | Comma-joined artists, shown as the card's second line | RUNTIME-OBSERVED |
| `item[].ImageUrl` | string | Card image | RUNTIME-OBSERVED |
| `item[].Categories` | string[] | DB category names (Vietnamese). 1-4 per item (histogram over 50: 1x4, 2x42, 3x3, 4x1). **Not rendered** | RUNTIME-OBSERVED |
| `item[].Description` | string | English generated-looking description; present on all 50. **Not rendered** | RUNTIME-OBSERVED |
| `search`, `lastItem` | string | Always `""` here. PURPOSE-UNKNOWN | RUNTIME-OBSERVED |

All 50 `DomainItemId`s were unique; no empty images or descriptions.

## 3. Rendering - RUNTIME-OBSERVED

Both lists are rendered by the third-party script **inside shadow roots**, with the same card markup:

```html
<div class="recsys-item" data-id="38081">          <!-- recsys Id, NOT the song id -->
  <div class="recsys-img-box"><img src="…" alt="Đổi Thay"></div>
  <div class="recsys-info">
    <div class="recsys-name" title="Đổi Thay">Đổi Thay</div>
    <div class="recsys-field-row"><span class="recsys-value">Noo Phước Thịnh</span></div>
  </div>
</div>
```

| List | Host element | Shadow root | Items | Card cursor | Links |
|---|---|---|---|---|---|
| In-page section under h2 "Recommends for you" | `div[class*="recommendSongDetails"][data-recsys-loaded="true"]` (app element) | yes (open) | **10 on fresh load; 50 after in-app navigation** to another song page | `pointer` | none (`<a>` count 0) |
| Popup "Recommendations just for you" | `div#recsys-popup-host-Song Detail Popup-<timestamp>` | yes (open) | 50 | `pointer` | none |

- The section host has **no light-DOM children**, so `innerText` / `querySelector` from the page see nothing. Playwright locators pierce open shadow roots, and `page.locator('[class*=recommendSongDetails] .recsys-item')` worked.
- The popup host keeps the **same instance** (same timestamp id) across in-app navigation between song pages.
- Accessibility: the cards are `div`s without roles; the only accessible text is the `img alt` / title text.

## 4. Clicking a card - RUNTIME-OBSERVED

| Test | Card | Destination | Side requests |
|---|---|---|---|
| In-page section, 1st card | "Đổi Thay" (`data-id` 38081, `DomainItemId` 2179) | `/song/2179`, h1 "Đổi Thay" | `POST …onrender.com/evaluation` body `{ DomainKey, Rank: 1 }` -> 201 `{ Id, DomainId: 74, Rank: 1, Timestamp }`; then `song/2179/detail`, `song/2179/related`, `artist/2179/artists` |
| Popup, 3rd card | "Chuyện Của Mùa Đông" (`data-id` 37618, `DomainItemId` 1716) | `/song/1716`, h1 "Chuyện Của Mùa Đông" | `POST /evaluation` with `Rank: 3` |

- Navigation happens **in the same tab** (no new page) and **in-app**: no `auth/refresh` and no new `/recommendation` call on the click.
- The URL uses the item's **`DomainItemId`**, so the card -> song mapping is `DomainItemId` -> `/song/{DomainItemId}`. Because the DOM exposes only the recsys `Id` (`data-id`), the song id is **not discoverable from the card markup**; it only shows in the response body or after clicking.
- `/evaluation` sends only the 1-based **position** (`Rank`) of the clicked card, **not the item id or which list** (section vs. popup) it came from.
- The popup does **not close** on card click; it remains on the next song page.
- Clicking works with Playwright's normal click once the popup is not covering the target; the section card was clicked after closing the popup.

## 5. Findings

**F-R1 Logged-out browser still sends the previous user's username** - OBSERVATION - EXPECTATION UNKNOWN
- Steps: log in as `psmusicqa_browser01`, log out, open `/song/1`.
- Observed: both `/recommendation` bodies include `"UserId":"psmusicqa_browser01"` although no one is logged in (stale `localStorage.recsys_cached_user_info`). Recommendations for a guest are therefore personalized to the last user on this browser.
- Relevance: privacy / shared-device concern; also test isolation (a guest test can inherit a previous test's identity unless storage is reset).

**F-R2 In-page section item count differs by entry path** - OBSERVATION
- Fresh load of `/song/1`: section 10 items (from the `NumberItems:10` response). After in-app navigation to other songs: section shows 50 items. The first session also saw ~50 cards in the section. Count assertions are unreliable.

**F-R3 Recommendations are not song-contextual** - OBSERVATION - EXPECTATION UNKNOWN
- The same list shows on every song page (no request per song). Whether "Recommends for you" on a song page is meant to relate to that song is UNKNOWN.

**F-R4 Tracker timestamp offset** - OBSERVATION
- `/evaluation` response `Timestamp: "2026-10-01T04:23:57.000Z"` while the browser session time was ~2026-09-30 14:24 UTC (earlier API `date` header `Wed, 30 Sep 2026 13:57 GMT`), about +14 h. Cause UNKNOWN (third-party clock or timezone handling).

**F-R5 Click telemetry lacks item/list identity** - OBSERVATION
- `/evaluation` carries only `Rank`, so the service cannot tell section from popup clicks from this payload alone (unless it correlates by other means - UNKNOWN).

## 6. Automation notes
- Locators (verified): section cards `page.locator('[class*="recommendSongDetails"] .recsys-item')`; popup cards `page.locator('[id^="recsys-popup-host"] .recsys-item')`; card title `.recsys-name`; artist `.recsys-value`; popup close `button.recsys-close`. Third-party classes, so stable only as long as the tracker script is unchanged.
- To assert navigation from a card, capture the `/recommendation` response (`page.waitForResponse(/onrender\.com\/recommendation/)`) and map `Rank` -> `item[Rank-1].DomainItemId` -> expected `/song/{id}`, or read the resulting URL.
- Results depend on `recsys_anon_id` and `recsys_cached_user_info`. Use a clean `storageState` for determinism and to avoid F-R1 leakage between tests.
- The service is a free-tier external host. Consider isolating recommendation tests and blocking the tracker (`page.route`) everywhere else.

## 7. Not explored in this pass
Home page "Recommends for you" behavior; logged-in vs. guest difference with a clean identity; whether favorites/ratings/plays change recommendations; tracker event payloads other than `/evaluation`; "Accept all" vs. Decline; popup behavior on non-song pages.

## 8. Third browser pass (2026-09-30, Playwright MCP, `https://localhost:5174`)

Scope: the items US-022 still had as UNKNOWN. Domain key, anonymous id, tokens and the test password are not recorded. Created the test user `psmusicqa_priv1790780407163` (email `psmusicqa.priv1790780407163@example.com`, registered by `POST /api/auth/register` from the page context; password not saved). Its password was a canary string used to search the tracker traffic.

### 8.1 Where recommendations appear (warm identity, consent granted, 9 s wait per route) - RUNTIME-OBSERVED

| Route | Inline section | `NumberItems` | Popup (50) |
|---|---|---|---|
| `/` | yes, 50 cards | 50 | no |
| `/song/:id` | yes, 10 cards | 10 | yes |
| `/category/:id` | yes, 20 cards | 20 | yes |
| `/genres`, `/charts` | no section | - | yes |
| `/artist/:id`, `/search`, `/auth` (`/favorites` redirects a guest to `/auth`) | no | no `/recommendation` call | no |

- Each page asks for its own `NumberItems`, so the count differs per page (refines F-R2). Logged-in `/favorites` was not checked.
- The service result is cached per tab in `sessionStorage` (`recsys-cache-<domainKey>`), so a failed or blocked call does not clear cards already shown. Clear `sessionStorage` before a failure test.
- **First visits with empty storage were empty**: after clearing storage, 8 routes visited one after another, 6 s each, made no `POST /recommendation` and showed no cards (only the config GETs ran). A later load in the same browser fired the calls and showed cards. Cause UNKNOWN (cold free-tier host or tracker start-up). This probably explains the earlier empty Home in `user-flows.md`, but it is not proven.

### 8.2 Card content vs. destination - RUNTIME-OBSERVED
- Home, 50 cards: for every card `data-id`, title, artist and image equal `Id`, `Title`, `Artist`, `ImageUrl` of the matching item in the `/recommendation` response. 50 unique `DomainItemId`s.
- Clicked Home cards 1, 25 and 50: each opened `/song/{DomainItemId}` in the same tab. The h1 equals the card title, every artist name from the card appears on the page, the card image URL is used on the page, and `POST /evaluation` carried `Rank` 1, 25 and 50.

### 8.3 Failure behavior - RUNTIME-OBSERVED
- Aborting `/recommendation` (Home, Song and Category, with `sessionStorage` cleared): the "Recommends for you" heading stays, there are no cards, no popup, no page errors and the page content is normal. HTTP 500 and `{ item: [] }` were checked on Home only, with the same result.

### 8.4 Privacy capture (login, browse) - RUNTIME-OBSERVED
- Session: login through the UI, then Home, song, category, charts and a page load of `/search?q=<keyword>`. 50 requests went to the recsys host. The only POST path was `/recommendation`.
- No password, email address, access token or `X-App-Service-Key` value was found in any recsys URL, header or body. No `Authorization` or `Cookie` header was sent. The only user data is `UserId` (username) and `AnonymousId`.
- **Correction:** this session opened `/search?q=<keyword>` directly, which does **not** send the keyword. Typing in the search bar does (see 8.7). So the earlier statement that the search keyword is not sent was wrong.
- `recsys_cached_user_info` holds `{ userField, userValue, timestamp }`, meaning the username.
- A generic phone-number regex on the body matched the numeric part of the username (false positive). Use exact canary values instead.
- Not covered: UI sign-up (the account was created through the API), rating, review and UI logout.

### 8.5 Consent (Decline) - RUNTIME-OBSERVED
- With no consent stored (banner visible), `/recommendation` was already sent, including `UserId` for a logged-in user.
- After **Decline** (`recsys_consent_status` = `denied`): recommendations are still requested and shown. The results were identical, in the same order, to those after Accept all for the same identity.
- After Decline the following requests were still sent (all carrying `UserId` and `AnonymousId` except `/evaluation`): `POST /recommendation` on every page; `POST /evaluation` `{ DomainKey, Rank }` when a recommendation card is clicked; `POST /recommendation/push-keyword` when a search is typed and submitted.
- After Decline, `POST /event` was **not** sent for any song-card click in the matrix of 8.8 (correct).
- Accept all sets `granted`.

### 8.6 Decisions from the stakeholder
- Sending the previous username after logout (F-R1) is a feature and is acceptable.
- Decline means the app may only **receive** recommendations (default results). Nothing may be sent: no behavior (click, rating, review, search) and no identity (`UserId`, `AnonymousId`). Every request in 8.5 that carries these is a defect.
- Behavior may be sent only when the user interacts (click, rating, review) with song cards, and only after consent. There are several song-card types with different selectors, so every type must be checked (8.8).

### 8.7 Tracker configuration and endpoints - RUNTIME-OBSERVED
Read from `GET /rule/domain/<key>`, `/rule/event-type`, `/return-method/<key>`, `/search-keyword-config?domainKey=<key>` (domain key redacted). The tracker script decides what to track from this configuration, so it can change without any change in this repository.

| Rule (id) | Event type | Target selector | Trigger / payload source |
|---|---|---|---|
| Rating (165) | Rating | `.submit-rating-btn` | `POST /api/rating/:id/add-review`: item id from the URL, `rating` from the body |
| Review (166) | Review | `.submit-rating-btn` | same request: item id from the URL, **`comment` (free text) from the body** |
| Favorite (167) | Click, `AddToFavorite` | `.lucide-heart` | `POST /api/song/:id/favorite-toggle` |
| Download (168) | Click, `AddToCart` | `.btn-download` | item id from the page URL `/song/:id` |
| Play Button (169) | Click, `View` | `.play-button` | `GET /api/song/:id/player` |
| Play Song Row (170) | Click, `View` | `.sr-song-tab` | `GET /api/song/:id/player` |
| Play Dual Row (171) | Click, `View` | `.sr-dual-column` | `GET /api/song/:id/player` |
| Play Details (172) | Click, `View` | `.btn-play` | item id from the page URL `/song/:id` |

- Search keyword tracking: input selector `.search-bar`.
- Event types defined: Click, Rating, Review, Scroll, Page View. Only Click, Rating and Review have rules.
- Return methods (`GET /return-method/<key>`, 9 configurations, all `Delay` 0, item link `/song/{:id}`, shown fields image, title, artist):

| Id | Type | Value (host or route) | `maxItems` | Grid columns |
|---|---|---|---|---|
| 113 | inline | `.recommendSys` (Home) | 50 | 5 |
| 141 | inline | `.recommendSongDetails` (Song detail) | 10 | 5 |
| 146 | inline | `.recommendCategoryDetails` (Category) | 20 | 5 |
| 140 | popup | `/song` | 50 | 2 |
| 145 | popup | `/category` | 50 | 2 |
| 142 | popup | `/genres` | 50 | 2 |
| 143 | popup | `/charts` | 50 | 2 |
| 144 | popup | `/favorites` | 50 | 2 |
| 114 | popup | `/search` | 50 | 2 |

  Popup layout: 500 px wide, bottom right. Observed matches the configuration for Home, Song, Category, Genres and Charts (8.1, 8.9). The `/search` popup and the `/favorites` popup for a logged-in user were **not observed** (no `/recommendation` call on `/search`; a guest is redirected from `/favorites`).
- The app's classes are CSS-module hashed (for example `_sr-song-tab_n4hpo_43`), so the rule selectors are matched loosely by the tracker. Use `[class*="sr-song-tab"]` style selectors in tests.
- Endpoints seen: `POST /recommendation`, `POST /evaluation`, `POST /event`, `POST /recommendation/push-keyword`.
- `POST /event` is sent by `navigator.sendBeacon` as JSON, so Playwright `postData()` is empty. Read it by wrapping `sendBeacon` in an init script. Payload observed: `{ Timestamp, EventTypeId, ActionType, TrackingRuleId, DomainKey, AnonymousId, UserId, ItemId }`. `ItemId` is the song id. No email, password or token.
- `POST /recommendation/push-keyword` body: `{ UserId, AnonymousId, DomainKey, Keyword }`, sent when a search is submitted with Enter in the header search bar (not while typing, and not when `/search?q=` is opened directly).

### 8.8 Behavior sent per song-card interaction (logged-in user, first matching element clicked) - RUNTIME-OBSERVED

| Card type (selector fragment) | Where | Consent granted | After Decline |
|---|---|---|---|
| Song card play overlay (`play-button-overlay`) | `/genres` (40), `/category/:id` (12) | `/event` View, rule 169 | nothing (correct) |
| Chart / artist / "other songs" row (`sr-song-tab`) | `/charts` (20), `/artist/:id` (20), `/song/:id` (30) | `/event` View, rule 170 | nothing (correct) |
| Chart dual-column row (`sr-dual-column`) | `/charts` (20) | `/event` View, rule 171, when the blank area of the row is clicked (`GET /api/song/:id/player`). Clicking the song title opens `/song/:id` and clicking an artist opens `/artist/:id`; both send no player request and **no event** | nothing |
| Song page Play button (`btn-play`) | `/song/:id` | `/event` View, rule 172 | nothing (correct) |
| Song page Download (`btn-download`) | `/song/:id` | `/event` (two events for one click) and a file download | nothing (correct) |
| Song page action-bar heart (`_action-buttons` `svg.lucide-heart`) | `/song/:id` | no `POST /api/song/:id/favorite-toggle` and no `/event` (this heart does not call the favorite API) | nothing |
| Player bar heart (`svg.lucide-heart` in `_control-buttons`, outside `main`) | after a song is playing | `POST /api/song/:id/favorite-toggle` and `/event` `AddToFavorite`, rule 167, on each toggle (2 of 2) | not tested |
| Recommendation card | Home, Song, Category, popup | `POST /evaluation` `{ Rank }` | **still sent (defect)** |
| Trending artist card (`item-card-column`) | `/` | nothing (not a song card) | nothing |
| Search bar submit (`search-bar input`) | header | `POST /recommendation/push-keyword` | **still sent (defect)** |

- **No interaction, no event:** page loads and browsing produced no `/event`.
- **Search results song cards could not be checked.** `GET /api/song/search` returns 200 but the page says "No results found" for every keyword tried ("noo", "noo phuoc", "Doi Thay", "Đổi Thay", "Hoàng Dũng", "Chờ Anh Nhé", "a"), so no song row is rendered (search data availability is U-01). Their selectors are UNKNOWN.
- Rating and review (`.submit-rating-btn`) were **not exercised** because they write data; review text (`comment`) is sent to the tracker by rule 166 when consent is granted.
- Favorite was toggled twice on song 1 through the player heart for the test user, so the state is restored.
- Downloading song 1 saved an mp3 into `.playwright-mcp/` of the Playwright MCP working directory; it can be deleted.

### 8.9 Corrections and second look at rules (2026-09-30, after the stakeholder's review)
- **Dual-column rule works.** My first run clicked the middle of the row, which is the song title link and only navigates. Clicking the blank right side of the row sends `/event` View (rule 171); the same for rows 1 and 4 (`sr-song-tab` corner click: rule 170). The event depends on the app's `GET /api/song/:id/player` request, so navigation clicks send nothing.
- **Favorite rule.** Rule 167 targets `.lucide-heart` and fires only with `POST /api/song/:id/favorite-toggle`. The song-page action-bar heart does not send this request, so it produces no event. The player heart does (`AddToFavorite`). The sidebar heart is a navigation link.
- Sidebar and action-bar hearts match `.lucide-heart` too; an event depends on the API request, not on the selector alone.
- **Instability seen:** for a while, with the logged-in test user, the tracker sent `/recommendation` (or nothing) but rendered no card and no popup on any page (12 s wait), while the service itself answered `201` in 0.65 s. After clearing cookies, `localStorage`, `sessionStorage` and IndexedDB (guest again), rendering came back. The cause is UNKNOWN (stale tracker state or identity are suspects). Reset the whole browser state between recommendation tests and treat "no render" as a third-party outage, not an app failure.
- Guest, warm state, route check after the reset: Home inline 50 and no popup; Category inline 20 and popup 50; Genres popup 50; Charts popup 50; Artist and Search: no `/recommendation` call; `/favorites` redirects a guest to `/auth`.

## 9. Live tracker on 2026-10-12 (while implementing TS-REC-12)

Local dev build, Chromium headless, tracker **not** blocked, fresh browser context per run. Domain key redacted.

| # | Observation | Evidence |
|---|---|---|
| R-9.1 | **No consent banner.** On a first visit with empty storage, `#recsys-privacy-banner` did not appear within 20 s (Home). The tracker loaded (`loader.js`, `recsys-tracker.iife.js`) and fetched its configuration, but sent no `/recommendation`, no `/event` and rendered no cards on Home, song, category, Genres or Charts. This differs from §8.5 (banner shown, recommendations already requested). Consequence: the preconditions of TS-REC-09 ("banner visible") and TS-REC-10 (click Decline) cannot be reached through the UI. EXPECTATION UNKNOWN: whether the banner was removed on purpose | RUNTIME-OBSERVED |
| R-9.2 | **New configuration call** `GET /domain/user-identity` after `/search-keyword-config`, not seen on 2026-09-30. The configuration has changed since the snapshot of §8.7 (relevant for TS-REC-15) | RUNTIME-OBSERVED |
| R-9.3 | With `localStorage.recsys_consent_status = "granted"` stored before load (the value Accept all wrote in §8.5): `/recommendation` is sent on Home, song and category pages and cards render (60 `.recsys-item` after Home + song). Browsing and scrolling sent **no** `POST /event`. A click on a song-card Play on `/genres` sent `POST /event` (beacon) and a new `/recommendation` | RUNTIME-OBSERVED (basis of TS-REC-12 and its positive control) |
| R-9.4 | With consent stored as granted, the tracker reported its own error by `sendBeacon` to `/errors` on the **PSMusic UI origin** (relative URL): `{"type":"sdk_error","context":"PluginManager.startAll","message":"Maximum call stack size exceeded", …}` from `ConsentPlugin.start → RecSysTracker.setConsent → startPlugins`. Recommendations and events still worked. Third-party defect; the beacon also goes to a PSMusic path that does not exist | RUNTIME-OBSERVED |
| R-9.5 | **First load of a fresh browser shows no recommendations, also with consent stored.** On 2026-10-13 the first Home load fetched the configuration and stored `localStorage.recsys_anon_id` (and `sessionStorage.recsys_tracker_session`) about 3.4 s after navigation, but sent no `/recommendation` and rendered no card; every later load in the same browser sent `/recommendation` and rendered 50 cards (2 runs × 3 loads). Matches §8.1 "first visits with empty storage were empty". A reload right after the rules arrive, before the identity is stored, stays empty too (TS-REC-12 failed that way once). Tests wait for `recsys_anon_id` before browsing | RUNTIME-OBSERVED |
