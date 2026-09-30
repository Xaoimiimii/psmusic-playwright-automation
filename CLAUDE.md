# PSMusic Automation Testing Project

## Project Purpose

Build and maintain a maintainable **UI + API + E2E** automation testing project for the SUT application (PSMusic).

## Target Stack

| Concern                   | Choice                              |
| ------------------------- | ----------------------------------- |
| Language                  | TypeScript                          |
| Automation framework      | Playwright                          |
| Test runner               | Playwright Test                     |
| UI automation             | Playwright                          |
| API automation            | Playwright `APIRequestContext`      |
| API exploration           | Postman                             |
| AI-assisted exploration   | Playwright MCP                      |
| Package manager           | npm                                 |
| Version control           | Git / GitHub                        |
| CI/CD                     | GitHub Actions                      |
| Reporting                 | Allure Report                       |

Do not introduce other browser-automation frameworks (Selenium, Cypress, Puppeteer),
test runners (Jest, Mocha), or package managers (yarn, pnpm) without an explicit request.

---

## 1. Repository Boundary

1. **The automation code belongs to this repository.** Everything under this repo
   (tests, page objects, API clients, fixtures, config, docs, CI workflows) is this
   project's responsibility.
2. **The SUT application source code is a separate project and must be treated as
   the system under test.** It is inspected, never edited from here. If the source
   is available locally (e.g. as an additional working directory) or only reachable
   as a running instance, treat it as a read-only source of truth, not a codebase
   this repo owns or refactors.

## 2. Investigate Before You Automate

3. **Before implementing automation for a feature, inspect the actual application
   source and/or API implementation.** Read the relevant frontend component/page,
   the backend controller/route, or interact with a running instance (Playwright
   MCP, browser DevTools, Postman, curl) before writing a page object, locator, or
   API client for it.
4. **Never invent pages, elements, locators, API endpoints, request payloads,
   response fields, or business rules when the actual application can be
   inspected.** A value that was not observed in the real application is a guess,
   not automation. If inspection is genuinely blocked (app not runnable, source
   not accessible), say so explicitly and stop rather than fabricate a
   plausible-looking value.
5. **Prefer information discovered from the application over generic
   assumptions.** Framework conventions and common patterns are a starting
   hypothesis to verify, never a substitute for verification. When a discovered
   fact conflicts with a general assumption, the discovered fact wins.
6. **Before changing an existing automation component** (page object, API client,
   fixture, helper, config), **inspect its current implementation and usages
   first.** Know what already calls it and why before modifying its behavior or
   contract, to avoid silently breaking other tests.

## 3. Design and Code Quality

7. **Use Page Object Model where appropriate.** Each UI screen or reusable
   component gets its own page object; spec files orchestrate page objects rather
   than driving the DOM directly.
8. **Prefer stable locators.** Favor role-based and label-based locators
   (`getByRole`, `getByLabel`, `getByTestId`) and dedicated test attributes over
   brittle CSS/XPath tied to layout or auto-generated values. The actual stable
   attribute is whatever the real application exposes (see rule 4).
9. **Prefer explicit waits.** Rely on Playwright auto-waiting and web-first
   assertions (`expect(locator).toBeVisible()`, `expect.poll`, `waitForResponse`,
   `waitForURL`) rather than fixed delays.
10. **Avoid `Thread.sleep()` and its equivalents (`page.waitForTimeout()`,
    `setTimeout`-based sleeps) unless there is a documented technical reason.** If
    one is truly unavoidable, justify it with an inline comment explaining why no
    wait condition could express it. This should be exceptionally rare.
11. **Keep tests readable and focused on business behavior.** A test should read as
    a scenario a non-engineer could follow ("user searches for a song and adds it
    to a playlist"), not a sequence of low-level driver calls.
12. **Do not put excessive implementation logic directly inside test bodies.**
    Element interaction, waiting, and multi-step mechanics belong in page objects,
    API clients, and fixtures; tests call intent-revealing methods and assert.
13. **Keep test data separate from test logic where practical.** Use factories,
    builders, or external fixtures rather than data hardcoded throughout test
    bodies.
14. **Keep configuration and environment-specific values outside test code.** Base
    URLs, credentials, timeouts, and browser choice come from configuration files
    and environment variables (e.g. `playwright.config.ts`, `.env`), never literals
    in tests or page objects. Never commit secrets.
15. **Tests should be independent unless a scenario explicitly requires a stateful
    workflow.** Default to each test creating and owning its own state; chain tests
    only deliberately, and document why when the scenario is inherently sequential.

## 4. Do Not Touch the Application

16. **Do not modify the application source code unless explicitly requested.** This
    repo automates against the SUT; it does not patch, refactor, or "fix" it. If an
    application bug blocks automation, document the finding under
    `docs/exploration/` and flag it. Do not silently work around it by changing
    application code.

## 5. Exploration Findings

17. **Store exploration findings under `docs/exploration/`.** This includes page
    structure, element inventories, API endpoint/request/response documentation,
    business rules discovered, screenshots, and DOM excerpts. Use one file per
    feature or area investigated (e.g. `docs/exploration/login.md`,
    `docs/exploration/playlists-api.md`), so the next task touching that area
    starts from recorded facts instead of re-discovering them. Record what was
    actually observed (real locator candidates, real endpoint paths, real payload
    shapes), not a template with placeholders. If a page object or API client
    claims something the matching exploration file doesn't support, treat that as a
    sign the inspection step was skipped.

## 6. Verification

18. **After implementation, run the relevant tests and analyze failures before
    declaring the task complete.** Run them for real (e.g.
    `npx playwright test path/to/spec.ts` or `--grep`/`--project` scoped to the
    changed area). Do not report a task done because the code looks correct. If
    tests fail, diagnose the cause (trace, screenshot, network log, Allure output)
    before either fixing it or reporting it honestly as unresolved. Never claim
    tests passed without having executed them.

---

## Current State

This is a green-field project. **Do not create test cases or automation code until
explicitly asked.**
