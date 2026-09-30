# PSMusic - Documented Test Data and Environment Requirements

Documentation reviewed: D1 `README.md` (and D2-D5; see `documentation-overview.md`). No credentials or secrets are recorded here.

## 1. Documented environment / configuration facts
| Topic | Documented statement | Label | Source |
|---|---|---|---|
| Runtime stack | .NET 8.0 backend; React 19.1.1 / Vite 7.1.7 frontend; Node tooling via npm scripts | DOCUMENTED | D1-TECH, D1-SCRIPTS |
| Database | PostgreSQL through Entity Framework Core 9.0 | DOCUMENTED | D1-TECH |
| Schema setup | `dotnet ef database update` applies the database schema; `dotnet ef migrations add <name>` creates a migration | DOCUMENTED | D1-SCRIPTS |
| Containerization | Docker listed as a tool | DOCUMENTED (no instructions) | D1-TECH |
| API docs endpoint | Swagger UI at `https://localhost:7120/swagger` once the server runs | DOCUMENTED (suspected outdated port) | D1-API |
| Local development | Frontend via `npm run dev`; backend via `dotnet run` | DOCUMENTED | D1-SCRIPTS |
| VS integration | Server project references the client project (SPA proxy) and a dockerfile exists; client "proxy endpoint updated to be the backend server endpoint" | DOCUMENTED (scaffolding notes) | D3, D4 |

## 2. Not documented (UNKNOWN)
| Need | Status |
|---|---|
| Test accounts / roles / credentials | UNKNOWN - none mentioned |
| Required entities and datasets (songs, artists, genres, users) | UNKNOWN - no data model or dataset documentation; no statement of how catalog data is loaded |
| Seed data / reusable datasets / snapshots | UNKNOWN |
| Environment variables and configuration keys (DB connection, JWT settings, any API key/header, search service, frontend API base URL) | UNKNOWN - no configuration documentation |
| External services required (e.g. search engine, email validation, media storage, analytics) | UNKNOWN - none mentioned; only PostgreSQL named |
| Supported environments (dev/test/staging/prod), URLs | UNKNOWN |
| Media/file hosting requirements | UNKNOWN |
| Data retention, cleanup, reset procedures | UNKNOWN |
| Browser/OS requirements | UNKNOWN |
| Time-dependent data expectations | UNKNOWN |

## 3. Implication
Automation cannot obtain data or environment requirements from documentation; they must be obtained from the SUT team or discovered (out of this task's scope). See `documentation-gaps-and-conflicts.md` (gaps G-05..G-09) for the clarifications required.
