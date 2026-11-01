# Leave Preview Cancel Fix

Date: 2026-11-01  
Severity: Low, UX

## Cause and Fix

The affected screen is the connected employee Leave request's **Preview working dates** step, not the fictional `/preview` workspace.

`apps/web/src/live/Leave.tsx` passed `cancel={() => setPreview(null)}` to the confirmation form. Cancel switched back to the initial form without closing the dialog. Its uncontrolled date and reason fields remounted empty.

The confirmation form now passes `cancel={close}`, just like the initial form. Cancel dismisses the whole request dialog. Starting another request explicitly opens a fresh form. No new Back/Edit behavior or draft persistence was introduced.

This is a one-line production change. Submission, validation, permissions, working-date calculation, backend contracts, and database behavior are unchanged.

## Reproduction and Regression

The user's saved screenshot/reproduction files were not located in the workspace and were not reviewed. The described behavior was independently reproduced on the existing DB-free fixture at `http://127.0.0.1:5187/employee/leave`.

1. Open **Request leave** as the fixture employee.
2. Choose Sick, a future date, and a synthetic reason.
3. Select **Preview working dates**.
4. Select **Cancel** without checking the submission confirmation.
5. Before the fix: the dialog stayed open, with empty start date, end date, and reason. This reproduced twice.
6. After the fix: the dialog was unmounted and the Leave list remained visible. No initial form reopened.

`apps/web/tests/leave-cancel.browser.js` exercises actual rendered state transitions and throws on functional failure. It covers initial-form Cancel, preview Cancel twice across reopenings, the close button, a dispatched dialog cancel event, explicit fresh reopening, and the absence of record mutations.

The fixture now supplies only an empty Leave list and a single synthetic working-date preview, and records Leave endpoint/method calls in memory. It does not implement or prove server working-date rules. It has no database, mailer, or API proxy, and does not provide a Leave submission endpoint.

To rerun: start `node tests/polish-fixture.mjs` from `apps/web`, POST `{"role":"EMPLOYEE","scenario":"ready"}` to its `/__ui-fixture`, open its `/employee/leave`, then run `import('/tests/leave-cancel.browser.js').then(m => m.runLeaveCancelChecks())` in that page. The harness refuses any other origin/path. Results also remain in `window.__leaveCancelChecks`.

## Validation

- Final browser regression: **12 functional assertions passed**, zero failed.
- Recorded Leave calls: two GET list reads and four POST previews. No submission, cancellation, withdrawal, or other record mutation call.
- Frontend suite: **187 tests / 16 files passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed, with the same two nonblocking Zod/Rollup annotation warnings.
- Evidence: `docs/evidence/leave-preview-cancel-2026-11-01.json`.
- Normal frontend `/login` and API `/api/v1/health/ready` both returned HTTP 200 after validation.

No real records, normal `/preview` storage, mail, or backend code were changed. No backend integration rerun was needed for the handler-only change.

## Limits and Separate Observation

The embedded page reported visible but did not have browser focus. Four immediate programmatic observations did not see focus return to **Request leave**, both before and after this fix. An additional initial-form close check also observed body focus after React cleanup. These are explicitly retained as diagnostic observations, not passing focus assertions. Native keyboard/focus-return acceptance remains unverified and is separate from the fixed Cancel state transition. Shared dialog focus behavior was not changed.

The dialog cancel event was dispatched programmatically, not by a native Escape key. No screenshot or new accessibility audit was performed for this handler-only fix. Earlier UI screenshots/audits are not evidence for this change.
