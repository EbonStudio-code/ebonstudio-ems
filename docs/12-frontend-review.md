# 12. Preserved Frontend Preview Review

## 1. Delivered scope

A rough, interactive React + TypeScript frontend for **CEO/Admin** and **Employee**. The structure is modular and the styling is intentionally a first-pass business dashboard. Final branding and polish can follow review.

This guide covers only the preserved **browser-only prototype at `/preview`**. The main application routes now use the [API-connected workspace](15-connected-workspace.md), with real sessions and private PDF downloads. Preview records remain separate and are not imported into PostgreSQL.

## 2. Run locally

From the repository root:

```powershell
npm install
npm run dev
```

Visit `http://127.0.0.1:5173/preview/login`.

- Choose a role on the sign-in preview. No password is required.
- The demo bar switches between CEO and Employee.
- In Employee mode, choose any active sample employee.
- Reset demo restores ten fictional employees and the original sample records.
- The development server binds to the local machine only.

### Light and dark themes

Use the **moon/sun theme button** in the workspace header or on any sign-in/recovery screen. It is available to both CEO and Employee roles, including on mobile.

- The theme follows your device's color scheme until you choose light or dark.
- An explicit choice is stored separately under `ems.theme` and survives navigation, reloads, sign-out, role switching, and demo-data resets.
- Theme preferences synchronize across same-origin browser tabs.
- If browser storage is blocked, the toggle still works for the current page session.
- Tables, forms, dialogs, calendars, status badges, and salary previews support dark mode.
- Browser printing keeps salary statements in the light palette.
- Theme helpers have ten unit tests in addition to the existing thirty workflow tests.

Theme verification passed: production build/type checking, all 40 unit tests, and 95 browser assertions covering saved preferences, role/navigation persistence, desktop/phone layouts, dark dialogs and inputs, selected text/background contrast, and the light-print stylesheet. The operating-system print dialog and a comprehensive accessibility audit were not automated.

For a production build preview:

```powershell
npm run build
npm run preview
```

Visit `http://127.0.0.1:4173/preview/login`. This serves the fictional preview without a backend. Other routes use `/api`; the asset preview command does not start that API.

## 3. Page inventory

**Prefix every route in this preview inventory with `/preview`.** For example, the preview dashboard is `/preview/ceo/dashboard`; `/ceo/dashboard` is now the connected workspace.

| Area | CEO/Admin | Employee |
| --- | --- | --- |
| Dashboard | `/ceo/dashboard` | `/employee/dashboard` |
| Employees | `/ceo/employees`, `/ceo/employees/:id` | `/employee/profile` |
| Attendance | `/ceo/attendance` | `/employee/attendance` |
| Leave | `/ceo/leave`, `/ceo/leave/:id` | `/employee/leave`, `/employee/leave/:id` |
| Tasks | `/ceo/tasks`, `/ceo/tasks/:id` | `/employee/tasks`, `/employee/tasks/:id` |
| Complaints | `/ceo/complaints`, `/ceo/complaints/:id` | `/employee/complaints`, `/employee/complaints/:id` |
| Holidays | `/ceo/holidays` | `/employee/holidays` |
| Salary slips | `/ceo/salary-slips`, `/ceo/salary-slips/:id` | `/employee/salary-slips`, `/employee/salary-slips/:id` |
| Company settings | `/ceo/settings` | Not available |
| Audit history | `/ceo/audit` | Not available |
| Account security | `/ceo/security` | `/employee/security` |

Access-flow previews:

- `/login`
- `/forgot-password`
- `/reset-password?token=demo`
- `/accept-invitation?token=demo`
- `/session-expired`
- Unknown or role-restricted pages show a not-available screen.

Invalid/missing demo tokens on setup/reset screens show the invalid-link state. The string `demo` is an intentional visual-preview flag, not a security token.

## 4. Interactive workflows

### CEO

- Search/filter/page the employee directory.
- Add/edit employees, simulate invitations and acceptance, deactivate/reactivate with blocker checks.
- Inspect attendance and correct existing records with a reason and retained history.
- Review, approve, reject, or cancel leave requests.
- Assign/edit/reassign tasks and change their status.
- Reply to and resolve complaints.
- View the holiday calendar/year list; add/edit/remove future holidays after impact acknowledgement.
- Create/edit salary drafts with earning/deduction lines, publish, void, and create replacement revisions.
- View printable salary statements, including DRAFT/VOID markings.
- Edit company display/statement details.
- Search/filter the demo audit trail.

### Employee

- View own profile and update a demo phone number.
- Check in/out and inspect own attendance/corrections.
- Request whole-day leave, view request history, and withdraw pending requests.
- View assigned tasks and update progress.
- Submit complaints, reply, reopen resolved complaints, or close them.
- View company holidays.
- View only own published/voided salary statements in the UI and print/save a demo copy.
- Review the password-change form without storing credentials.

## 5. Demo data and privacy

- All names, work emails, company details, complaints, and salary figures are fictional.
- Initial account addresses use the reserved `example.test` domain.
- UTC, USD, and Monday-Friday are sample settings, not confirmed company policies.
- Data changes persist in local storage under `ems.frontend-demo.v1`.
- Preview role selection persists in tab session storage under `ems.preview-session`.
- Reset affects only these prototype records, not other websites.
- **Never enter real employee, complaint, salary, or password data.**
- Anyone with browser access can read or alter the demo data. Frontend route guards and ownership filtering are usability demonstrations, not security boundaries.

## 6. Implementation map

| Location | Responsibility |
| --- | --- |
| `apps/web/src/core/modules.ts` | Feature and navigation registry, lazy-loaded pages |
| `apps/web/src/core/models.ts` | Typed data shapes and saved-demo validation |
| `apps/web/src/core/domain.ts` | Pure demo commands, validation, transitions, ownership filtering |
| `apps/web/src/core/seed.ts` | Fictional initial records with relative dates |
| `apps/web/src/core/store.tsx` | React context, browser persistence, preview sessions, notices |
| `apps/web/src/core/dates.ts` | Dates, working-day counts, exact monetary conversion |
| `apps/web/src/components` | Shared layout, tables, forms, dialogs, status badges |
| `apps/web/src/modules` | Independent feature screens |
| `apps/web/src/styles.css` | First-pass responsive styling and statement print rules |

New preview modules register in `core/modules.ts` and keep their pages inside their own feature directory. Connected screens live separately in `src/live`, using authenticated API calls and server-side authorization. Do not mix preview IDs, browser persistence or simulated identities into connected records.

## 7. Automated checks

The preview has **82 tests**: 30 workflow tests, 10 theme tests, and 42 QA regressions. The full frontend suite now has **95 tests**, including 13 API-client tests. Its 50 focused preview-browser assertions pass after the route relocation. See [QA fixes](13-qa-fixes.md) and the [connected checkpoint](15-connected-workspace.md).

```powershell
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

The 30 demo-domain tests cover:

- Schema-valid seeds and role/owner-filtered views.
- Account creation, uniqueness, invitation simulation, and deactivation blockers.
- Duplicate punches, ownership, cross-midnight checkout, stale attendance, and corrections.
- Leave overlap, cancellation, and CEO decisions.
- Task reassignment and employee restrictions.
- Complaint confidentiality filtering, replies, resolution, and closure.
- Holiday impact and retained leave snapshots.
- Salary snapshots, publication, void/reissue, and negative-net rejection.
- Business dates and zero/two/three-decimal money handling.

These tests do not validate a backend, concurrent database writes, real sessions, or production security.

### Initial frontend verification (historical)

- Production frontend build and TypeScript checks: passed.
- Demo-domain tests: 30 passed using Vitest 5.0.5.
- Dependency audit: zero known vulnerabilities reported at verification time.
- Browser suite: 75 assertions passed, including CEO and Employee list/detail routes at 1440-pixel and 360-pixel frame widths, no page-level horizontal overflow, role switching, employee creation/search, task assignment/progress, leave request/approval, complaint submission/reply/resolution, attendance punches, salary publication, mobile navigation, and out-of-scope route denial.
- The desktop browser pane owns its viewport and rejected direct emulation. Responsive checks used same-origin browser frames at the specified widths, not a second headless browser.
- Screenshot capture timed out. The embedded browser later disconnected before the supplementary holiday-edit, salary-void, profile, and recovery-form suite could return its report. Those supplemental browser results are **not claimed as verified**; the corresponding domain transitions are covered where listed in unit tests.
- Browser print/save-to-PDF was provided but the operating-system print dialog was not automated.
- Comprehensive accessibility auditing, manual screen-reader review, and production performance/security tests were not run.
- The build emits two non-blocking Rollup warnings about comments in the installed Zod dependency; compilation succeeds.

## 8. Suggested user review

1. Open CEO preview and inspect every navigation entry.
2. Add a fictional employee. Simulate invitation acceptance to make them available in the employee picker.
3. Assign a task to Maya Chen.
4. Switch to Maya's Employee view, check in/out, and update a task.
5. Submit a leave request and complaint using fictional text.
6. Switch back to CEO, process the request, and reply to the complaint.
7. Publish Maya's current-month draft statement.
8. Switch to Maya and open the newly published statement. Use Print / Save PDF.
9. Check the phone-sized layout and mobile navigation.
10. Reset the demo after review.

## 9. Deliberate limitations

- No server, database, real authentication, secure session, CSRF protection, recovery email, or actual invitation delivery.
- Password forms validate presentation only. Values are not saved.
- No real payroll, tax calculation, salary transfer, or statutory compliance guarantee.
- PDFs use the browser print dialog. Authenticated server-side PDF downloads come later.
- Browser time is used for demo attendance; production must use server time.
- No reliable multi-tab synchronization, transaction isolation, version conflicts, or tamper-proof audit.
- Calendar preview acknowledgement is local; production needs transactional stale-preview detection.
- Frontend history retains only the latest 500 demo audit events.
- Timezone/workweek/currency are locked sample fields because demo history already exists.
- No file uploads, messaging integrations, or real-world notification side effects.
- Final visual design, branding, comprehensive accessibility review, and production performance testing remain future work.

## 10. QA follow-up

Phone fields now reject malformed values with inline guidance while still permitting a blank optional phone. Existing audit history automatically normalizes to consistent module categories, including one **Salary slips** filter. Long-dialog errors, post-checkout guidance, and access-page titles have also been corrected.

Existing invalid contact values are not erased automatically. Edit or clear them explicitly. Audit migration does not require a demo reset and retains the existing records. See [the QA follow-up](13-qa-fixes.md) for rules, regression commands, and the nine acceptance checks still requiring independent verification.
