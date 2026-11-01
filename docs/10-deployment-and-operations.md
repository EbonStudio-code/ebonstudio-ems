# 10. Deployment and Operations

**Status:** Production runbook remains proposed. The authorized local database backup/migration/grants and fictional CEO invitation succeeded; see [Backend setup](14-backend-implementation.md). No infrastructure was created/contacted for public deployment.

The [connected workspace](15-connected-workspace.md) now uses a same-origin Vite development proxy. Production still needs a reviewed HTTPS reverse proxy and static asset setup. `setup:local` has an isolated backup/restore regression; it is not proof of actual-data recovery, offsite backups or a deployment restore drill.

## 1. Environment strategy

| Environment | Purpose | Data |
| --- | --- | --- |
| Local development | Developer work and isolated integration tests | Synthetic only |
| Staging | User review, browser tests, migrations, load tests | Synthetic or explicitly approved anonymized data |
| Production | Actual company use | Minimum approved employee data |

Separate database credentials, session secrets, email configuration, and URLs for each environment. Never reuse production tokens or real employee records in local fixtures.

## 2. Proposed production shape

- One HTTPS origin for React assets and the Express API.
- PostgreSQL with restricted network access, reviewed TLS and backups.
- Transactional email provider for invitations and recovery.
- Secret management supplied by the chosen hosting environment.
- Central redacted application logs and basic uptime/error monitoring.

No initial Redis, object-storage bucket, message broker, Kubernetes cluster, or standalone microservice is required. Salary PDFs are generated on demand rather than publicly stored.

Provider, region, domain, pricing, and operating budget remain undecided. Do not purchase or provision them without authorization.

## 3. Configuration categories

The implemented API needs reviewed configuration for:

- Runtime environment, internal listening port, public app origin, trusted proxy settings.
- PostgreSQL PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD, connection limits and remote TLS.
- Stable rate-limit hashing key and private production-readiness key. Sessions are opaque server-side hashed tokens, not signed browser payloads.
- Email provider credentials, sender identity, and delivery settings.
- Enabled module IDs.
- Log level and safe monitoring configuration.

Company timezone, workweek, currency, and legal statement details live in validated company settings. They are not guessed from a developer's machine.

The tracked API `.env.example` contains placeholders only. Existing `.env` secrets are preserved; owner commands use an ignored `.env.admin`. Never share either secret file.

## 4. Initial setup sequence

1. Select and authorize infrastructure and email provider.
2. Configure HTTPS, network access restrictions, secrets, PostgreSQL TLS/backups, owner and limited runtime roles.
3. Deploy the reviewed build and run explicit versioned migrations/index checks.
4. Run the controlled, one-time CEO setup procedure.
5. CEO completes password setup and required company settings.
6. Verify sessions, CSRF, private routes, and readiness behavior on the actual domain.
7. Create one authorized test employee and run a complete acceptance smoke test.
8. After user approval, invite the remaining real employees.

No public setup endpoint or persistent default credentials should remain available.

## 5. Email operations

- Configure authorized sender identity and appropriate domain authentication with the selected provider.
- Invitation/recovery links use the configured trusted public origin, not untrusted request headers.
- Tokens must be short-lived, one-use, redacted from HTTP/application logs, and protected from referrer leakage.
- Use a no-referrer policy on token pages; avoid third-party scripts on them.
- Track delivery failures without storing full message bodies or raw tokens in logs.
- CEO can resend invitations; user recovery remains generic.
- Do not send complaint details or salary amounts in email.

## 6. Backups and restore

Proposed initial targets, subject to budget and approval:

- Encrypted daily database backups with 30-day retention.
- Recovery point objective: up to 24 hours.
- Recovery time objective: 4 hours, to be validated in a restore drill.
- Point-in-time recovery can improve these targets if the provider/budget supports it.

These are proposed operational targets, not current guarantees.

Restore into an isolated environment first. Validate record counts, unique indexes, referential consistency, leave reservations, and salary revision history. Disable outbound email during restore testing.

After a production restore, invalidate sessions and unused account tokens before access is reopened. Restoring old sessions/tokens must not revive previously revoked access.

Perform a restore drill before launch and periodically afterward. Retention must be aligned with the eventual legal and company policy.

## 7. Migrations and deployment

- Version database migrations and test against production-shaped synthetic data.
- Back up before destructive or difficult-to-reverse changes.
- Use backward-compatible changes where practical.
- Do not enable automatic production index creation without review.
- Deploy only reviewed builds that pass required checks.
- A code rollback is safe only if it remains compatible with the current database shape.
- Prefer a tested forward fix or documented migration recovery over blindly restoring an old database.
- Keep immutable salary PDF template versions needed to render existing statements.

## 8. Monitoring

Track:

- API error rates and latency percentiles.
- Database connectivity, slow queries, connection use, and storage growth.
- Login failures and rate-limit activation.
- Invitation/recovery delivery failures.
- Stale open attendance records.
- Failed salary PDF generation.
- Backup age and restore-drill status.

Logs use request IDs and safe action names. Exclude full URLs containing account tokens, passwords, session cookies, complaint bodies, salary amounts, and full request payloads.

Health endpoints expose minimal status, not database names, credentials, host details, or stack traces. Production readiness requires X-Readiness-Key and should also be restricted to deployment infrastructure at the network/proxy.

## 9. Incident procedures

### Suspected account compromise

Revoke affected sessions/tokens, suspend access if necessary, preserve redacted evidence, reset credentials through the approved process, and investigate scope. CEO recovery requires a verified operational procedure, not an employee-controlled recovery endpoint.

### Possible private-data exposure

Stop the affected access path, preserve evidence, determine which records were exposed, and follow applicable legal notification obligations with qualified advice. Do not promise that an incident is harmless before investigation.

### Database outage

Return clear unavailable responses. Do not record attendance locally and later claim it was server-verified. Keep the last UI state visibly stale and provide a company-agreed manual continuity procedure.

### Email outage

Keep valid account records and delivery failure status. Allow authorized resend after recovery. Do not display setup tokens as an emergency workaround.

## 10. Employee exits and data retention

- Follow deactivation blocker checks and revoke sessions/account tokens.
- Retain historical records according to the approved retention policy.
- Do not auto-delete salary, complaint, or attendance history.
- Decide how former employees receive legally required documents without reactivating ordinary access.
- Any export, external delivery, erasure, or legal hold is an explicitly authorized operational process.

## 11. Release authorization

User approval is required before public deployment, purchasing resources, sending real invitations, or importing real employee/payroll data. A successful local build is not authorization to launch.
