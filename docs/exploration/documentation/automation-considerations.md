# PSMusic - Automation Considerations

Evidence base: documented/intended behavior only (D1-D5, see `documentation-overview.md`). The source-code-based counterpart is `../repository/automation-considerations.md`; the two are kept separate on purpose.


# Documentation-Based Automation Considerations

No final test cases are proposed. Labels: DOCUMENTED / UNKNOWN / etc. as elsewhere.

## 1.1 What the documentation lets us verify
| Area | Documented basis | Suitable level | Note |
|---|---|---|---|
| Register / login endpoints exist and are JWT-based | D1-AUTH (`POST /api/auth/register`, `POST /api/auth/login`) | API | Only existence + purpose are documented; request/response contracts, status codes and validation are UNKNOWN, so assertions would rely on non-documentary evidence |
| Token-protected profile retrieval | D1-AUTH (`GET /api/user/profile`, needs token) | API | Path is SUSPECTED OUTDATED (G-02): validate the path before automating; expected failure without token is not documented |
| Passwords not stored/returned in plain text | D1-TECH (BCrypt) | API (response inspection) / DB if accessible | Intent only |
| Genre classification exists | D1-FEATURES | UI/API | Cannot define expected genres or behavior |
| Streaming exists | D1-FEATURES | UI | "High quality" not measurable; only presence of playback capability |
| Responsive UI | D1-FEATURES | UI (viewport) | Breakpoints/devices undefined - can only be a smoke-level check |
| Swagger available | D1-API | API/doc | Documented URL is likely wrong (G-01) |

## 1.2 Features requiring UI validation (per documentation)
Streaming/playback, genre browsing, sign-in/sign-up screens, responsive layout. For all of them the documentation provides **no screens, elements, messages or expected results**; UI expectations must come from another source (product owner, browser exploration) and be labelled accordingly.

## 1.3 Features suitable for API validation (per documentation)
Register, login, token-protected profile. Missing contract details are listed in `documented-api-inventory.md` section 1.

## 1.4 Important end-to-end flows
Documentation supports only a **skeleton**: register -> login -> use the token to access a protected resource. Streaming and genre browsing are named but have no flow. See `documented-user-flows.md`.

## 1.5 Business rules requiring verification
Only DBR-01..DBR-05 (`documented-business-rules.md`) - all thin. No rule has quantitative or behavioral detail.

## 1.6 Data and environment dependencies
Documented: PostgreSQL, .NET 8, Node/npm, `dotnet ef database update`. Everything else needed to run and test (catalog data, accounts, configuration keys, external services, environment URLs) is undocumented - see `documented-test-data.md`.

## 1.7 Areas with insufficient documentation (highest risk for test design)
Requirements/acceptance criteria (G-11), roles (G-12), API contracts (G-13), session behavior (G-14), UI (G-15), streaming quality (G-16), browsers/devices (G-17), data & environment (G-18/G-19), integrations (G-20), non-functional targets (G-21), messages/localization (G-22), known limitations (G-24).

## 1.8 Consequences for the automation project
1. Any automated assertion will have **no documentary oracle** for most behavior. Each future test case should record its oracle type: *documented*, *product-owner confirmed*, or *observed behavior (unverified)*.
2. The documented API paths must be validated against the running system before use (G-01, G-02, G-03).
3. Clarifications listed in `documentation-gaps-and-conflicts.md` section 4 should be requested before designing regression-level tests; until then results derived from source code/observation should be treated as characterization of current behavior, not verification of requirements.
4. The formal API description (Swagger) must be obtained from a running instance to complete the API inventory; it is not in the repository.

---
