# 14. PostgreSQL backend: implementation and setup

**Checkpoint: 31 October 2026.** The user authorized the assistant to finish the remaining backend. Express/JavaScript/PostgreSQL API code is implemented and verified with synthetic, isolated database tests. This is not a production-release sign-off.

## What is delivered

| Area | Implemented behavior |
| --- | --- |
| Identity | Controlled single-CEO bootstrap; invitation/reset links; Argon2id; persistent sessions; CSRF/Origin checks; session rotation/revocation; PostgreSQL rate limits |
| Company | Explicit settings, timezone/workweek/currency locks, salary-publication readiness gate |
| Employees | Directory, safe self-profile, phone-only self edit, invite/resend, email-change reinvitation, deactivation blockers and reactivation |
| Attendance | Server punches, daily/open uniqueness, stale/cross-midnight rules, corrections/history, historical and live leave flags |
| Leave | Working-date preview/snapshots, unique reservations, approvals/rejections/cancellation/history |
| Tasks | Active assignees, reassignment scoping, state/version rules and deactivation coordination |
| Complaints | Private owner/CEO access, replies, atomic resolution, reopen/close, immutable history |
| Holidays | Date uniqueness, past-date protection, old/new-date impact preview, mandatory fingerprint and acknowledgement |
| Salary | Integer minor units, drafts, reviewed publication, immutable snapshots, void/reissue, private server-generated PDF |
| Shared | Enabled-module registry, scoped dashboard summaries, audit, strict validation, pagination, safe errors/request IDs, health endpoints |
| Operations | Explicit tracked/checksummed migrations, verified adoption of the manually executed 001, least-privilege grants, bootstrap/resend, expired-security-record cleanup |

**Later integration checkpoint:** the main frontend now uses these API sessions, tokens, UUIDs and PDFs. The fictional browser demo remains separate under `/preview`. See [Connected workspace](15-connected-workspace.md). Nothing imports or resets browser fixtures.

## Source map and request flow

- `apps/api/src/app.js`: injectable Express app, security middleware and route mounts.
- `apps/api/src/server.js`: configuration/schema startup check, loopback listener, shutdown handlers.
- `apps/api/src/core`: PostgreSQL pool, validation, errors, dates, transactions, module registry.
- `apps/api/src/modules/<feature>/routes.js`: HTTP validation, authorization and transactional feature workflows.
- `apps/api/src/modules/<feature>/service.js`: shared reads, domain helpers and module summaries. Identity also retains the original parameterized user repository.
- `apps/api/migrations`: authoritative executable table/constraint/trigger definitions.
- `apps/api/scripts`: explicit operator commands.
- `apps/api/tests`: unit/API and isolated PostgreSQL fixtures.

Flow: request ID/security headers → network limit → session lookup → unsafe-request Origin/CSRF → bounded JSON parser → authentication/role → validated module workflow → transaction/audit → allowlisted JSON.

Public response names use camelCase. PostgreSQL uses snake_case. Dates and date arrays remain `YYYY-MM-DD`, not local-midnight JavaScript timestamps. SQL parameters carry user values; SQL fragments and table names are source-controlled.

### Concurrency choice

All domain writes acquire the same PostgreSQL transaction-scoped advisory lock for this single-company installation. Sessions/rate-limit counters use independent atomic SQL. Unique/partial indexes remain the final uniqueness defense, and public `version` checks reject stale edits.

This deliberately simpler implementation serializes employee lifecycle, calendar and salary changes across API instances. It is **not a measured 1,000-concurrent-user design**. PDF preparation also holds this lock so publication/voiding and account status cannot change mid-generation. Benchmark contention before replacing it with finer-grained locks.

Audit/history failures roll back mutations. Account status/session validity are rechecked inside authenticated write transactions. Disabled features retain data and continue contributing lifecycle/settings blockers.

## Existing local database: safe setup

The original backend implementation used isolated databases. In the later authorized setup, the user corrected owner credentials locally. Missing nonsecret target fields were restored in `.env.admin`, then the actual `employee_management_dev` database was backed up, compatible manual 001 was adopted, 002 was applied and limited runtime grants were verified. Database passwords were not changed and PostgreSQL was not reset. The user-approved fictional Demo CEO was subsequently invited through private local preview delivery. Password activation/company setup remain user steps. See [the local record](15-connected-workspace.md).

Do not rerun `001_create_users.sql` manually. Do not use a runtime superuser to make startup errors disappear.

### Combined safe local command

```powershell
npm run setup:local --workspace @ems/api
```

This explicit command reads ignored `.env.admin` and `.env` without printing credentials. It requires matching loopback targets named `employee_management_dev`, an owner of the existing users table (or superuser), and a separate runtime login without elevated attributes, memberships, public-object ownership or database/schema CREATE.

It creates a custom-format backup in the sibling `EMPLOYE MANAGEMENT BACKUPS` directory, restricts the new directory to the current Windows account, verifies archive magic/listing and records its SHA-256. Only then does it adopt compatible 001, apply pending migrations and grant runtime access. It checks that account count is unchanged. `PG_BIN` and `EMS_BACKUP_DIR` optionally override the binary and backup directories.

It creates no CEO/company settings and sends no email. It is not a reset or an all-migrations rollback command. If it fails, inspect its reported phase and any completed migration before retrying. It does not revoke unrelated existing role grants. Backups may contain sensitive application records/password hashes; restricted permissions do not provide encryption or offsite recovery.

The isolated regression restores its pre-upgrade archive into a separate empty test database. The actual backup has format/list/checksum validation, but no actual-data restore drill is claimed.

### Individual operator steps

These are an alternative to the combined command, not instructions to rerun completed migration 001:

1. Back up the existing development database before the first schema upgrade. Keep the backup separate from test fixtures. The old pre-backend source ZIP and archived cluster are not backups of current development data.
2. Keep `apps/api/.env` and its current secret values. Add missing configuration from `.env.example`; **do not overwrite the existing file**.
3. Create a local, ignored `apps/api/.env.admin` with the correct database host/port/name and an existing schema-owner login/password. It is only for operator commands. Never paste its password into chat or commit it. Optional `RUNTIME_ROLE=ems_app` selects the existing limited runtime role.
4. From the workspace root, run:

```powershell
npm run migrate --workspace @ems/api -- --baseline
```

`--baseline` is for the manually applied 001. The runner creates a temporary reference schema and compares column types/defaults/nullability, constraints and indexes before recording 001. A mismatch stops without adopting it. It then applies 002 transactionally. Applied checksums prevent unnoticed edits to migration history. A completely new empty database uses the same command **without** `--baseline`.

5. After migration succeeds, grant only the runtime table permissions:

```powershell
npm run grant:runtime --workspace @ems/api
```

The role must already exist and have database CONNECT and schema USAGE access. The script grants schema USAGE and narrowly scoped table operations; it does not create a role, change a password, grant DDL/admin powers or revoke unrelated existing permissions. Ensure the runtime role has no inherited privileged memberships and does not own the schema/tables.

6. Start the API:

```powershell
npm run dev:api
```

Default listener: `http://127.0.0.1:3000`. Startup deliberately fails when the database, schema journal or migration permissions are not ready. There is no automatic migration on startup.

## CEO setup and delivery

`MAIL_MODE=disabled` is the default and sends nothing. Invitation creation keeps an invited account and reports failed delivery. CEO bootstrap refuses disabled delivery to avoid creating an inaccessible initial account.

For fictional local testing only, explicitly configure in the API `.env`:

```dotenv
MAIL_MODE=preview
MAIL_PREVIEW_DIR=.local-mail
BOOTSTRAP_CEO_NAME=Synthetic CEO
BOOTSTRAP_CEO_EMAIL=ceo@example.test
```

Then:

```powershell
npm run bootstrap:ceo --workspace @ems/api
```

The preview adapter writes a sensitive local JSON message, not a real email. The directory is ignored by version control and restricted to the current Windows account when newly created. Keep it out of sync/backup/public-serving folders; existing custom ACL entries still need operator review. Do not print/share the token. Delete old preview messages after use. Production rejects preview delivery.

A setup link lasts 24 hours. Its token is in the URL fragment (`#token=...`), not a query string. The connected invitation page captures/removes the fragment and POSTs `token` and `newPassword` to `/api/v1/auth/accept-invitation`, using a fresh CSRF session. Redemption returns to login rather than signing in automatically. The synthetic example above is not an implicit default for a company deployment.

If bootstrap delivery fails or an invited CEO's link expires:

```powershell
npm run bootstrap:ceo --workspace @ems/api -- --resend
```

Resend works only for an invited CEO. An active CEO uses password recovery. There is no CLI default password or hidden account-reset override.

SMTP mode uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional credentials and `MAIL_FROM`. STARTTLS is required when implicit TLS is not selected. The adapter was not connected to a real provider during implementation. Real recipient/sender setup and sending require separate authorization.

Delivery happens outside transactions. Failure/crash can leave delivery `failed` or `pending`; invitations are resendable and recovery can be requested again. There is no durable email worker/retry queue. Database tokens are hashes; logs/API responses never contain raw tokens.

## API client essentials

1. GET `/api/v1/auth/csrf`; preserve its cookie and `data.csrfToken`.
2. Every unsafe request uses `Content-Type: application/json`, `Origin` exactly equal to `APP_ORIGIN`, and `X-CSRF-Token`.
3. POST `/auth/login` with `email` and `password`; save the rotated cookie and returned CSRF token.
4. GET `/auth/session` for identity/profile/capabilities.
5. Use each record's current integer `version` for edits/actions. Refresh after 409; do not automatically retry arbitrary creates.

Postman can store cookies and send the configured Origin. The connected frontend uses Vite's same-origin `/api` proxy (default target `http://127.0.0.1:3000`, override `EMS_API_TARGET`). API `APP_ORIGIN` must exactly match the browser origin, including port. There is deliberately no credentialed CORS configuration.

All action routes expecting no fields still receive `{}`. Unknown fields return 422, malformed JSON/UUIDs return 400, wrong content type/encoding returns 415, and oversized JSON returns 413. See [API contracts](05-api-contracts.md) for routes and exact field additions.

Company settings have no seeded business defaults. The CEO's first PATCH `/company` uses `version: 0` and **all** fields:

- `displayName`, `legalName`, `statementAddress`, `timezone`
- `workingWeekdays` (Sunday=0 through Saturday=6)
- `currencyCode`, `currencyMinorUnit`, `leaveTypes`
- `salaryPublicationEnabled`, `salaryJurisdiction`

Blank legal fields and `salaryPublicationEnabled: false` allow initial internal setup. Currency precision must match the selected currency. Enabling publication is an explicit CEO assertion that legal/company fields and jurisdiction have been reviewed, not automated legal validation.

## Operations and production controls

- Set a stable random `RATE_LIMIT_SECRET` of at least 32 characters in production. All API instances must share it. Development uses a stable, explicitly nonsecret local key.
- Set `NODE_ENV=production`, HTTPS `APP_ORIGIN`, SMTP configuration and `READINESS_SECRET` (at least 32 characters). No production preview-mail fallback.
- Production cookies are host-only `__Host-ems`, Secure, HttpOnly, SameSite=Lax. Local HTTP uses `ems.sid`.
- `/health/live` is public and DB-independent. Production `/health/ready` requires `X-Readiness-Key`; restrict it at the proxy/network too.
- `TRUST_PROXY_HOPS=0` by default. Only change after restricting direct API access and reviewing the exact proxy topology. With zero, all proxied clients otherwise share the proxy's IP limit.
- Logs contain only request ID, method, status and duration. Configure proxy logs not to capture cookies, bodies or account links.
- `PDF_FONT_PATH` optionally selects a trusted local font. Without one, non-ASCII statement text fails safely with `PDF_FONT_REQUIRED`. Review character coverage and page rendering for the chosen company languages. No remote font/image fetching.
- `npm run cleanup:expired --workspace @ems/api` removes expired sessions/rate counters and account tokens expired more than seven days ago. It never deletes business history. Schedule it only in the intended environment; no scheduler was installed.
- Do not edit applied SQL files. Add a numbered migration. There is no automatic destructive down/reset command.
- PostgreSQL remote TLS, backup encryption/PITR, retention, hosting, proxy/CSP behavior, operational alerting and verified CEO recovery must be reviewed before deployment.

## Verification evidence

From the workspace root:

```powershell
npm run test:api
npm run test:api:integration
npm run check:api
npm test
npm run typecheck
npm run build
npm audit
```

Verified:

- **14 backend unit/foundation tests**, including disabled/local-preview mail delivery and production-preview refusal.
- **37 backend workflow scenarios plus 4 local-setup/backup/restore scenarios**, reported as **43 passing tests** including two parents.
- **95 frontend unit tests**, TypeScript check and production build.
- **31 connected-browser assertions and 50 preserved-preview assertions**; scope and limits are in [document 15](15-connected-workspace.md).
- Backend JavaScript syntax check. No backend TypeScript compilation/linter is claimed.
- Dependency audit: **0 reported vulnerabilities** at this checkpoint.
- The frontend build retains two pre-existing, nonblocking Zod PURE-annotation warnings.

Integration tests use installed PostgreSQL 18 binaries (`PG_TEST_BIN` may override their directory). They create a uniquely named temporary SCRAM cluster on a random IPv4 loopback port, grant a separate limited runtime role, execute migrations and HTTP journeys, then stop and remove that fixture. They do not load `.env` or use the user's application/admin credentials, databases or Windows service. An interrupted process may leave its own `%TEMP%/ems-api-test-*` fixture; inspect ownership before manual cleanup.

Coverage includes permission/ownership denial, CSRF/Origin, invitation failures/expiry/replay/concurrent redemption, session rotation/revocation, rate-limit persistence, migration adoption/checksum refusal, role grants, punch/leave/task/publish races, audit rollback, calendar staleness, private PDF labels/content and immutable history.

The first integration run exposed `DATE[]` local-time conversion. The fix preserves PostgreSQL calendar-date arrays as strings, and a unit regression now guards it. A later concurrency-test fixture shared one anonymous session, so successful redemption invalidated the second request at CSRF; the final fixture uses independent sessions to exercise token consumption itself.

## Remaining acceptance and release work

- Complete the invited Demo CEO's password and explicit company settings, then review the connected workflows on the intended local database.
- Finish independent keyboard, screen-reader and PDF visual/layout acceptance. Synthetic browser/API journeys passed; this does not silently close the nine historical external QA checks.
- Verify real SMTP, HTTPS/cookies/CSRF/proxy/CSP on the deployment, remote PostgreSQL TLS, graceful deployment shutdown and restore drills.
- Benchmark Argon2 parameters, queries, the global write lock and PDFs on representative 1,000-user history/load. No capacity or latency target is claimed.
- Approve company policies, currency/jurisdiction, retention, CEO MFA/recovery and complaint-review conflicts. There is no statutory payroll compliance claim.
- Obtain explicit approval before real employee import/invitations, cloud spending or public deployment.
