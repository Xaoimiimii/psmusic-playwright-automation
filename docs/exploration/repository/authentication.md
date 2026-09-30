# PSMusic - Authentication and Authorization

Sources: `S:Program.cs`, `S:Controllers/AuthController.cs`, `S:Services/Implementations/AuthService.cs`, `S:Services/Implementations/TokenGenerator.cs`, `S:Middlewares/ApiAuthMiddleware.cs`, `C:contexts/AuthContext.jsx`, `C:services/authService.js`, `C:services/axiosInstance.js`, `C:components/PrivateRoute/PrivateRoute.jsx`, `C:components/Auth/*`. Secret values are deliberately omitted.

## 1. Mechanisms overview

| Layer | Mechanism | Confidence |
|---|---|---|
| App-level gate | Static shared secret in request header (default `X-App-Service-Key`) required on all `/api/*` paths; compared with configuration `ApiSecurity:SecretValue` | CONFIRMED |
| User authentication | JWT bearer access token, HS256-style symmetric key (`SymmetricSecurityKey` from `Jwt:Key`), validates issuer, audience, signing key, lifetime | CONFIRMED |
| Session continuity | Refresh token JWT in HttpOnly cookie `RefreshToken`; rotated on each refresh | CONFIRMED |
| Password storage | BCrypt hash (`BCrypt.Net.BCrypt.HashPassword/Verify`) in `User.Password` | CONFIRMED |
| Authorization | Only "authenticated vs anonymous"; **no roles/policies/claims-based rules** | CONFIRMED |

## 2. Access token
- Created by `TokenGenerator.GenerateToken(user)`; lifetime `Jwt:ExpiryMinutes` (60 in `appsettings.json` and docker-compose). Claims: `sub` = user id, `name` = display name, `email`; a role claim is commented out. Issuer `Jwt:Issuer` (`PSMusic`), audience `Jwt:Audience` (`PSMusicUsers`). CONFIRMED (values for issuer/audience are non-secret and appear in config).
- Server reads the user id as `ClaimTypes.NameIdentifier` (`User.FindFirst(ClaimTypes.NameIdentifier)`). The token carries `sub`; correct operation relies on ASP.NET's default inbound claim mapping (`sub` -> NameIdentifier). INFERRED (works only if the mapping is on - verify at runtime; if not, all `[Authorize]` endpoints with claim checks would return 400/401).
- Delivered in the login/refresh **response body** (`token`); the SPA stores it **in memory only** (`useState` + `axiosInstance.defaults.headers.common.Authorization`) - not in `localStorage`/`sessionStorage`/cookies. CONFIRMED.
- Also accepted from a cookie named `AccessToken` via `OnMessageReceived`, but no code sets that cookie. CONFIRMED (dead path).
- `OnTokenValidated` marks the user active in `ActiveUserTracker` (side effect on every authenticated request). CONFIRMED.

## 3. Refresh token
- `TokenGenerator.GenerateRefreshToken`: same issuer/audience, claim `token_type=refresh`, lifetime `Jwt:RefreshExpiryMinutes` (default 10080 = 7 days, not present in the config files read). `ValidateRefreshToken` requires `token_type=refresh`.
- Cookie attributes on login/refresh (`SetRefreshTokenCookie`): `HttpOnly=true; Secure=true; SameSite=None; Path=/; Expires=+7 days`. **`Secure` is unconditional** -> browsers only send it over HTTPS (Chromium treats `http://localhost` as a secure context and accepts Secure cookies on localhost; other hosts on HTTP will not persist it) - INFERRED, runtime validation needed.
- Logout deletes the cookie with `Secure=Request.IsHttps` and `SameSite=None` if HTTPS else `Lax`. If the deletion options differ from the setting options, the browser may keep the cookie (INFERRED risk).
- Rotation: every successful refresh issues a new refresh token; old ones remain valid until expiry (no server store, no reuse detection). CONFIRMED.

## 4. Login flow (UI)
1. `/auth` (`AuthPage`) shows Sign-in panel by default.
2. `SignIn.jsx` validates: both fields non-empty (`error_fill_info`), password length >= 8 (`error_password_length`) - no request otherwise.
3. `AuthContext.login` -> `POST /api/auth/login` (`{username, password}`).
4. On success: `setAccessToken(token)`, `setUser(result.user)`, default Authorization header set; UI shows `login_success` and `navigate('/')` after 1 s.
5. On failure: `authService.login` returns `{isSuccess:false, message}` - message from `response.data.message` for HTTP 400, otherwise generic "Đã xảy ra lỗi không xác định" (e.g. automatic validation ProblemDetails has no `message` for 400? For 400 the code uses `error.response.data?.message || "Tên đăng nhập hoặc mật khẩu không đúng"`).
Confidence: CONFIRMED (code); rendered behavior UNKNOWN.

## 5. Registration flow (UI)
1. Client checks: fields non-empty, password >= 8, then **external email validation** (`emailValidationService.validateEmail`) that must return `isSMTPValid`, `isFormatValid`, `isDeliverable`, and `isGmail` (else specific error messages: `error_smtp` (key may be missing from en file - UNKNOWN), `error_email_format`, `error_email_invalid`, `error_email_gmail`).
2. `POST /api/auth/register` with `{username, password, email, displayName: username, avatarURL: null}`.
3. On success: `register_success` ("Registration successful! You can login now.") and fields cleared; no auto-login, no automatic panel switch in the code. CONFIRMED.
4. Server errors displayed from `message`.
**Email-validation details (CONFIRMED in `C:services/emailValidationService.js`):** `GET https://emailreputation.abstractapi.com/v1/?api_key=<key>&email=<email>` (email not URL-encoded). Flags: `isDeliverable` = `email_deliverability.status === "deliverable"` and detail != `invalid_mailbox`; `isFormatValid` = `email_deliverability.is_format_valid`; `isSMTPValid` = `email_deliverability.is_smtp_valid`; `isGmail` = `email_sender.organization_name === "Gmail"`. The checks run in this order: SMTP -> format -> deliverable -> Gmail. The returned `message` is the Vietnamese text "Email hợp lệ" when deliverable, else "Email không tồn tại hoặc không thể gửi được"; on network/parse failure all flags are false and `message` is `""`.
Quirks: (a) when SMTP is invalid but the status is "deliverable" the UI would show `"Email hợp lệ"` as an **error**; (b) on network failure the UI falls back to `t('error_smtp')`, but **the key `error_smtp` does not exist in any of the 5 locale files** (CONFIRMED by grep), so i18next would show the raw key text (INFERRED default behavior); (c) "isGmail" is decided by the provider's organization name, not by the `@gmail.com` suffix, although the message says "Only @gmail.com is accepted".

**Dependency risk:** sign-up cannot succeed without the external service returning positive flags and a valid key (`VITE_ABSTRACT_API_KEY`). Whether the service is reachable/quota-limited in test environments is UNKNOWN. (See `automation-considerations.md`.)

## 6. Session bootstrap and expiry (client)
- `AuthProvider` effect on mount: `POST /api/auth/refresh` (cookie). If response has `token` **and** `user` -> logged in; else guest. `loading` is `true` until done; `PrivateRoute` shows a spinner while loading, then redirects to `/auth` if no user; `Header` renders neither Login nor avatar while loading.
- axios response interceptor: on `401` for non-`/refresh` requests, single-flight refresh; success -> retry original with new token; failure -> `logout()` (clears user, token, header, cache, navigates `/`). Concurrent 401s are queued (`failedQueue`). CONFIRMED.
- `authService.refresh()` returns `undefined` when HTTP 200 without `res.data`? (guard `res.status === 200 && res.data`); if the server returns 200 with `isSuccess:false`, the interceptor checks `res?.token` so it treats it as failure. CONFIRMED.
- Heartbeat (`POST /api/stats/heartbeat`) every 45 s while signed in and tab visible; also fires immediately and on `visibilitychange`.
- Access token lifetime 60 min -> after expiry the next authenticated call triggers the refresh path; the refresh token lifetime (7 d) bounds session length. UNKNOWN whether long sessions behave (runtime).

## 7. Logout
- UI: user dropdown -> "Logout" -> `AuthContext.logout` -> `POST /api/auth/logout` (server deletes cookie; needs valid bearer else 401 which the client swallows) -> local state cleared, `clearCache()`, `navigate('/')`. Access token remains valid until natural expiry (stateless). CONFIRMED.

## 8. Protected routes (client)
| Route | Guard | Result for guest |
|---|---|---|
| `/favorites`, `/recent` | `PrivateRoute` (`!user || typeof user === 'string'` -> `<Navigate to="/auth" replace/>`) | redirect to `/auth` |
| Sidebar "Favorites" link | click handler shows `AuthModal` and prevents navigation | modal (no navigation) |
| Player: favorite, rate | `if (!user) setIsAuthModalOpen(true)` | modal |
| Stream recording | `if (!user) return` before API call | silently none |
All other routes are public. CONFIRMED.

## 9. Protected endpoints (server)
`[Authorize]`: `GET /api/auth/me`, `GET /api/song/favorites`, `POST /api/song/{id}/favorite-toggle`, `POST /api/song/stream/{songId}`, `POST /api/rating/{id}/add-review`, `POST /api/stats/heartbeat`, `GET /api/user/{id}`. `POST /api/auth/logout` has no attribute but returns 401 without a valid claim. All other endpoints are anonymous (but need the `X-App-Service-Key` header). Optional-user endpoints (`detail`, `player`, `artist/main|collab`, `category/popular`) read the claim when a valid token is supplied. CONFIRMED. Because global authentication is configured (`DefaultAuthenticateScheme`), a valid token on an anonymous endpoint still populates `User`.

## 10. Roles, permissions, access control
- Roles: **none** (`User.Type` commented out; `Role` claim commented out). CONFIRMED.
- Resource ownership: favorites and ratings are bound to the token's user id (client cannot pass another user id: `input.UserId = userId` overwrites). `GET /api/user/{id}` lacks an ownership check. CONFIRMED.
- Rate limiting, account lockout, password reset, email verification, 2FA: **not present**. CONFIRMED (absence in searched code).

## 11. Test accounts / credentials
No seeded users, fixtures or default credentials exist in the repository (no seed code/SQL found). Accounts must be created via registration or inserted directly (DB access needed). UNKNOWN whether the team's environment has pre-provisioned accounts.

## 12. Items needing runtime validation
1. Claim mapping (`sub` -> NameIdentifier) - confirm `favorite-toggle` works with a real token.
2. Cookie `Secure/SameSite=None` behavior on the chosen test URL scheme/host; behavior across origins (UI on `:5173`, API on `:7215`; `SameSite=None; Secure` cookie + CORS credentials).
3. Error rendering for wrong password, unknown user, and short password sent directly to the API.
4. Whether logout in the browser actually removes the refresh cookie (reload afterwards).
5. Token expiry/refresh behavior (needs shortened `ExpiryMinutes` in a test config or manual expiry).
6. Whether `Register` model-validation errors return ProblemDetails (X-6).
