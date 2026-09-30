# PSMusic - Documented API Inventory

Only APIs that appear in **documentation** are listed. Formal specification (OpenAPI/Swagger) is referenced by D1 but is **runtime-generated and not stored in the repository**; it was not available for this task (no server was run). Therefore the "formal" API documentation is **UNKNOWN / not reviewed**, and the only documented API information is the README list below.

## 1. Documented endpoints (D1 §`D1-AUTH`, "Xác thực")

D1 states: "Dự án sử dụng JWT Authentication với các endpoint:" followed by:

| ID | Method | Path (as documented) | Documented purpose | Auth requirement (documented) | Label |
|---|---|---|---|---|---|
| DA-01 | POST | `/api/auth/login` | "Đăng nhập" - log in | Not stated (login is naturally unauthenticated - INFERRED, not documented) | DOCUMENTED |
| DA-02 | POST | `/api/auth/register` | "Đăng ký" - register | Not stated (INFERRED unauthenticated) | DOCUMENTED |
| DA-03 | GET | `/api/user/profile` | "Lấy thông tin người dùng (cần token)" - get user information; **requires a token** | Token required (DOCUMENTED) | DOCUMENTED - SUSPECTED OUTDATED (see gaps G-02) |

For each of DA-01..DA-03 the following are **UNKNOWN (undocumented)**: path/query parameters, request body and fields, response structure and fields, HTTP status codes, validation rules, documented errors and error format, versioning, deprecation status, rate limits, required headers, pagination.

API version: none documented (no `v1` segment or version statement). Deprecation status: not documented for any endpoint.

## 2. Swagger / OpenAPI (D1 §`D1-API`)
| Item | Documentation statement | Label |
|---|---|---|
| Existence | Swagger listed as a technology for "API documentation" (`D1-TECH`) | DOCUMENTED |
| Location | "Khi chạy server, truy cập Swagger UI tại: `https://localhost:7120/swagger`" (when the server is running, open Swagger UI at that address) | DOCUMENTED |
| Content | Not stored; would list the deployed endpoints | UNKNOWN (not reviewed) |
| Availability conditions | Not stated (dev only? all environments?) | UNKNOWN |
| Port `7120` vs configured server ports | see `documentation-gaps-and-conflicts.md` G-01 | CONFLICTING/SUSPECTED OUTDATED [EXTERNAL EVIDENCE] |
| Static export (swagger.json/openapi.yaml) | none in repo or history | UNKNOWN |

## 3. Other artifacts that look like API docs
| Artifact | What it contains | Assessment |
|---|---|---|
| D5 `PSMusic.Server.http` | single request `GET http://localhost:5006/weatherforecast/` with `Accept: application/json` | Template leftover; no such resource is described anywhere in documentation -> **SUSPECTED OUTDATED/irrelevant** |

## 4. What the documentation does not say about the API
- No documented endpoints for: songs, artists, genres/categories, search, streaming/audio delivery, favorites, ratings, statistics, token refresh, logout.
- No documented cross-cutting API requirements (custom headers, CORS, content types, error envelopes, locale of messages).
- Not stated whether Swagger documents authentication (bearer scheme).

## 5. Statement about implementation
Per task rules: the endpoints above are only **documented**. This document does not assert they are implemented or used by the browser. [EXTERNAL EVIDENCE] notes on the actual implementation are recorded only in `documentation-gaps-and-conflicts.md`.

## 6. Traceability
| API | Source | Section |
|---|---|---|
| DA-01, DA-02, DA-03 | D1 `README.md` | `D1-AUTH` |
| Swagger location | D1 | `D1-API` |
| Swagger as technology | D1 | `D1-TECH` (Backend) |
