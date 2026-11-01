# 05. API Contracts

**Status:** Routes below are implemented in the PostgreSQL/JavaScript API and consumed by the [connected workspace](15-connected-workspace.md). Local database setup is complete; CEO activation/company setup and deployment remain pending. See [Backend implementation](14-backend-implementation.md) for tested scope.

## 1. Global conventions

- Base path: `/api/v1`.
- JSON request/response bodies, except PDF responses.
- Session cookie authentication; no bearer token in browser local storage.
- All unsafe requests require the session-bound CSRF header and allowed Origin, including login and token redemption.
- Successful object responses contain `data`; list responses contain `data` and `pagination`.
- Errors contain `error.code`, a safe `error.message`, optional field errors, and `requestId`.
- IDs are opaque. Employee-owned routes derive owner identity from the session, never from a trusted body field.
- Mutations on existing mutable records require `version`, except session/account token operations with their own one-use checks.
- Normal lists accept `page` (default 1), `limit` (default 20, maximum 100), and allowlisted filters/sorts.
- Responses include only explicitly documented/allowlisted fields. Never serialize raw models.
- Authenticated and token-related responses use private no-store caching.
- Clients must not automatically retry arbitrary create mutations after an ambiguous timeout. Reload current state first. Domain uniqueness handles punches, leave reservations, and current slips; generic task/complaint deduplication is not promised.

## 2. Status and error conventions

| Status | Examples |
| --- | --- |
| 200 | Read or successful update/action |
| 201 | Newly created resource |
| 204 | Logout or successful holiday removal |
| 400 | Malformed JSON or invalid UUID identifier |
| 401 | Missing/expired/invalid session |
| 403 | Role or CSRF failure |
| 404 | Record absent or outside employee scope; disabled feature route |
| 409 | Stale version, duplicate record, invalid current state, blocking work, stale calendar preview |
| 415 | Non-JSON content type or unsupported compressed/character encoding |
| 422 | Unknown fields, invalid field/date syntax or business validation |
| 429 | Rate limit, with retry guidance |
| 503 | Required dependency unavailable |

Use stable codes such as VALIDATION_FAILED, NOT_AUTHENTICATED, FORBIDDEN, NOT_FOUND, VERSION_CONFLICT, ATTENDANCE_ALREADY_OPEN, LEAVE_OVERLAP, EMPLOYEE_HAS_BLOCKERS, CALENDAR_CHANGED, and SALARY_ALREADY_PUBLISHED.

Unauthorized employee object lookups return the same 404 shape as a missing object. CEO-only endpoint access by an Employee returns 403 before record lookup.

## 3. Core and authentication

All paths below are relative to the base path.

| Method/path | Access | Input or purpose |
| --- | --- | --- |
| GET `/health/live` | Public, minimal response | Process liveness only |
| GET `/health/ready` | Development loopback; production requires X-Readiness-Key | Database/migration readiness; no secrets |
| GET `/auth/csrf` | Anonymous or authenticated | Establish session-bound CSRF token |
| POST `/auth/login` | Anonymous + CSRF | email, password |
| GET `/auth/session` | Authenticated | user ID, role, display name, safe self-profile summary, enabled capabilities, session expiry |
| POST `/auth/logout` | Authenticated | Destroy current session |
| POST `/auth/accept-invitation` | Anonymous + CSRF | token, newPassword |
| POST `/auth/forgot-password` | Anonymous + CSRF | email; always generic acceptance response |
| POST `/auth/reset-password` | Anonymous + CSRF | token, newPassword |
| POST `/auth/change-password` | Authenticated | currentPassword, newPassword; revoke other sessions and rotate current session |
| GET `/company` | Authenticated | Public internal company settings needed by the UI; no provider secrets |
| PATCH `/company` | CEO | version and allowlisted editable company fields; locking rules apply |
| GET `/audit-events` | CEO | Bounded entity/action/date filters; redacted audit metadata only |

Login rotates session ID. Setup/reset token redemption does not silently sign the user in; it returns them to login.

`GET /auth/csrf` returns `data.csrfToken`; fetching it rotates CSRF material for that session. Login/change-password return the new CSRF token and expiry along with a rotated cookie. Keep them together. Empty action payloads are `{}`.

The first company PATCH uses `version: 0` and all company fields: `displayName`, `legalName`, `statementAddress`, `timezone`, `workingWeekdays` (0=Sunday), `currencyCode`, `currencyMinorUnit`, `leaveTypes`, `salaryPublicationEnabled`, `salaryJurisdiction`. Later patches accept a subset plus current version. No demo defaults are inserted.

## 4. Employees

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/employees` | CEO | Paginated directory; name/code/department/status filters |
| POST `/employees` | CEO | Create account/profile and attempt invitation delivery |
| GET `/employees/me` | Employee | Own profile and safe account fields |
| PATCH `/employees/me` | Employee | version and phone only |
| GET `/employees/:id` | CEO | Employee detail |
| PATCH `/employees/:id` | CEO | version and allowed profile fields; email change triggers re-invitation |
| POST `/employees/:id/invitation` | CEO | Resend setup invitation for an invited account; revoke previous token |
| GET `/employees/:id/deactivation-check` | CEO | Open attendance, leave, and unfinished task blockers |
| POST `/employees/:id/deactivate` | CEO | version, reason; recheck blockers transactionally |
| POST `/employees/:id/reactivate` | CEO | version; restore employment status and issue fresh setup invitation |

Creation fields: fullName, email, employeeCode, jobTitle, department, startDate, optional phone.

CEO edits may change fullName, email, employeeCode, jobTitle, department, startDate, and phone. Changing startDate after attendance/leave history exists cannot invalidate that history; reject such a change and require a reviewed correction process.

Employee responses contain id, userId, employeeCode, fullName, email, jobTitle, department, startDate, phone, employmentStatus, accountStatus, timestamps, and version. Never include password hashes or session/token details.

Create/resend responses may expose `invitationDelivery` as sent or failed to the CEO. Do not expose the raw invitation token.

## 5. Dashboards

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/dashboard` | Authenticated | Role-specific, enabled-module summary |

CEO data includes aggregate counts and bounded work lists defined in the module specification. Employee data includes only personal summaries. Do not use one all-company payload and hide fields in the browser.

## 6. Attendance

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/attendance/me` | Employee | Own paginated history; date filters |
| GET `/attendance/me/current` | Employee | Open record, today's record, and allowed next action |
| POST `/attendance/check-in` | Employee | Empty business body; server timestamps and owner |
| POST `/attendance/check-out` | Employee | attendanceId, version; close own open record with server time |
| GET `/attendance` | CEO | Paginated records by employee/date/state |
| GET `/attendance/:id` | CEO or owner | Record plus bounded correction history |
| POST `/attendance/:id/corrections` | CEO | version, checkInAt, checkOutAt, reason |

Punch and history responses contain id, workDate, state, checkInAt, checkOutAt, durationSeconds when closed, punch-time flags, currentApprovedLeaveOverlap, and version. The live overlap field reflects subsequent leave decisions without changing historical flags.

Attendance detail includes `corrections: { data, pagination }`; `page`/`limit` select its history. `/me/current` returns `openRecord`, `todayRecord`, and `nextAction` (CHECK_IN, CHECK_OUT, COMPLETE, NOT_STARTED, or CEO_CORRECTION_REQUIRED).

Repeated/conflicting punches return 409; they never change an already closed timestamp. A stale record over 24 hours returns a business error with a CEO-correction next step.

## 7. Leave

| Method/path | Access | Purpose |
| --- | --- | --- |
| POST `/leave/preview` | Employee | type, startDate, endDate; show eligible dates/count, not a reservation |
| POST `/leave/requests` | Employee | type, startDate, endDate, reason; calculate and reserve dates transactionally |
| GET `/leave/requests` | CEO or Employee | CEO all; Employee only own; bounded state/date filters |
| GET `/leave/requests/:id` | CEO or owner | Detail and state history |
| POST `/leave/requests/:id/approve` | CEO | version |
| POST `/leave/requests/:id/reject` | CEO | version, reason |
| POST `/leave/requests/:id/cancel` | CEO or pending-request owner | version; reason required for CEO |

Response fields include id, employeeId, type, dates, workingDatesSnapshot, dayCount, reason, state, decision metadata, timestamps, and version.

Dates are `startDate`/`endDate`; `calendarRevisionAtSubmission` preserves the original calculation revision. Detail includes bounded immutable `history`. Rejected/cancelled states cannot be reopened.

Preview is informational; a new holiday or concurrent request can make it stale. Submission recalculates and returns the authoritative dates for confirmation in the result.

## 8. Tasks

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/tasks` | CEO or Employee | CEO all; Employee currently assigned only; state/due/priority filters |
| POST `/tasks` | CEO | title, description, assigneeEmployeeId, priority, optional dueDate |
| GET `/tasks/:id` | CEO or current assignee | Detail |
| PATCH `/tasks/:id` | CEO | version and allowed task details, including reassignment |
| POST `/tasks/:id/status` | CEO or current assignee | version, state; role-specific transition rules |

Task response includes id, title, description, safe assignee summary, priority, state, dueDate, completedAt, timestamps, and version. Employees cannot mass-assign an assignee, priority, or due date through the status endpoint.

## 9. Complaints

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/complaints` | CEO or Employee | CEO all; Employee own; state/category filters |
| POST `/complaints` | Employee | subject, category, description |
| GET `/complaints/:id` | CEO or owner | Private detail |
| GET `/complaints/:id/messages` | CEO or owner | Paginated chronological replies |
| POST `/complaints/:id/messages` | CEO or owner | version, text; not allowed when Closed; advances parent version |
| POST `/complaints/:id/status` | CEO or owner | version, state; resolutionText required for CEO resolving |

The status endpoint enforces the transition table, not just role membership. Employee cannot set Open to In review or resolve a complaint. Resolving creates the required resolution reply in the same transaction.

List responses omit description/message bodies; detail reads include them only after parent ownership checks.

Adding a message returns its public fields and `parentVersion`, which the client must use for the next parent mutation.

## 10. Holidays

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/holidays` | Authenticated | Year/date-range calendar |
| POST `/holidays/impact-preview` | CEO | Intended create/update/remove operation and proposed date/name/note; return affected leave and fingerprint |
| POST `/holidays` | CEO | date, name, optional note, impact fingerprint and acknowledgement |
| PATCH `/holidays/:id` | CEO | version, changed fields, reason, impact fingerprint and acknowledgement |
| DELETE `/holidays/:id` | CEO | version, reason, impact fingerprint and acknowledgement in JSON body |

Even a zero-impact preview returns a fingerprint. Date changes evaluate both old and new dates. Recompute and validate under the calendar guard at commit; stale preview returns 409.

Holiday responses contain id, date, name, note, and version. Impact detail is CEO-only.

Preview input is `{ operation: "CREATE" | "UPDATE" | "DELETE", holidayId?, version?, date?, name?, note? }`. UPDATE/DELETE require holidayId and version. DELETE disallows replacement fields. CREATE requires name/date. A preview returns `impactFingerprint`, `affectedDates`, `affectedCount`, up to 100 `affectedRequests`, `truncated`, and resolved `proposed` fields.

Create/update/delete must supply exactly the reviewed proposal plus `impactFingerprint` and `acknowledgeImpact: true`; edit/delete also require reason/version. Even zero impact must be acknowledged.

## 11. Salary slips

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET `/salary-slips` | CEO or Employee | CEO all; Employee own Published/Voided only; period/state filters within scope |
| POST `/salary-slips` | CEO | employeeId, period, earnings, deductions, optional note; create Draft revision |
| GET `/salary-slips/:id` | CEO or eligible owner | Detail; employees cannot read Draft |
| PATCH `/salary-slips/:id` | CEO | version, earnings, deductions, note; Draft only |
| POST `/salary-slips/:id/publish` | CEO | version; capture snapshots, validate readiness and uniqueness |
| POST `/salary-slips/:id/void` | CEO | version, reason; Published only |
| GET `/salary-slips/:id/pdf` | CEO or eligible owner | Authorized PDF; DRAFT/VOID marking follows current state |

Employee/period/currency/revision cannot change after draft creation. Draft monetary lines may be edited. A replacement for a voided slip uses the create endpoint and a new revision.

PDF responses use application/pdf, a safe server-generated filename, attachment disposition, private/no-store caching, and no public storage URL. Recheck ownership and state at download time.

Money lines are `{ label, amountMinor }`; calculated outputs are `grossMinor`, `totalDeductionsMinor`, `netMinor`. Each input line is capped at 1,000,000,000,000 minor units. Draft PATCH accepts any subset of earnings/deductions/note plus version. A configured local font is required for non-ASCII PDF text; otherwise PDF generation returns `PDF_FONT_REQUIRED` rather than corrupting characters.

## 12. Input limits and consistency

- Full names and ordinary titles: up to 120 characters.
- Job titles/departments: up to 100 characters.
- Task and complaint descriptions/replies: up to 5,000 characters.
- Decision/correction/void reasons: up to 500 characters.
- Salary line labels: up to 80 characters; limits and monetary validation follow the data model.
- Non-upload JSON request body limit: 64 KiB, uncompressed UTF-8 JSON.
- Reject unknown fields and operator-shaped objects; parameterize SQL values and whitelist filters. Sorting is fixed by endpoint, not a raw client SQL/sort expression.
- Register literal routes such as `/me` and `/current` before parameterized ID routes.
- Patches do not allow generic role, owner ID, status, totals, or timestamp changes.

## 13. Implemented list filters

All normal lists use page/limit. Extra accepted filters:

| Route | Filters |
| --- | --- |
| employees | search (escaped substring), department, status |
| attendance/me and attendance | from, to, employeeId, state; employee ownership always applies |
| leave/requests | state, employeeId, from, to |
| tasks | state, priority, assigneeEmployeeId, dueBefore |
| complaints | state, category |
| holidays | from, to, year |
| salary-slips | employeeId, period, state; owner/publication scope always applies |
| audit-events | entityId, module, action, from, to |

Dashboard returns date/timezone/workingDay and enabled module summaries. Lists are capped (tasks/upcoming leave/holidays 5, CEO not-checked-in 10); no complaint text or salary amounts are included. These are server payloads, not proof that preview widgets are API-connected.
