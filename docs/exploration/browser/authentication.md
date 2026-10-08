# PSMusic - Authentication and Authorization (Browser Runtime Exploration)

Observed on 2026-09-30 against `https://localhost:5174` / `https://localhost:7215`. No security control was bypassed or attacked. Token, cookie and key values are deliberately omitted.

## 1. Mechanisms seen at runtime

| Mechanism | Observation | Evidence |
|---|---|---|
| App-level API key | Header `x-app-service-key` on every SPA API call. Missing or wrong -> 401 `{"message":"Unauthorized Access"}`. The value is **shipped to the browser** (visible in DevTools), so it is not a secret from end users | RUNTIME-OBSERVED |
| Access token | JWT returned in the **response body** of `login` / `refresh` (`token`). Sent as `Authorization: Bearer`. **Not** in localStorage, sessionStorage or JS-readable cookies | RUNTIME-OBSERVED |
| JWT claims | Header `alg: HS256`. Payload includes `sub` (user id, `441` for the test user), `name` (username), `email` | RUNTIME-OBSERVED (decoded prefix only) |
| Refresh token | Cookie `RefreshToken`, domain `localhost`, path `/`, **HttpOnly, Secure, SameSite=None**, expires ~7.00 days after login | RUNTIME-OBSERVED |
| Session restore | `POST /api/auth/refresh` on every full load (twice). With cookie -> token + user -> logged-in UI. Without -> HTTP 200 `isSuccess:false` -> guest UI | RUNTIME-OBSERVED |
| Refresh rotation / reuse | Two concurrent refreshes on the same reload both returned 200 with tokens | RUNTIME-OBSERVED; whether old refresh tokens stay valid: UNKNOWN |
| Heartbeat | `POST /api/stats/heartbeat` (bearer) right after login and periodically | RUNTIME-OBSERVED (interval not measured) |
| Roles | No role-dependent UI seen. Only guest vs. logged-in differences | RUNTIME-OBSERVED (single role explored) |

## 2. Login
- UI: `/auth`, Login panel. Client checks run before any request: empty fields -> "Please fill in all information"; password < 8 -> "Password must be at least 8 characters".
- Server: unknown username -> **400** "Tài khoản không tồn tại". Success -> 200 "Đăng nhập thành công", UI "Login successful", redirect to `/` ~1.3 s later.
- **The server error reveals whether a username exists** ("Tài khoản không tồn tại"). Wrong-password text for an existing user: NOT TESTED. Classification: OBSERVATION - EXPECTATION UNKNOWN (possible account enumeration).
- Rate limiting / lockout: NOT TESTED (deliberately; no brute-force probing).

## 3. Registration
- UI order observed: required fields -> password length -> browser-native `type=email` check -> **external Abstract API email reputation call** -> (only if accepted) `POST /api/auth/register`.
- Synthetic addresses (`@example.com`, a random `@gmail.com`) are rejected by the external check with the Vietnamese message "Email không tồn tại hoặc không thể gửi được". **UI sign-up needs a real, existing mailbox** (the source also implies it must be Gmail; only the non-existent-mailbox branch was observed).
- The API itself accepted `@example.com` emails, so the email restrictions are **UI-only**.
- Duplicate username -> 400 "Tài khoản đã tồn tại"; duplicate email -> 400 "Email đã tồn tại".
- Registration does not log the user in (no token/cookie in the response).

## 4. Logout
- Avatar menu -> Logout -> `POST /api/auth/logout` 200 -> cookie removed -> guest header. A reload stays logged out (refresh fails).
- Whether the already-issued access token keeps working after logout: NOT TESTED (it cannot be extracted without handling the token value).
- The third-party `recsys_cached_user_info` (localStorage) **is not cleared** on logout.

## 5. Protected pages and actions

| Target | Guest behavior | Logged-in behavior | Evidence |
|---|---|---|---|
| `/favorites` (URL) | Redirect to `/auth` (after the refresh check completes) | Favorite Playlist page | RUNTIME-OBSERVED |
| `/recent` (URL) | Redirect to `/auth` | Stub page "Nghe Gần Đây" | RUNTIME-OBSERVED |
| Sidebar "Favorites" | Opens "Start Listening" modal, no navigation | Navigates (INFERRED; logged-in click NOT TESTED, menu link used instead) | RUNTIME-OBSERVED (guest) |
| Player heart / rate | Modal expected per source; **NOT TESTED as guest** | Works | RUNTIME-OBSERVED (logged in) |
| Stream recording | No `stream` call during ~15 s of guest playback (the 20 s mark was not reached) | One call at ~20 s | Partially observed |
| `GET /api/song/favorites`, `GET /api/auth/me` | 401 without bearer | 200 | RUNTIME-OBSERVED |
| Anonymous endpoint with an invalid bearer | 200 (served as guest) | - | RUNTIME-OBSERVED |

## 6. Session timing issue observed
On a **hard reload** of `/song/:id` while logged in, `GET /api/song/{id}/detail` is sent **before** `auth/refresh` completes and without `Authorization`, so `isFavorited`/`isReviewed` come back `false`. The later `/player` call (after refresh) returns `true/true`. After in-app navigation the detail call carries the token and is correct. RUNTIME-OBSERVED; see `business-rules.md` F-5.

## 7. Privacy-relevant observations (OBSERVATION - EXPECTATION UNKNOWN)
- After login, the third-party tracker stores `{ userField: "UserId", userValue: <username>, timestamp }` in `localStorage.recsys_cached_user_info`, so the username is shared with `recsys-tracker-module-d8ty.onrender.com` (sending INFERRED from the tracker's purpose; the exact payload was not inspected).
- Recsys `POST /recommendation` continued after clicking **Decline** on the privacy banner.

## 8. Not tested / unknown
Token expiry and silent refresh after 60 min; refresh-token lifetime enforcement; multiple tabs; behavior over plain HTTP; account lockout; password reset (no UI observed); role/permission differences (only one role exists in the UI).

## 9. Findings from the AUTH automation run (2026-10-05)

Observed while implementing and running `tests/auth/*.spec.ts` against `https://localhost:5174` / `https://localhost:7215` (dev build). Values of tokens and keys are omitted.

| # | Observation | Evidence |
|---|---|---|
| A-1 | Wrong password for an existing user: **400** `{"isSuccess":false,"message":"Sai mật khẩu"}`, no `Set-Cookie`, message shown inline in the login form (closes the NOT TESTED item in §2) | RUNTIME-OBSERVED (TS-AUTH-03) |
| A-2 | Refresh cookie stored by Chromium after UI login: `HttpOnly`, `Secure`, `SameSite=None`, `Path=/`, expiry 7 days | RUNTIME-OBSERVED (TS-AUTH-01) |
| A-3 | **Sign-in without the UI works:** `POST /api/auth/login` sent through `browserContext.request` stores the `RefreshToken` cookie in the browser context; the next page load restores the session through `auth/refresh`. This is the auth helper the automation analysis (§9) asked to validate | RUNTIME-OBSERVED |
| A-4 | Logout: **200** `{"isSuccess":true,"message":"Đăng xuất thành công"}`, cookie removed, reload stays guest | RUNTIME-OBSERVED (TS-AUTH-11) |
| A-5 | Logout from a public page (`/song/1`) lands on `/` with the Login button (the public-page case of US-004-AC-01, not observed before) | RUNTIME-OBSERVED (TS-AUTH-10) |
| A-6 | Logout from `/favorites` lands on **`/auth`** (known defect US-004-AC-01, reconfirmed) | RUNTIME-OBSERVED |
| A-7 | **New: a failed refresh on a protected page lands on `/auth`, not `/`** (US-003-AC-05). With the first `GET /api/song/favorites` answered 401 and an invalid `RefreshToken` cookie, the interceptor's refresh returns `isSuccess:false`, `logout()` runs (cookie removed, user menu gone), and the app ends on `/auth`. Source: `logout()` clears `user` while `/favorites` is mounted, so `PrivateRoute` renders `<Navigate to="/auth">`; same mechanism as A-6 | RUNTIME-OBSERVED (controlled 401) + source |
| A-8 | 401 → refresh → retry works on the client: after a controlled 401 on `GET /api/song/favorites`, exactly one `auth/refresh` is issued and the call is retried with 200. The dev build sends the favorites call twice (StrictMode), so the page can render from the duplicate before the retry completes | RUNTIME-OBSERVED (TS-AUTH-07) |
| A-9 | **New: refresh tokens are not unique within one second.** The refresh JWT has no `jti`/nonce (claims `sub`, `name`, `email`, `token_type`, `nbf`, `exp`, `iat`; `TokenGenerator.GenerateRefreshToken`). A refresh in the same second as the login (or previous refresh) returns a **byte-identical** `RefreshToken`; one 1.1 s later returns a different value. This conflicts with the rule "each refresh issues a new refresh token" (TS-AUTH-09). The two concurrent refreshes on every page load (F-4) therefore usually receive the same token | RUNTIME-OBSERVED (API probe + TS-AUTH-09) + source |
| A-10 | A previous refresh token is still accepted after rotation (`isSuccess:true`). Matches the source ("no server store, no reuse detection"); expected behavior is the open decision U-2.4 | RUNTIME-OBSERVED (API probe, observation only) |

**Decision on A-9 (2026-10-05): accepted, not a defect.** Identical tokens within one second are equally valid and expire together, so nothing breaks; rotation has no security effect anyway while earlier tokens stay valid (A-10, open as U-2.4). TS-AUTH-09 was reworded to "each refresh re-issues the refresh token with a renewed 7-day lifetime". The user story rule (US-003 "each refresh issues a new refresh token") still has the original wording. A-7 should be confirmed as a defect against US-003-AC-05 (it shares the A-6 root cause).

## 10. Deployed environment: logout does not remove the refresh cookie (2026-10-08)

Observed while setting up CI against the deployed pair UI `https://psmusic.netlify.app` / API `https://psmusic-5zfx.onrender.com` (production build). Cookie values omitted.

| # | Observation | Evidence |
|---|---|---|
| A-11 | **Logout does not sign the browser out on the deployed environment.** `POST /api/auth/logout` answers 200, but its deletion header is `RefreshToken=; expires=Thu, 01 Jan 1970; path=/; samesite=lax; httponly`, **without `Secure` and with `SameSite=Lax`**. Login set the cookie with `Secure; SameSite=None`. The UI and API are on different sites, so Chromium ignores the deletion (a `SameSite=Lax` cookie in a cross-site response is blocked, and a non-`Secure` cookie cannot replace a `Secure` one). The `RefreshToken` cookie stays, and the next page load restores the session. Locally (`https://localhost:7215`) the same call sends `Secure; SameSite=None` and the cookie is removed (A-4). TS-AUTH-10 (`/favorites`), TS-AUTH-11 and TS-AUTH-08 (the client logout after a failed refresh calls the same endpoint) fail on the deployed environment at "cookie removed" | RUNTIME-OBSERVED (API probe of login/logout `Set-Cookie` attributes; TS-AUTH-08/10/11 runs) |

**Likely cause (source, not confirmed with the SUT team):** `AuthController.RemoveRefreshTokenCookie()` sets `Secure = Request.IsHttps` and `SameSite = Request.IsHttps ? None : Lax`, while `SetRefreshTokenCookie()` always uses `Secure = true, SameSite = None`. The deployed API listens on plain HTTP behind the host's TLS proxy (`Dockerfile`: `ASPNETCORE_URLS=http://+:${PORT:-8080}`) and `Program.cs` has no forwarded-headers handling, so `Request.IsHttps` is false there.

**Status:** application defect against US-004 (logout clears the session), environment-specific. Reported here for the SUT team; not worked around in the tests. TS-AUTH-10 (`/favorites`), TS-AUTH-11 and TS-AUTH-08 stay red on the deployed environment until it is fixed. They are not marked `knownDefect()`, because they pass locally.
