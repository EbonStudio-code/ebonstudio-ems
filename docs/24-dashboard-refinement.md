# Dashboard Refinement

Date: 2026-11-04

## Changes

- Reduced mobile spacing and duplicate dashboard summaries without reducing body text sizes. The employee dashboard starts with a compact attendance action, then useful tasks. Saved punches remain visible; the full clock remains on Attendance.
- Ordered actionable sections in the DOM: pending CEO leave approvals, overdue work, attendance corrections, then routine information. Already approved leave is not presented as an approval task.
- Grouped quiet summaries into divider rows. Missing modules, loading, errors, and successful empty results remain distinct.
- Standardized Salary Slips headings/navigation and authored heading case. User-written names, tasks, and other content are not case-transformed.
- Added a shared 44px minimum touch target for mobile icon controls. Kept the logo, palette, self-hosted fonts, themes, docked desktop sidebar, and routes.
- Preserved Leave preview Cancel, disabled attendance states, busy-dialog protection, and duplicate-submit protection. Shared dialog focus code was not changed.

Main files: `apps/web/src/live/Dashboard.tsx`, `apps/web/src/modules/dashboard/Dashboard.tsx`, `apps/web/src/components/DashboardSections.tsx`, `apps/web/src/components/AttendanceClock.tsx`, and `apps/web/src/styles.css`. Layout, Salary, and other module heading changes are copy/presentation only.

## Validation

- `npm test`: **199 tests passed in 18 files**.
- `npm run typecheck`: passed.
- `npm run build`: passed, with the same two nonblocking Zod/Rollup annotation warnings.
- Synthetic browser layout checks: **69 dark + 69 light assertions passed**. Coverage includes CEO/employee, populated/quiet/empty data, 1440/390/320px layouts, module guards, and loading/error states.
- Synthetic interaction checks: **15 assertions passed**, including busy dismissal, duplicate submission, attendance notification, disabled clock states, and Leave Cancel.
- Original Leave Cancel regression: **12 assertions passed**, including repeated preview dismissal, fresh reopening, and no leave-record submission.
- Final rendered measurements at 305/390/1440px in both themes found no page overflow or dashboard text below 13px. At 390px, the employee clock action starts around 367px and the first task around 538px. Populated CEO leave approvals start around 479px, before overdue tasks and attendance corrections.
- Ebon's isolated server on **5188** returned HTTP 200 and was left running. Cloudline on **5187** was not accessed or modified.

Detailed local results are in `tmp/refinement-dark-checks.json`, `tmp/refinement-light-checks.json`, `tmp/refinement-interactions.json`, `tmp/refinement-leave-cancel.json`, and `tmp/refinement-final-measurements.json`. The interaction file also contains the preceding light layout checks; those are not counted twice above.

## Isolation and Remaining Limits

The new `apps/web/tests/refinement-*` harness imports the real frontend but intercepts fetch calls and replaces storage with disposable in-memory maps. It accepts only the Ebon fixture on port 5188. Tests did not use normal app records, normal preview storage, or backend services. No dependencies, API contracts, database logic, or salary/attendance calculations changed. The pre-existing configurable-port change in `polish-fixture.mjs` was preserved.

Native Tab, Shift+Tab, Escape, focus trapping, and focus return remain **unverified**: the embedded browser rejected keyboard input with “Browser pane is hidden.” Programmatic dismissal observations are diagnostic only, not native-keyboard acceptance. No speculative focus fix was made.

Screenshot capture was intermittent and did not produce a complete visual-review matrix. Rendered geometry checks are not a substitute for final screenshot and visible-pane keyboard review. Backend integration tests were not rerun for this frontend-only change.

## Rerun Safely

Use the existing server at `http://127.0.0.1:5188/tests/refinement-review.html`.
Run `window.refinement.layouts(['dark'])`, save `window.refinement.reports`, then repeat for `['light']`. Run `window.refinement.dialogs()` separately.

For the original Leave regression, open `http://127.0.0.1:5188/tests/refinement-frame.html?role=EMPLOYEE&scenario=ready&path=/employee/leave`, wait for Request leave, then run `import('/tests/leave-cancel.browser.js').then(m => m.runLeaveCancelChecks())`. The frame changes its displayed URL; reopen the fixture URL, not the rewritten app URL, for a fresh isolated run.

Do not use the older port-5187 polish harness for this review.
