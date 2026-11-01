# 01. Product Requirements

## 1. Product goal

Provide one secure internal website where the CEO can manage a small team and employees can complete routine work and HR requests. Start with 1 CEO and 10 employees. Keep feature boundaries clear so additional modules can be added without redesigning the entire application.

Approximately 1,000 **total users** is a growth target, not a promise of 1,000 simultaneous requests or concurrent sessions. Performance must be measured on the eventual deployment.

## 2. Requirement status

**Confirmed:** React/Express/Node with the subsequently approved PostgreSQL database; modular design; initial team size; CEO and Employee roles; the nine first-release areas below; documentation before code initially; later authorization to complete the backend, local setup and frontend integration.

**Business review pending:** company policies, hosting, legal/retention decisions and performance targets. React uses TypeScript and the implemented API uses JavaScript ESM. See [decisions and risks](11-decisions-and-risks.md) and the [backend checkpoint](14-backend-implementation.md).

## 3. Users

| Role | Responsibilities | Boundaries |
| --- | --- | --- |
| CEO | Manage employee accounts, oversee attendance, approve leave, assign tasks, handle complaints, maintain holidays, publish salary slips | Cannot bypass immutable history or turn off essential access controls |
| Employee | View own profile, record own attendance, request leave, update assigned tasks, submit complaints, view holidays, access own salary slips | Cannot access another employee's private records or change employment/salary details |

There is exactly one CEO account in the first release. The CEO does not have an employee record and does not check in, request leave, or receive salary slips through employee workflows in this version.

## 4. First-release scope

| ID | Area | Minimum deliverable |
| --- | --- | --- |
| FR-01 | Authentication | Invite-only employee accounts, secure sessions, password setup/recovery, logout, deactivation |
| FR-02 | Employees | CEO directory, employee creation/editing/deactivation, self-profile view |
| FR-03 | Dashboard | CEO company summary and employee personal summary, scoped by permission |
| FR-04 | Attendance | Employee check-in/out, own history, CEO overview and reasoned corrections |
| FR-05 | Leave | Full-day requests, CEO decisions, withdrawal/cancellation, status history |
| FR-06 | Tasks | CEO creates/assigns tasks; assigned employees update progress |
| FR-07 | Complaints | Private employee-to-CEO submissions and replies, with resolution tracking |
| FR-08 | Holidays | Company-wide holiday calendar managed by CEO |
| FR-09 | Salary slips | CEO-managed monthly statements, publication, own-employee PDF download, void/reissue history |

Minimal company settings, audit records, email delivery for account access, and shared UI elements are supporting infrastructure, not additional business modules.

## 5. Explicitly excluded

- HR, manager, contractor, or multiple CEO roles.
- Multi-company tenancy, branches with separate calendars, or multiple company currencies.
- Recruitment, onboarding checklists, training, performance reviews, goals, assets, expense reimbursement, and benefits.
- Automatic payroll, tax calculations, statutory filing, salary transfers, and bank integrations.
- Biometric attendance, GPS tracking, screenshots, monitoring, shifts, breaks, overtime calculations, and multiple daily attendance sessions.
- Half-day/hourly leave, accruals, carry-forward, leave balances, and multi-stage approvals.
- Project management, task dependencies, subtasks, task chat, or file attachments.
- Anonymous complaints, confidential CEO-only notes inside complaint threads, and complaint attachments.
- General document uploads, social login, mobile apps, broad reporting/export builders, and a plugin marketplace.
- Automatic external holiday imports or integrations with messaging platforms.

Adding any of these requires an explicit scope change.

## 6. Product principles

1. Keep everyday actions short and understandable.
2. Enforce authorization on the server, not just through hidden navigation.
3. Retain accountable history for sensitive changes.
4. Make private data private by default.
5. Add modules through a documented registry and contracts, not copied cross-module logic.
6. Prefer a small operational footprint over premature microservices.

## 7. Success and acceptance

The first release is useful when:

- The CEO can provision ten employee accounts without public registration.
- Each employee can complete all enabled self-service workflows.
- The CEO can process requests and publish a salary slip without editing database records.
- An employee cannot access another employee's attendance, leave, tasks, complaints, or salary slips by changing a URL or request.
- Core workflows work on desktop and phone browsers.
- Duplicate submissions and simultaneous actions do not create duplicate attendance, overlapping leave reservations, or multiple current salary slips.
- Every feature listed as complete has passed its acceptance tests and user review.

## 8. Nonfunctional requirements

| Area | Proposed requirement |
| --- | --- |
| Accessibility | Target WCAG 2.2 AA for implemented screens; verify keyboard and screen-reader basics |
| Responsive layout | Usable from 360 CSS pixels upward; no page-level horizontal scrolling for primary workflows |
| Performance | At the documented staging load, ordinary API requests target p95 under 500 ms, excluding email and PDF work |
| Frontend loading | Target primary page usability within 3 seconds on a documented mid-range mobile/network profile |
| Data access | Server pagination, bounded filters, and indexes for list queries |
| Money | Integer minor units, explicit currency, no floating-point monetary arithmetic |
| Time | UTC timestamps; company-local business dates using a configured IANA timezone |
| Privacy | Minimal personal data; no passwords, tokens, complaint bodies, or salary amounts in application logs |
| Reliability | Database constraints and transactions protect cross-record invariants |
| Auditability | Sensitive changes record actor, entity, action, timestamp, and reason where required |
| Recoverability | Tested database backups and a documented restore procedure before production |

These are acceptance targets, not measured results or contractual availability guarantees.

## 9. Scope change control

For a new requirement, update the module specification, permissions, data model, API contract, acceptance tests, and roadmap together. Record whether it changes existing stored data or policy. The user reviews that change before coding.
