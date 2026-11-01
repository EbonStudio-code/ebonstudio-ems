# 08. Testing and Acceptance

**Current validation status (31 October 2026):** 95 frontend tests, 14 backend unit tests and 41 real-PostgreSQL scenarios pass (43 including two parent tests). Typecheck/build, API syntax and dependency audit pass; zero vulnerabilities reported. Connected browser journeys pass 31 assertions; the preserved demo passes 50. The new setup test restores a pre-upgrade synthetic backup into a separate empty test database. See [Connected workspace](15-connected-workspace.md) for evidence and limitations. Keyboard input is blocked by the hidden desktop browser pane; full visual/print/accessibility acceptance, actual database restore, real SMTP/TLS/proxy, load and release checks remain open. Historical external QA statuses are not silently changed.

## 1. Test layers

| Layer | Planned coverage |
| --- | --- |
| Unit | Business dates, money arithmetic, validation, status transitions, permission helpers |
| Database/API integration | Real isolated PostgreSQL 18, limited runtime role, transactions/indexes, ownership, sessions and errors |
| React component | Forms, permissions, error states, keyboard behavior, role-specific displays |
| End-to-end browser | Complete CEO/Employee journeys, mobile layouts, downloads, logout |
| Security-focused | Cross-user access, CSRF, session revocation, mass assignment, injection, rate limits |
| Performance | Representative seeded workload, indexed lists, dashboard and PDF behavior |
| Operations | Backup restore, migration validation, readiness and recovery |

Use synthetic data and isolated test databases. Do not test destructive workflows against production records.

## 2. Shared fixtures

- One CEO and ten synthetic employees.
- A larger synthetic dataset with approximately 1,000 accounts for growth tests.
- Two ordinary employees specifically used for cross-user denial checks.
- Invited, active, suspended, future-starting, and reactivated employees.
- Multiple timezones including a daylight-saving zone, regardless of the eventual company location.
- Zero-, two-, and three-decimal currency test cases.
- Past/current/future holidays and salary months.

Fixtures must not include real employee identities, credentials, complaint text, or payroll data.

## 3. Acceptance scenarios

### FR-01: Accounts and authentication

- Controlled setup creates exactly one CEO; repeated/concurrent setup cannot create another.
- Employee creation creates account/profile together; a transaction failure leaves neither orphaned.
- Failed invitation delivery is visible to CEO and resendable.
- Invitation is one-use, expires after 24 hours, and is invalidated by resend.
- Recovery response does not reveal account existence; reset token expires after 30 minutes.
- Passwords are hashed; secrets never appear in responses/logs.
- Login rotates the session ID; idle/absolute limits are enforced even before expired-record cleanup.
- Logout, reset, email change, and deactivation revoke the appropriate sessions.
- CSRF is rejected on login, token redemption, and every unsafe authenticated action.
- Concurrent token redemption succeeds at most once.

### FR-02: Employees

- CEO creates, searches, edits, deactivates, and reactivates an employee.
- Employee sees only own profile and edits only own phone.
- Duplicate email/code returns a conflict, including inactive records.
- Deactivation lists blockers and cannot race with a new attendance record, leave request, or task assignment.
- Reactivation requires a fresh setup flow; old sessions and invitations do not revive.
- No role escalation or password hash leakage occurs through broad PATCH payloads.

### FR-03: Dashboard

- CEO summaries match module records and exclude CEO/future starters from active headcount.
- Employee summaries contain only own data.
- Non-working days do not produce an absent label.
- Not-checked-in list excludes approved leave.
- Disabled module widgets disappear; a failed query is not presented as zero.
- No complaint body or salary amount leaks into a dashboard response.

### FR-04: Attendance

- Employee checks in and out with server time.
- Duplicate/concurrent check-ins create exactly one daily/open record.
- Duplicate checkout cannot replace the first accepted checkout time.
- Open attendance prevents another check-in, including on a later date.
- Cross-midnight checkout preserves the original work date.
- Daylight-saving changes calculate actual elapsed duration correctly.
- Over-24-hour records require CEO correction.
- Corrections require a reason, valid time range, matching work date, and immutable prior-value history.
- Another employee cannot read the record or correction history.
- Holiday/weekend/leave punches are flagged without changing leave or salary.
- Approving/cancelling leave after check-in changes the live overlap indicator but does not rewrite punch-time flags; pending leave alone does not trigger the approved-leave indicator.

### FR-05: Leave

- Working-date preview excludes holidays/non-working weekdays.
- Invalid, backdated, zero-working-day, and excessive date ranges are rejected.
- Day count and working-date list are stored on submission.
- Concurrent overlapping submissions cannot both reserve the same employee date.
- Approval/rejection/cancellation follow role and state rules.
- Rejection/cancellation releases reservations atomically.
- Employee cannot cancel approved leave or change submitted dates.
- Calendar changes do not silently rewrite old requests.
- Date preview can become stale; final submission returns authoritative dates.

### FR-06: Tasks

- CEO assigns a task to one active employee.
- Only the current assignee sees or changes employee-side progress.
- Employee cannot edit assignment, priority, or due date through crafted requests.
- Reassignment removes prior assignee access immediately.
- Done/Cancelled tasks are not overdue.
- Stale edits return 409 rather than silently overwriting.
- A reopen/reassignment cannot bypass inactive-employee lifecycle checks.

### FR-07: Complaints

- Submission clearly states that it is named and visible to CEO.
- Lists, details, messages, counts, and status actions deny cross-employee access.
- Both participants can reply until Closed.
- Only CEO can resolve, with a required resolution reply.
- Resolution reply and state change commit together.
- Employee can reopen/close only their own Resolved complaint.
- Closed content is immutable.
- Malicious text renders as text, not markup or script.
- Logs and dashboards contain no complaint body.

### FR-08: Holidays

- CEO creates unique-date holidays and employees can view them.
- Past entries cannot be modified or removed.
- Impact preview includes both old and new dates for a date change.
- New/cancelled leave between preview and commit causes a stale-impact conflict.
- Removing a holiday requires a reason and current impact acknowledgement.
- Existing leave/attendance snapshots remain unchanged.

### FR-09: Salary slips

- CEO creates a draft with safe integer monetary values and valid precision.
- Gross/deductions/net are server-calculated, including zero/three-decimal currency cases.
- Negative net, invalid values, excess lines, and numeric overflow are rejected.
- Employees cannot list, fetch, or download drafts.
- Published snapshot does not change after employee/company profile edits.
- Concurrent publication cannot create two Published slips for the same employee/month.
- Published figures cannot be edited; voiding requires a reason.
- Replacement receives a new revision without overwriting history.
- Own Published/Voided PDFs download correctly; unauthorized PDFs return no data.
- Draft/void markings are present and no salary document is publicly cacheable.
- PDF template-version history remains renderable after template updates.

## 4. Module extensibility tests

- Disabled feature routes are unavailable even when called directly.
- Disabled feature data is not deleted.
- Invalid dependency combinations fail startup.
- Required core modules cannot be disabled.
- Dashboard and navigation use the same enabled capabilities.
- A test-only minimal module can register through the documented interface without changing unrelated domain services.

## 5. Frontend and accessibility checks

- CEO and employee full journeys on desktop and a 360-pixel mobile viewport.
- Keyboard-only navigation, visible focus, correct dialog focus return.
- Accessible names, labels, field errors, and state announcements.
- Loading/empty/error/forbidden/expired-session states for each feature.
- No private cached screen after logout or switching users.
- Duplicate clicks and lost-network responses do not create misleading success.
- PDF download works in supported desktop/mobile browsers.

## 6. Performance test proposal

Use approximately 1,000 synthetic users and representative history: about 250,000 attendance rows, 12,000 salary-slip revisions, and realistic task/leave/complaint volumes.

Run a documented mixed workload at an initial target of 50 concurrent active sessions. This is a starting benchmark, not the user's stated concurrency requirement. Record hardware, deployment shape, database size, network, duration, throughput, error rate, p50/p95/p99 latency, and query plans.

Target ordinary API p95 below 500 ms on that environment. Measure PDF generation separately. Do not claim capacity for 1,000 simultaneous users from a 1,000-record dataset.

If a target fails, profile and fix the measured bottleneck before adding infrastructure.

## 7. Release gate

- [ ] Relevant unit, API, component, and browser suites pass.
- [ ] Type checking, linting, and production builds pass.
- [ ] Cross-employee access and CEO permission tests pass.
- [x] Implemented concurrency and transaction rollback scenarios pass on isolated PostgreSQL.
- [ ] Dependency/security review has no unresolved applicable high/critical issue.
- [ ] Accessibility checks and mobile workflows are reviewed.
- [ ] Backup restore and deployment smoke tests pass.
- [ ] Business-policy and legal/retention decisions are recorded.
- [ ] User reviews and approves the release.

Record actual commands/results only after implementation provides them. Do not list imagined test results or runnable commands that do not exist.

The check above is scoped to the recorded synthetic API tests, not every future staging/browser/operational scenario. Integration fixture creates and stops its own temporary SCRAM cluster; it does not use the existing application database. No 1,000-user load results or restore-drill results are claimed.
