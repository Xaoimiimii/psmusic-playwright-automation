# PSMusic - Documented Authentication and Authorization

Documentation available: D1 `README.md` only (`D1-FEATURES`, `D1-TECH`, `D1-AUTH`). No dedicated authentication document exists.

| Topic | Documented statement | Label | Source |
|---|---|---|---|
| Overall mechanism | "Dự án sử dụng JWT Authentication" - the project uses JWT authentication | DOCUMENTED | D1-AUTH |
| Framework | "JWT Bearer Authentication - Xác thực bảo mật" listed under Backend | DOCUMENTED | D1-TECH |
| Login | Endpoint `POST /api/auth/login` ("Đăng nhập") | DOCUMENTED (endpoint only) | D1-AUTH |
| Registration | Endpoint `POST /api/auth/register` ("Đăng ký") | DOCUMENTED (endpoint only) | D1-AUTH |
| Token-protected resource | `GET /api/user/profile` ("Lấy thông tin người dùng (cần token)") requires a token | DOCUMENTED (suspected outdated path, see gaps G-02) | D1-AUTH |
| Password storage | "BCrypt.Net - Mã hóa mật khẩu" (password hashing library) | DOCUMENTED (library only; parameters unknown) | D1-TECH |
| Transport security | "HTTPS - Bảo mật kết nối" (secure connection) listed under tools | DOCUMENTED (intent; enforcement unknown) | D1-TECH |
| Security as a selling point | "Bảo mật với JWT Authentication" | DOCUMENTED | D1-FEATURES |
| User management | "Hệ thống xác thực và quản lý người dùng" (authentication and user management system) | DOCUMENTED (undefined scope) | D1-FEATURES |

## Not documented (all UNKNOWN)
- Token type details: lifetime, refresh mechanism, claims, signing algorithm, where the client stores it, how it is transmitted (header format).
- Session behavior: expiration, idle timeout, persistence across browser reload, concurrent sessions.
- Logout behavior and endpoint.
- Roles and permissions; protected pages and resources beyond the profile endpoint; guest capabilities.
- Registration rules: required fields, password policy, username/email uniqueness, email verification.
- Login failure behavior, error messages, lockout, rate limiting, password reset.
- Any additional request header or API key requirement for calling the API.
- Cookie usage, CORS/allowed origins.
- Test accounts or default credentials.

## Consistency notes (external evidence, kept out of the "documented" table)
See `documentation-gaps-and-conflicts.md` for: profile endpoint mismatch (G-02) and undocumented additional API header (G-03).
