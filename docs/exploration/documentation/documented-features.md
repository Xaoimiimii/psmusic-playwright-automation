# PSMusic - Documented Features

Source of everything below: **D1 `README.md`** (sections `D1-INTRO`, `D1-FEATURES`, `D1-TECH`, `D1-AUTH`), unless noted. See `documentation-overview.md` for the document inventory. No feature has a user story, acceptance criteria, screen description, or navigation description.

## 1. Documented features

| ID | Feature | Purpose (as documented) | Intended user | Documented behavior | Label | Source |
|---|---|---|---|---|---|---|
| DF-01 | Music streaming | "Streaming nhạc chất lượng cao" - high-quality music streaming; the product is a streaming platform | Not stated | Nothing beyond the phrase: no formats, bitrates, controls, queue, lyrics, download, offline, playlists or player behavior described. What "high quality" means is undefined | DOCUMENTED (name only) | D1-INTRO, D1-FEATURES |
| DF-02 | Authentication and user management | "Hệ thống xác thực và quản lý người dùng" - authentication and user management system | Not stated | Only the three endpoints in D1-AUTH are described (register, login, get profile with token). "User management" is not defined (no profile edit, roles, deletion, password reset mentioned) | DOCUMENTED (name only) | D1-FEATURES, D1-AUTH |
| DF-03 | Modern, responsive interface | Friendly, modern UI that adapts to screens | Not stated | No breakpoints, supported devices, themes, or languages described | DOCUMENTED (name only) | D1-INTRO, D1-FEATURES |
| DF-04 | JWT authentication security | Security through JWT | Not stated | Project "uses JWT Authentication" with the endpoints in D1-AUTH; the stack list names "JWT Bearer Authentication" and BCrypt for password hashing; HTTPS listed under tools ("Bảo mật kết nối") | DOCUMENTED | D1-FEATURES, D1-TECH, D1-AUTH |
| DF-05 | Genre classification | "Phân loại nhạc theo thể loại" - music organized by genre | Not stated | Nothing beyond the phrase: no genre list, browsing pages, filters, or search described | DOCUMENTED (name only) | D1-FEATURES |
| DF-06 | API documentation via Swagger | Swagger UI exposes API documentation "khi chạy server" (when the server runs) at `https://localhost:7120/swagger` | Developers | Availability conditions (environment) not stated | DOCUMENTED | D1-API |

## 2. Pages, screens, journeys, navigation
| Item | Documentation status |
|---|---|
| Pages/screens/routes | UNKNOWN - none named |
| User journeys | UNKNOWN - none described (see `documented-user-flows.md`) |
| Navigation structure | UNKNOWN |
| Supported user actions | Register, log in, retrieve own profile with a token (only as endpoint list, D1-AUTH). Everything else UNKNOWN |
| Search | UNKNOWN (never mentioned) |
| Favorites, ratings/reviews, playlists, charts, artists, lyrics, language selection, theme selection | UNKNOWN (never mentioned) |
| Admin or content-management functions | UNKNOWN (never mentioned) |

## 3. Roles
No user roles are documented. "Người dùng" (user) appears generically (D1-FEATURES, D1-AUTH: "Lấy thông tin người dùng (cần token)"). Whether guests may use streaming or genre browsing is UNKNOWN.

## 4. Documented technology (intended implementation choices)
Frontend: React 19.1.1, Vite 7.1.7, Lucide React, CSS Modules. Backend: .NET 8.0, ASP.NET Core Web API (RESTful), EF Core 9.0, PostgreSQL, JWT Bearer, AutoMapper, BCrypt.Net, Swagger. Tools: Docker, ESLint, HTTPS. (D1-TECH). Consistency check against package/project versions is in `documentation-gaps-and-conflicts.md` [EXTERNAL EVIDENCE].

## 5. Feature-level traceability
| Feature | Source | Section |
|---|---|---|
| DF-01..DF-05 | D1 | D1-FEATURES (bullets 1-5 in order) |
| DF-04 | D1 | D1-AUTH, D1-TECH |
| DF-06 | D1 | D1-API |
