# PSMusic - Authorization and Gating (runtime findings)

Observed on 2026-10-08 against the local dev build (UI `https://localhost:5174`, API `https://localhost:7215`), while implementing `tests/authz/*.spec.ts` and `tests/profile/profile.spec.ts`. Probes were sent with curl and through the tests. The service key and token values are omitted.

Source files read (read-only) to confirm each observation: `Middlewares/ApiAuthMiddleware.cs`, `Controllers/AuthController.cs` (`Me`), `Controllers/UserController.cs`, `Controllers/StatsController.cs`, `Controllers/RatingController.cs`, `components/Modal/AuthModal.jsx` (+ `.module.css`), `components/Sidebar/Sidebar.jsx`, `components/PlayerControl/PlayerControl.jsx`, `components/PrivateRoute/PrivateRoute.jsx`, `contexts/PlayerContext.jsx`, `App.jsx`.

## 1. Service key (TS-AUTHZ-01)

| # | Observation | Evidence |
|---|---|---|
| Z-1 | Without `X-App-Service-Key`, or with a wrong value: **401**, `application/json`, body exactly `{"message":"Unauthorized Access"}`. Same on a public endpoint (`GET /api/song/1/detail`, `GET /api/category/popular`) and a protected one (`GET /api/song/favorites`). The middleware runs before routing and authentication | RUNTIME-OBSERVED + source |

## 2. Bearer token (TS-AUTHZ-02)

| # | Observation | Evidence |
|---|---|---|
| Z-2 | With the service key, no token or `Authorization: Bearer invalid-access-token`: **401 with an empty body and no content type** on `GET /api/song/favorites`, `POST /api/song/1/favorite-toggle`, `POST /api/song/stream/1`, `POST /api/rating/1/add-review`, `POST /api/stats/heartbeat`, `GET /api/auth/me`, `GET /api/user/{id}`. The 401 comes before the body is read, so no write happens | RUNTIME-OBSERVED |
| Z-3 | Public optional-user endpoints with an invalid token are served as a guest: `GET /api/song/1/detail` and `/player` answer **200** with `isFavorited:false`, `isReviewed:false` | RUNTIME-OBSERVED |

## 3. Profile (TS-PROF-01, TS-PROF-02)

| # | Observation | Evidence |
|---|---|---|
| Z-4 | `GET /api/auth/me` with the user's token: **200** `{ id, username, email, displayName }` of that user, no avatar and no password field. (`/api/user/profile` named in the README does not exist; endpoint choice still open as A-Q16) | RUNTIME-OBSERVED |
| Z-5 | **Defect, now confirmed at runtime: user A reads user B through `GET /api/user/{B id}` with A's token. 200** with B's `UserDTO { id, username, email, displayName, avatarURL }`. No ownership check (`UserController.GetUserById`). Closes U-2.7. Known defect US-023-AC-03 (SD-8); TS-PROF-02 is an expected failure | RUNTIME-OBSERVED + source |
| Z-6 | `GET /api/user/{id}` without a token: 401 (so the exposure needs any signed-in account, which anyone can create) | RUNTIME-OBSERVED |

## 4. Sign-in prompt ("Start Listening" modal, TS-AUTHZ-03 to 05)

| # | Observation | Evidence |
|---|---|---|
| Z-7 | Guest clicks sidebar **Favorites**: the modal opens, the URL stays `/` | RUNTIME-OBSERVED (TS-AUTHZ-03) |
| Z-8 | The sidebar and each `PlayerControl` copy render their own `AuthModal`, and a closed one returns `null`, so at most one instance is in the DOM. Locator: `[class*="modalContent"]` that contains the heading "Start Listening"; the overlay is its parent; the X button is the card's first `button` | Source + runtime |
| Z-9 | While open, `document.body.style.overflow = 'hidden'` (and `padding-right: 15px`); on close it is reset to `unset` (computed `visible`, the value before opening). Confirmed for "Maybe Later", the X icon and a click on the overlay corner (10,10) | RUNTIME-OBSERVED (TS-AUTHZ-05) |

## 5. Player bar as a guest (TS-AUTHZ-04)

| # | Observation | Evidence |
|---|---|---|
| Z-10 | **Closes U-3.2.** Guest playing song 1: the player-bar heart and Rate button each open the modal; no `favorite-toggle` and no `add-review` request is sent | RUNTIME-OBSERVED |
| Z-11 | "Login Now" from the player's modal navigates to `/auth` and pauses the audio. The `<audio>` element belongs to `PlayerContext`, so it stays in the DOM on `/auth` and `paused` can be read there | RUNTIME-OBSERVED + source |
| Z-12 | Reliability: with 8 browsers in parallel the MP3 from S3 took more than 5 s to start (UI already showed Pause, time `00:00 / 00:00`). The test allows 20 s for the first frames (`AUDIO_START_TIMEOUT_MS`, R-AUD) | RUNTIME-OBSERVED |

## 6. Protected routes (TS-AUTHZ-06)

| # | Observation | Evidence |
|---|---|---|
| Z-13 | Guest opening `/favorites` or `/recent` directly: the refresh check answers `isSuccess:false`, then `PrivateRoute` redirects to `/auth` (login form shown) | RUNTIME-OBSERVED |
| Z-14 | Member: `/favorites` renders the favorites page (a fresh user sees the empty state); `/recent` renders only the text "Nghe Gần Đây" inside `main` (hard-coded Vietnamese, also with English UI) | RUNTIME-OBSERVED |
