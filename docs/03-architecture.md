# 03. Architecture

**Current implementation:** npm workspaces containing an API-connected React/TypeScript workspace, a preserved `/preview` demo, and an Express/JavaScript ESM API. PostgreSQL 18 replaces the original MongoDB proposal. See [Backend implementation](14-backend-implementation.md) and [Connected workspace](15-connected-workspace.md).

## 1. Modular monolith

One deployable API with feature modules, not independent microservices. One company, CEO and Employee roles. No message broker, Kubernetes, arbitrary plugin execution or shared-contract package is required or implemented.

| Concern | Current choice |
| --- | --- |
| Frontend | React, Vite, TypeScript; same-origin API client/session state; separate browser demo store |
| Backend | Supported Node.js, Express 5, JavaScript ESM |
| Database | PostgreSQL 18, pg, explicit SQL migrations |
| Validation | Zod strict schemas, parameterized SQL |
| Identity | PostgreSQL sessions/hashed tokens, Argon2id |
| Email | Disabled default; explicit local preview; Nodemailer SMTP adapter; injected fake in tests |
| PDF | PDFKit, retained template version 1, local fonts only |
| Tests | Node test + Supertest + real isolated PostgreSQL; existing frontend Vitest tests |

Exact installed versions are in the lockfile. The connected client uses native fetch, typed DTOs and a small abortable resource hook; no TanStack Query or shared-contract package was added. API mutations are not automatically retried.

## 2. Source responsibilities

| Area | Responsibility |
| --- | --- |
| `apps/web/src/core` | Preview state, domain behavior, theme and navigation |
| `apps/web/src/components` | Shared frontend controls |
| `apps/web/src/modules` | Preserved browser-backed preview feature pages |
| `apps/web/src/live` | API client, scoped session/resource state, connected pages and forms |
| `apps/api/src/app.js` | Middleware, injectable dependencies and route mounts |
| `apps/api/src/core` | Config, pool, dates, validation, errors, transactions/audit, module registry |
| `apps/api/src/modules/<feature>/routes.js` | HTTP checks and transactional feature workflows |
| `apps/api/src/modules/<feature>/service.js` | Shared reads, domain helpers, guards and summaries |
| `apps/api/src/modules/identity/user.repository.js` | Internal parameterized account lookup |
| `apps/api/migrations` | SQL tables, foreign keys, indexes and immutable-history triggers |
| `apps/api/scripts` | Explicit migration/grant/bootstrap/cleanup tools |
| `apps/api/tests` | Unit and isolated integration tests |

The pragmatic JavaScript implementation keeps business workflows in module routers and shared logic in services. It does not pretend every endpoint has separate controller/repository wrappers.

## 3. Module registry and dependencies

`core/registry.js` declares stable feature IDs, dependencies, mount paths and router factories. Configuration selects enabled modules. Invalid dependency combinations fail startup. Core identity, company and employees are always available; disabled feature routes return 404 to authenticated callers and their dashboard widgets are omitted.

| Feature | Required | Shared consumption |
| --- | --- | --- |
| Employees | Identity/company/core | Retained attendance/leave/task blockers |
| Holidays | Company/core | Leave impact service, even if Leave routes are disabled |
| Attendance | Employees, Holidays | Approved-leave read helpers |
| Leave | Employees, Holidays | Calendar dates and revision guard |
| Tasks | Employees/core | Eligibility and ownership |
| Complaints | Employees/core | Owner identity |
| Salary slips | Employees/company/core | Employee/company snapshots |
| Dashboard | Core/employees | Enabled module summary functions |

Disablement never deletes data or ignores historical lifecycle/settings blockers. Connected navigation and route guards use session capabilities from the API; the separate preview retains its own demo registry. Server authorization remains authoritative.

## 4. Boundaries and explicit coupling

- Features own their writes and transition rules. Identity and employee lifecycle are closely coordinated.
- Employee eligibility/snapshots, calendar dates, leave impact, lifecycle blockers and dashboards use shared service functions.
- Scoped SQL projections join employee ownership and approved leave where needed. These are explicit internal read dependencies, not independently extractable service boundaries.
- User values are query parameters. Table names, update fields and SQL fragments are source-controlled.
- Account responses use allowlists, not raw user/session/token rows. Domain projections likewise enumerate public fields; company output strips internal guard fields.
- Domain DTOs use camelCase; SQL uses snake_case. `DATE` and `DATE[]` stay calendar strings.
- Future controller/repository extraction or shared TypeScript contracts must preserve behavior/tests, not add empty layers.

Examples: salary publication captures an Employees snapshot; Attendance checks Leave without rewriting it; Dashboard calls module summary functions rather than querying private tables itself.

## 5. Request flow

Request ID/security headers → network rate limit → persistent session lookup → unsafe-request Origin/CSRF → bounded JSON parser → authentication/role → validated feature workflow → scoped transaction/audit → allowlisted response.

Session status/version is checked on each authenticated request and rechecked inside domain write transactions. Errors expose safe codes/messages and a request ID, not SQL, stack traces or credentials.

## 6. Transactions and concurrency

PostgreSQL transactions cover account/profile creation, employee lifecycle, mandatory audit/history, leave reservations, complaint resolution, holiday changes and salary revisions/publication.

The current implementation uses **one transaction-scoped PostgreSQL advisory lock for domain writes** in this single-company installation. This serializes lifecycle, calendar and salary races across API instances. Session/rate-counter SQL remains independently atomic. PDF preparation also holds the lock while state and authorization are stable.

Database unique/partial indexes remain the final defense for canonical email/code, one CEO, daily/open attendance, employee/date leave reservations and draft/current statements. Mutable records expose an integer `version`; stale writes return 409. History/audit errors roll back the whole domain mutation.

This favors correctness over maximum throughput. It is not evidence of 1,000 concurrent-user capacity. Benchmark before replacing the global lock with deterministic per-employee/calendar/period locks.

### Calendar guard

Leave and holiday changes advance an internal calendar counter. A holiday fingerprint covers the intended operation, target/version, resolved proposed values and guard. Preview returns affected dates/count and up to 100 request summaries. Commit recomputes under the same write lock. Old leave snapshots and attendance punch flags are never rewritten.

## 7. Side effects

Persist hashed account tokens first; deliver email outside the database transaction. Delivery failures/pending outcomes are visible to the CEO for invitations. Resend/recovery produces a fresh link and invalidates previous tokens. No durable mail worker or automatic retry platform exists.

Preview delivery is explicit local-only mode and contains sensitive links in ignored local files. Production requires SMTP configuration. No real recipient was contacted during implementation.

## 8. Scaling and extension

Proposed production shape: same-origin HTTPS web/API, PostgreSQL, restricted networking, approved mail and backup services. Hosting is not provisioned.

Measure query plans, substring directory search, dashboard work, connection use, Argon2, PDF generation and global-lock contention on representative data. Additional API processes must share the PostgreSQL stores and stable rate-limit key. Add workers/private storage only for measured needs.

To add a module:

1. Define scope, data ownership, permission and dependencies.
2. Register its ID/routes and optional summary/guard service.
3. Add versioned SQL migrations, bounded contracts and scoped workflows.
4. Add frontend integration separately; disablement must hide both routes and widgets.
5. Test ownership, concurrency, rollback, dependencies and retained-data behavior.
6. Review operations and get approval before enabling new business scope.

Modularity limits change scope; it does not make every feature a zero-integration plugin.
