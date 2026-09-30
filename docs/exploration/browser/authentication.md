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
