# PSMusic - Documentation Gaps, Conflicts and Traceability

Documents: D1-D5 (see `documentation-overview.md`). Where a statement is compared with the actual repository configuration/code, it is marked **[EXTERNAL EVIDENCE]** and is *not* a documented requirement. No conflict below has been resolved by assumption.

## 1. Conflicts and suspected-outdated statements

### G-01 Swagger URL port
- **Source A:** D1 `D1-API`: Swagger UI at `https://localhost:7120/swagger`.
- **Source B [EXTERNAL EVIDENCE]:** `PSMusic.Server/Properties/launchSettings.json` profiles use `https://localhost:7215;http://localhost:5006` (also IIS Express `38519`/SSL `44354`); `docker-compose.yml` publishes the server on host port `7215`. Port `7120` appears in no configuration file read.
- **Conflict:** documented address does not match any configured address.
- **Label:** CONFLICTING / SUSPECTED OUTDATED.
- **Impact:** anyone (or any automation) following the README reaches nothing; the formal API description cannot be located from documentation.
- **Clarification required:** authoritative Swagger/API base URL per environment (local, Docker, deployed).

### G-02 Profile endpoint
- **Source A:** D1 `D1-AUTH`: `GET /api/user/profile` returns user information and needs a token.
- **Source B [EXTERNAL EVIDENCE]:** the server exposes `GET /api/user/{id:int}` and `GET /api/auth/me`; no route named `profile` was found in the controllers.
- **Label:** SUSPECTED OUTDATED.
- **Impact:** documented endpoint may not exist; the current-user endpoint is undocumented.
- **Clarification required:** which endpoint is intended as "profile" and its response contract.

### G-03 Undocumented required API header
- **Source A:** D1 `D1-AUTH`/`D1-API` list endpoints with no mention of extra headers.
- **Source B [EXTERNAL EVIDENCE]:** server middleware rejects any `/api/*` request lacking a shared-secret header (`X-App-Service-Key`) with 401.
- **Label:** UNDOCUMENTED BEHAVIOR affecting documented endpoints.
- **Impact:** endpoints in D1 cannot be called as documented; every API test setup depends on obtaining this value.
- **Clarification required:** is the header an intended public contract; how testers obtain the value per environment.

### G-04 Swagger availability
- **Source A:** D1 `D1-API`: Swagger available "when the server runs".
- **Source B [EXTERNAL EVIDENCE]:** Swagger is registered but enabled only when the environment is `Development`; no XML comments/annotations exist, so generated docs would list routes without descriptions or documented status codes.
- **Label:** AMBIGUOUS (documented statement lacks environment condition).
- **Impact:** formal API documentation may be unavailable in non-development environments and thin where available.
- **Clarification required:** environments where Swagger is intended to be available; whether endpoint descriptions are planned.

### G-05 Documented "quản lý người dùng" (user management) vs. defined scope
- **Source:** D1 `D1-FEATURES` claims a user management system; D1-AUTH shows only register/login/profile.
- **Label:** AMBIGUOUS TERMINOLOGY (no definition). **[EXTERNAL EVIDENCE]** the server contains no profile editing/deletion endpoints.
- **Impact:** cannot derive expected user-management behavior.
- **Clarification required:** intended scope (registration only? profile edit? roles?).

### G-06 Scaffolding files named CHANGELOG
- **Sources:** D3, D4 titled `CHANGELOG.md` but contain project-creation notes.
- **Label:** MISLEADING NAMING / not release notes.
- **Impact:** no change history or release notes are available to identify feature evolution or versions; version of the product is undocumented.
- **Clarification required:** location of real release notes, if any.

### G-07 Leftover template request file
- **Source:** D5 `.http` contains `GET /weatherforecast/` at `http://localhost:5006`; no documentation mentions such a resource.
- **Label:** SUSPECTED OUTDATED (template residue).
- **Impact:** could be mistaken for an API sample.

### G-08 Client README is a template
- **Source:** D2 is the stock Vite template README (mentions React Compiler, ESLint expansion) with nothing about PSMusic.
- **Label:** NOT APPLICABLE as product documentation.

### G-09 README feature list vs. features that exist [EXTERNAL EVIDENCE]
- D1 lists five capabilities only. The repository (see the source-based docs in `../repository/`, labelled external evidence) contains additional user-facing capabilities not mentioned in D1 (e.g. search, favorites, song ratings, artist/genre/charts pages, multi-language UI, themes, lyrics, listening statistics).
- **Label:** UNDOCUMENTED BEHAVIOR (large portion of the product).
- **Impact:** expected behavior for these areas has no documentary basis; tests derived for them would be based on implementation/observation only and must be flagged as such.
- **Clarification required:** product owner confirmation of intended behavior for each area.

### G-10 Version statements vs. project files [EXTERNAL EVIDENCE - consistency check only]
- D1 states React 19.1.1, Vite 7.1.7, .NET 8.0, EF Core 9.0. Project files: `package.json` React `^19.1.1`, Vite `^7.1.7`; `net8.0`; EF Core `9.0.10`. **Consistent.** D1 also omits libraries actually used (router, axios, i18n, Elasticsearch client, Npgsql, Swashbuckle beyond "Swagger").
- **Label:** CONSISTENT (no conflict); omission noted as a gap.

## 2. Gaps (missing documentation)

| ID | Gap | Impact on automation |
|---|---|---|
| G-11 | No requirements, user stories, or acceptance criteria | No documented oracle for any expected result |
| G-12 | No user roles / personas / guest-vs-user rules | Access-control tests cannot be grounded |
| G-13 | No API specification: parameters, bodies, responses, status codes, errors | API assertions cannot cite documentation |
| G-14 | Auth details missing: token lifetime, refresh, logout, session expiry, header format, password policy | Session/security expectations undefined |
| G-15 | No UI/page/navigation/user-journey descriptions | UI flows cannot be verified against documentation |
| G-16 | "High-quality streaming" undefined (formats, bitrates) | Not testable as documented |
| G-17 | "Responsive" undefined (devices/breakpoints); no supported-browser list | Cross-browser/viewport scope undefined |
| G-18 | No data model / dataset / seed / test-account documentation | Test data source unknown |
| G-19 | No environment/configuration documentation (variables, external services, ports, secrets handling) | Setup impossible from docs |
| G-20 | No integration documentation (search engine, email validation, media hosting, analytics/tracking) | Unknown dependencies |
| G-21 | No non-functional requirements (performance, availability, rate limits, security beyond JWT/HTTPS, data retention) | No thresholds to verify |
| G-22 | No error-handling / message / localization documentation | Message assertions ungrounded |
| G-23 | Unclear ownership: no maintainers, no contact, no contribution or review process documented | Nobody documented as source of clarification |
| G-24 | No known-limitations or release notes | Cannot separate defects from accepted limitations |

## 3. Ambiguous terminology
| Term (D1) | Ambiguity |
|---|---|
| "Streaming nhạc chất lượng cao" | quality undefined |
| "Quản lý người dùng" | scope undefined |
| "Responsive" | undefined |
| "Phân loại nhạc theo thể loại" | genre list/assignment undefined |
| "Mã hóa mật khẩu" (encrypt) for BCrypt | hashing vs encryption wording (BCrypt is a hash) |
| "Bảo mật kết nối" for HTTPS | required vs optional undefined |

## 4. Clarification questions for the SUT team (consolidated)
1. Authoritative environments and URLs; where is Swagger/OpenAPI available (G-01, G-04)?
2. Is `/api/user/profile` still intended (G-02)? What is the current-user endpoint contract?
3. Is the `X-App-Service-Key` header part of the public API contract, and how do testers get it (G-03)?
4. Is there a product backlog/requirements source outside the repository (G-11..G-15)?
5. What are the intended roles and guest capabilities (G-12)?
6. Test accounts, datasets, and how the music catalog is loaded (G-18, G-19)?
7. External services required (search engine, email validation, media hosting) (G-20)?
8. Supported browsers/devices and non-functional targets (G-17, G-21)?
9. Who owns the documentation and product decisions (G-23)?

## 5. Traceability table (documented findings -> sources)
| Finding | Doc | Section |
|---|---|---|
| Product purpose | D1 | D1-INTRO |
| Five main capabilities | D1 | D1-FEATURES |
| Technology stack and versions | D1 | D1-TECH |
| Dev scripts | D1 | D1-SCRIPTS |
| Auth endpoints (login, register, profile) | D1 | D1-AUTH |
| Swagger location | D1 | D1-API |
| Project scaffolding notes | D3, D4 | whole files |
| Template `.http` request | D5 | whole file |
| Stock Vite README | D2 | whole file |
No requirement IDs, user-story IDs, acceptance-criteria IDs, or OpenAPI operationIds exist to cite.
