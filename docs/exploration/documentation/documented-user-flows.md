# PSMusic - Documented User Flows

The available documentation (D1 `README.md`, see `documentation-overview.md`) **does not describe any end-to-end user flow**. This file records what can (and cannot) be supported by documentation. Nothing here was taken from source code or runtime.

## 1. Flows supported by documentation

| Flow | Documented? | Support | Source |
|---|---|---|---|
| Registration | Partial | The endpoint `POST /api/auth/register` ("Đăng ký") is listed. Starting condition, inputs, expected result, alternative paths: UNKNOWN | D1-AUTH |
| Login | Partial | `POST /api/auth/login` ("Đăng nhập") listed; JWT authentication used. Inputs, result, token handling, failure behavior: UNKNOWN | D1-AUTH, D1-FEATURES |
| View own profile | Partial | `GET /api/user/profile` "(cần token)" listed - requires a token. Where in the UI it appears: UNKNOWN | D1-AUTH |
| Listen to music / streaming | Feature name only | "Streaming nhạc chất lượng cao". No actions, controls, or expected results | D1-FEATURES |
| Browse by genre | Feature name only | "Phân loại nhạc theo thể loại". No pages, actions, or results | D1-FEATURES |

Each flow above is `DOCUMENTED (name/endpoint only)`; the following elements are **UNKNOWN for every flow**: starting condition, ordered actions, expected results, alternative paths, error handling, business rules, dependencies.

## 2. Flows explicitly NOT documented
Search; filtering; favorites; rating/review; playlists; charts/trending; artist pages; song detail/lyrics; downloading; logout and session expiry; token refresh; language/theme switching; guest vs signed-in differences; account recovery; any admin flow.

Not applicable to this product (no evidence in documentation that they exist): restaurant browsing, product selection, cart, checkout, payment, order creation/lifecycle, cancellation (the requested examples belong to a different type of application).

## 3. Documented run/operations flow (developer-oriented, D1-SCRIPTS)
| Step | Documented command |
|---|---|
| Frontend dev server | `npm run dev` |
| Production build / preview / lint | `npm run build` / `npm run preview` / `npm run lint` |
| Backend run / build | `dotnet run` / `dotnet build` |
| Apply database schema | `dotnet ef database update` |
| Create migration | `dotnet ef migrations add <name>` |
| Open API docs | browse to Swagger URL after the server starts (D1-API) |
Order of operations, prerequisites (database instance, connection settings, external service keys) and expected outputs: UNKNOWN.

## 4. Traceability
All rows: D1 `README.md`; sections `D1-FEATURES`, `D1-AUTH`, `D1-SCRIPTS`, `D1-API`.
