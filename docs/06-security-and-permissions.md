# 06. Security and Permissions

**Status:** Backend controls and browser integration are implemented, with evidence in [Backend implementation](14-backend-implementation.md) and [Connected workspace](15-connected-workspace.md). Production configuration and independent security review remain gates. This is not a security certification.

## 1. Role and ownership matrix

| Action | CEO | Employee |
| --- | --- | --- |
| View company dashboard | Yes | No; personal dashboard only |
| List employee directory | Yes | No |
| View employee profile | All | Own only |
| Create employee/invite account | Yes | No |
| Edit employment details/email/name | Yes | No |
| Edit own phone | Not applicable to CEO profile | Yes |
| Deactivate/reactivate employee | Yes, with safeguards | No |
| Change password | Own only | Own only |
| Change another user's password directly | No; send setup/recovery flow | No |
| Check in/out | No | Own only |
| Read attendance/corrections | All | Own only |
| Correct attendance | Yes, with reason | No |
| Submit leave | No | Own only |
| Read leave | All | Own only |
| Approve/reject leave | Yes | No |
| Cancel pending leave | Yes, with reason | Own only |
| Cancel approved leave | Yes, with reason | No |
| Create/edit/reassign tasks | Yes | No |
| View tasks | All | Currently assigned only |
| Change task status | All allowed CEO transitions | Own non-cancelled task progress only |
| Submit complaint | No | Yes |
| Read/reply to complaint | All | Own only |
| Resolve complaint | Yes, with resolution reply | No |
| Reopen/close resolved complaint | Yes | Own only |
| View holidays | Yes | Yes |
| Change holidays | Yes, with impact acknowledgement | No |
| Create/edit Draft salary slip | Yes | No |
| Publish/void salary slip | Yes | No |
| View/download salary slip | All, including marked Draft | Own Published/Voided only |
| Read audit records | Yes | No generic audit access |
| Change company settings | Yes, subject to locking rules | No |
| Change roles/module enablement | No general UI in version 1 | No |

Frontend permissions improve usability only. Every API action rechecks role, ownership, state, and module enablement.

## 2. Authentication and sessions

- Invite-only accounts. No public registration and no role field accepted during signup/token redemption.
- Passwords use Argon2id (19,456 KiB memory, 2 iterations, parallelism 1). Deployment-specific benchmarking is still required.
- Password policy: 12-128 characters, allow passphrases and password-manager paste, never silently truncate or trim.
- Do not email passwords, use shared defaults, or log credentials.
- Production session cookie uses Secure, HttpOnly, SameSite=Lax, Path=/, no Domain attribute, and a host-bound name.
- Local HTTP development must use an explicitly separate configuration; never weaken production cookie settings to fix local setup.
- Rotate session ID on login and privilege-sensitive session changes.
- Enforce 30-minute inactivity and 8-hour absolute expiry on the server.
- Validate account status/session version on authenticated requests so revocation is immediate.
- Password reset, email change, or deactivation revokes existing sessions.
- Password change verifies current password, revokes other sessions, and rotates the current session.
- Rate limits use shared persistence so adding API instances does not bypass them.
- Login/recovery/setup errors avoid account enumeration; employee creation duplicate-email feedback remains CEO-only.

MFA is not in the current feature list. Single-factor CEO access is an explicit pre-production risk decision. If MFA is required, amend the scope and contracts before release.

## 3. CSRF, origin, and browser controls

- Use a session-bound synchronizer CSRF token obtained through the CSRF endpoint.
- Validate it on every unsafe request, including login, logout, password setup/reset, and holiday deletion.
- Enforce expected Origin and narrow trusted-proxy settings.
- SameSite cookies alone are not the complete CSRF defense.
- Production serves UI and API from one origin. Local development uses a controlled proxy.
- Do not allow wildcard credentialed CORS.
- Use HTTPS, appropriate security headers, a tested Content Security Policy, clickjacking protection, and nosniff.
- Clear private frontend caches on logout/account switch. Session expiry removes cached private screens.

## 4. Object authorization

Owner-scoped queries include the authenticated employee ID in the database filter. Never fetch an arbitrary record and trust a client-supplied owner.

Complaint messages inherit authorization from their parent complaint. Salary PDF downloads recheck both ownership and publication state. Task access follows the current assignee, not the original assignee.

Responses for a missing object and an out-of-scope employee object use the same 404 structure. Lists, counts, searches, and dashboard summaries obey the same scope as detail endpoints.

## 5. Input and output handling

- Reject unknown fields and mass assignment of role, owner IDs, computed totals, or trusted timestamps.
- Validate UUIDs, real calendar dates, periods, currency precision, ranges, and maximum lengths.
- Do not accept operator-shaped objects, raw SQL or arbitrary sort/query expressions; all user values are SQL parameters.
- Escape and constrain search patterns. Current directory search is bounded substring matching; production query-plan/scale validation is pending.
- Render user text as text, never raw HTML.
- Salary PDFs use trusted templates and escaped text. No remote assets/URLs resolved from user text.
- Version 1 has no arbitrary file uploads, which removes an unnecessary attack surface.
- JSON body size limits, route-specific rate limits, and bounded pagination protect resource use.

## 6. Sensitive data handling

| Data | Handling |
| --- | --- |
| Passwords/tokens/session secrets | Hash where applicable; otherwise secret management; never log |
| Salary amounts/statements | CEO and owner only; private/no-store API and PDF responses |
| Complaint content | CEO and owner only; no generic dashboard/email/log content |
| Work contact/profile data | Minimum necessary fields; no employee-wide directory by default |
| Audit reasons/correction history | Access-controlled business records; not public telemetry |
| Backups | Encrypted, restricted, retention-approved, restore-tested |

No bank account, government ID, date of birth, home address, or emergency-contact data is collected in the initial employee form. Company statement address is collected only for company documentation, not employee home addresses.

No third-party analytics, session replay, or error reporting that captures page content is enabled by default.

## 7. Audit and transactional integrity

Audit account creation, invitation resend, email/status changes, attendance correction, leave decisions, task reassignment/status, complaint state changes, holiday mutations, and salary publication/voiding.

Store minimal event metadata. Mandatory domain history and audit writes are part of the same database transaction as the protected mutation. If required history cannot be recorded, the mutation fails.

Security events such as login failures may use a separate redacted operational stream. Do not store full request bodies to make debugging easier.

Runtime grants plus PostgreSQL triggers enforce append-only history. A privileged database administrator can still change/bypass controls. Restrict database access and consider external tamper-resistant audit storage later if compliance requires it.

## 8. Key threat cases

| Threat | Required defense |
| --- | --- |
| Employee changes an ID to read another salary slip | Owner-scoped query and state check on detail and PDF routes |
| Employee submits CEO role or salary totals in a request | Strict allowlisted validation and server-owned fields |
| External page triggers a state change | CSRF token, Origin checks, cookie policy |
| Complaint text injects script | Plain-text rendering, CSP, no raw HTML |
| Deactivated session remains valid | Account/session-version check and session revocation |
| Parallel check-ins or leave submissions | Unique indexes and transactions |
| Employee accepts a stale invitation after email change | Invalidate old tokens; one-use expiry-checked redemption |
| Slip is changed after publication | Immutable values/snapshots; void-and-reissue only |
| Privileged action loses its audit record | Atomic mutation/history transaction |
| Preview becomes stale before holiday edit | Calendar guard and impact fingerprint revalidation |

## 9. Production security review gate

- Test cross-employee denial on every private collection and PDF route.
- Review dependencies and resolve applicable high/critical vulnerabilities.
- Verify real production TLS, cookies, CSRF, CORS, and proxy behavior.
- Verify secrets are external to source control and frontend bundles.
- Confirm backups and restore access do not expose records.
- Decide CEO MFA, retention, jurisdiction, hosting region, and recovery procedures.
- No claim of legal compliance or penetration-test completion without actual evidence.

Current limits: no CEO MFA, durable mail worker or real SMTP verification; global domain-write serialization is not load-benchmarked; local preview mail contains sensitive links and must stay restricted/unshared. Production readiness uses a separate header secret and should also be network-restricted. Connected tests cover session-revocation cleanup, delayed responses after account changes and hostile complaint text as plain text. This is bounded evidence, not exhaustive privacy/XSS testing or independent security approval.
