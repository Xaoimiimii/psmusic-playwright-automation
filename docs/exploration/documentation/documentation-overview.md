# PSMusic - Documentation Overview (Documented / Intended Behavior Only)

Scope of this document set: what the **available project documentation** says. Runtime observations and source-code findings are excluded, except where explicitly labelled **[EXTERNAL EVIDENCE]** (used only to test whether a documented statement is consistent, never to create requirements).

Labels: **DOCUMENTED**, **INFERRED** (reasonable reading of a documented statement, flagged), **UNKNOWN** (documentation is silent), **CONFLICTING**, **OUTDATED/SUSPECTED OUTDATED**.

## 1. Documentation inventory (exhaustive for the SUT repository `D:\Study\PSMusic`)

Searched: all tracked files and all git history (`git log --all --name-only`) for `.md/.txt/.yml/.http/.pdf/.docx`, `docs/` folders, Swagger/OpenAPI files, XML documentation, requirement/user-story/acceptance-criteria files. Result: only the items below exist.

| Doc ID | Path (relative to SUT repo root) | What it is | Status |
|---|---|---|---|
| **D1** | `README.md` (added 2025-11-05, updated 2025-11-07; 2 commits total) | Project README in Vietnamese: description, main features, tech stack, npm/dotnet scripts, auth endpoints, Swagger URL | The **only** product-level document |
| **D2** | `PSMusic/psmusic.client/README.md` | Unmodified Vite "React + Vite" template README | Not about PSMusic behavior |
| **D3** | `PSMusic/psmusic.client/CHANGELOG.md` | Visual Studio scaffolding notes ("how Visual Studio created the project") | Not a release changelog |
| **D4** | `PSMusic/PSMusic.Server/CHANGELOG.md` | Visual Studio scaffolding notes for the server project | Not a release changelog |
| **D5** | `PSMusic/PSMusic.Server/PSMusic.Server.http` | Visual Studio HTTP request file; contains one template request `GET {host}/weatherforecast/` with host `http://localhost:5006` | Leftover template |
| **D6** | Swagger UI / OpenAPI (referenced by D1: "Khi chạy server, truy cập Swagger UI tại `https://localhost:7120/swagger`") | Runtime-generated API description | **No static spec file in the repo**; cannot be read without a running server. Not inspected (out of scope: no runtime) |

Not present anywhere in repo or history: requirements, user stories, acceptance criteria, product/business specifications, architecture docs, ERD/database docs, authentication docs, configuration docs (env variables), integration docs, technical design docs, test plans, release notes, contributing guide, license, API spec files, seed/test-data docs.

Configuration files (`docker-compose.yml`, `appsettings*.json`, `.env`, `launchSettings.json`) exist but are **configuration, not documentation**; they are used below only as [EXTERNAL EVIDENCE].

Also excluded as sources: the earlier files in this automation repo (`docs/requirements/user-stories.md`, `docs/exploration/repository/*`) are **derived from source code, not SUT documentation**, and are not used as documentation evidence here. The automation repo's own `CLAUDE.md` describes the automation project, not the SUT.

## 2. Application overview (from D1)

| Topic | Documented statement (paraphrased; original Vietnamese in parentheses) | Label | Source |
|---|---|---|---|
| Purpose | PSMusic is a modern **music streaming platform** built with React.js and ASP.NET Core, offering a great listening experience with a friendly interface and diverse features ("nền tảng streaming nhạc hiện đại ... giao diện thân thiện và các tính năng đa dạng") | DOCUMENTED | D1 intro |
| Major capabilities | (1) high-quality music streaming ("Streaming nhạc chất lượng cao"); (2) authentication and user management ("Hệ thống xác thực và quản lý người dùng"); (3) modern, responsive UI ("Giao diện hiện đại, responsive"); (4) security with JWT authentication ("Bảo mật với JWT Authentication"); (5) music classification by genre ("Phân loại nhạc theo thể loại") | DOCUMENTED | D1 "Tính năng chính" |
| Major components | Frontend (React 19.1.1, Vite 7.1.7, Lucide React icons, CSS Modules) and Backend (.NET 8.0, ASP.NET Core Web API described as RESTful, Entity Framework Core 9.0, PostgreSQL, JWT Bearer authentication, AutoMapper, BCrypt.Net for password hashing, Swagger for API documentation) | DOCUMENTED | D1 "Công nghệ sử dụng" |
| DevOps/tools | Docker ("Containerization"), ESLint, HTTPS ("Bảo mật kết nối") | DOCUMENTED | D1 "DevOps & Tools" |
| Build/run | Frontend: `npm run dev`, `build`, `preview`, `lint`. Backend: `dotnet run`, `dotnet build`, `dotnet ef database update`, `dotnet ef migrations add <name>` | DOCUMENTED | D1 "Scripts có sẵn" |
| Target users | Not stated | UNKNOWN | - |
| Supported platforms / browsers / devices | Not stated. "responsive" implies adaptable layouts but no devices/breakpoints/browsers named | UNKNOWN (responsive: DOCUMENTED, unspecified) | D1 |
| Important integrations | None described. PostgreSQL is named as the DBMS; no other external services are mentioned | UNKNOWN beyond PostgreSQL | D1 |
| Business domains | Music streaming; authentication/user accounts; genre-based classification | DOCUMENTED (thin) | D1 |
| Roles | Not stated | UNKNOWN | - |
| Hosting/deploy topology | Docker is listed as a tool; no topology, ports, environment variables or run instructions | UNKNOWN | D1 |
| Setup prerequisites (DB creation, seed data, external service keys) | Only `dotnet ef database update` (applies schema migrations) is listed | UNKNOWN (rest) | D1 |

## 3. Scaffolding documents (D3, D4) - what they do and do not say
- D3: client generated via `npm init --yes vite@latest psmusic.client -- --template=react` (create-vite); `.esproj` created; debugging `launch.json`; proxy endpoint updated "to be the backend server endpoint"; added to the solution and startup projects. DOCUMENTED (project scaffolding only).
- D4: server is an ASP.NET Core Web API project; project file references the frontend and sets SPA properties; `launchSettings.json` registers the SPA proxy as a startup assembly; a `dockerfile` was added. DOCUMENTED (scaffolding only).
- Neither lists features, versions, or behavior changes; they are **not release changelogs** despite the file names.

## 4. Document index by requested output
| Output file | Content |
|---|---|
| `documented-features.md` | Documented features, roles, navigation |
| `documented-api-inventory.md` | Documented endpoints (3) and Swagger |
| `documented-user-flows.md` | Documented flows |
| `documented-authentication.md` | Documented auth |
| `documented-test-data.md` | Documented data/environment needs |
| `documented-business-rules.md` | Documented rules |
| `documentation-gaps-and-conflicts.md` | Conflicts, gaps, traceability, clarifications |
| `automation-considerations.md` | Part 1 = documentation-based considerations (this task); Part 2 = prior source-based content, retained and labelled |

## 5. Traceability convention
Findings cite `D<n>` plus section heading of that document (e.g. `D1 §Xác thực`). D1 section IDs used: `D1-INTRO`, `D1-FEATURES` ("Tính năng chính"), `D1-TECH` ("Công nghệ sử dụng"), `D1-SCRIPTS` ("Scripts có sẵn"), `D1-AUTH` ("Xác thực"), `D1-API` ("API Documentation"). No requirement IDs, user story IDs, acceptance criteria IDs or OpenAPI operation IDs exist.
