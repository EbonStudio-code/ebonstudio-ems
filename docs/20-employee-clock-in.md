# 20. Employee clock-in and immediate attendance

**1 November 2026.**

## Confirmed requirement

The user asked for an employee clock-in option that records attendance when work starts, initially mentioning 9 AM. After clarification, the selected policy was:

> Clock in at any time: mark Present and save the actual clock-in time. No 9 AM cutoff, restriction or Late classification.

Clock-in is manual, not an automatic attendance mark at 9 AM.

## Employee experience

1. Sign in with an employee account.
2. At the top of the dashboard, select **Clock in**. The same control is available on **My attendance**.
3. After the server saves the record, the card shows **Present**, the actual clock-in time (including seconds), and **Clock out**.
4. Select **Clock out** when finished. The actual clock-out time is saved. The employee remains Present and cannot start a second session that day.

The card uses the company timezone. Live history/detail timestamps retain their existing browser-timezone display, explicitly labelled in the page description. The fictional preview labels its browser-clock source and does not claim to use server time.

CEO dashboards show **Present today**. Attendance history distinguishes **Present** from the separate session state, **Clocked in / Clocked out**. CEO accounts do not receive employee clock controls.

## Implementation and safeguards

- Shared presentation: `apps/web/src/components/AttendanceClock.tsx`.
- Shared state descriptions and preview adapter: `apps/web/src/core/attendance-summary.ts`.
- Live and preview clock controllers reused by their dashboard and attendance pages.
- Existing live `POST /attendance/check-in` receives an empty body. The server chooses the authenticated employee, timestamp and company-local work date.
- Existing `POST /attendance/check-out` receives only the open record ID and version.
- The API and database schema did not change. **Present** means an attendance record exists for that work date; it does not replace the existing OPEN/CLOSED lifecycle or introduce payroll/absence calculations.
- Requests disable repeated submission while pending. Errors remain visible and never mark attendance as successful. Database duplicate/concurrent-punch protection remains authoritative.
- Existing start-date, module-permission, session, ownership, version, one-session-per-day and 24-hour correction rules remain.
- An earlier open session is not displayed as today's Present record. Employees must close it first, or seek CEO correction if stale.
- Existing non-working-day and approved-leave review flags remain visible. No employee records, company settings, normal preview storage, or normal attendance data were changed for testing.
- Original black/gold/white palette, logo and typography are retained. No new dependency.

## Verification

| Check | Result |
| --- | --- |
| Frontend Vitest | **149 passed**, 10 files |
| TypeScript and production build | Passed; existing two nonblocking Zod annotation warnings remain |
| Isolated PostgreSQL backend suite | **38 scenarios passed** (39 Node test entries including the parent suite) |
| Connected browser journeys | **38 assertions passed**, no failures |
| Focused preview clock/state/layout suite | **132 assertions passed**, no failures |

New tests cover before/at/after 9 AM without a cutoff, actual timestamps, immediate Present before checkout, retained Present after checkout, disabled future/stale states, company-local midnight, permission gating, no client timestamp input, rejected API requests and duplicate protection.

Connected browser checks actually clicked dashboard Clock in, simulated a failed request, tried rapid repeated clicks, checked server timestamps/history, clocked out from the attendance page, and reloaded the dashboard. All records and mail were synthetic.

The focused preview suite covered both pages, ready/open/completed states, **360/900/1440px**, light/dark themes, fitting headings/actions, page overflow and 44px minimum action height. It also exercised preview clock-in/out, future starters and earlier/stale sessions.

Evidence:

- `docs/evidence/attendance-connected-2026-11-01.json`
- `docs/evidence/attendance-preview-2026-11-01.json`

An initial browser-test race was fixed by waiting for separately loaded dashboard figures. The embedded browser transport timed out on long evaluations, but completed in-page reports were subsequently recovered and saved. The hidden pane also paused finite animations; the layout suite explicitly finishes only its synthetic iframe's finite animations before measuring settled geometry. It does **not** certify animation playback.

Full axe, native keyboard/screen-reader acceptance and the older broad preview regression suite were not rerun in this pass. Semantic markup is covered by unit tests, but this is not a full accessibility certification.

Test services use only loopback ports 3006/5186/5184 and an independently generated PostgreSQL fixture. The normal API and frontend are left untouched. No deployment, real email or real-data mutation was performed.
