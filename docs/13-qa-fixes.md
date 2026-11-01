# 13. QA Fixes, 30 October 2026

This is the historical preview-only checkpoint. The preview now lives under `/preview`; its 50 focused browser assertions were rerun successfully after relocation. Later connected-app evidence is recorded separately in [document 15](15-connected-workspace.md), without rewriting the external QA report.

## Scope and evidence

This follow-up addresses the two confirmed defects and smaller observations in the user's consolidated `qa-review/REVIEW-STATUS.md` report. The external QA report and its earlier evidence are historical records and have not been edited.

Only the local frontend prototype changed. No backend, real accounts, email, payment, or deployment functionality was added.

## Implemented corrections

### BUG-01: Invalid phone values

- One shared validator now covers Employee profile updates and CEO employee creation/editing.
- Phone is optional. Empty/whitespace input clears the field.
- Nonempty input must contain 7–15 digits, with an optional leading `+` and common spaces, dashes, dots, or paired numeric parentheses.
- Letters, malformed formatting, all-zero numbers, and excessive length are rejected.
- Inline field guidance and error text identify the issue. The form prevents submission, and the demo command layer independently checks the value.
- A failed update does not change the saved phone or create a success/audit entry.
- Existing invalid values are retained for the user to correct, not silently removed or used as a reason to reset the workspace.

This is country-neutral plausibility validation, not proof that a phone number exists or can receive calls. Country-specific validation or verification can be added after company requirements are agreed.

### BUG-02: Split salary audit categories

- Audit records now use stable module IDs and separate display labels.
- Salary events use `salary-slips`, displayed consistently as **Salary slips**.
- Old `Salary slips`, `slip`, and `slips` entries normalize on load. Other known legacy module labels normalize as well.
- The migration preserves event IDs, actors, actions, timestamps, ordering, and all unrelated employee/module records.
- The normalized data is saved when browser storage permits. If the write fails, existing records remain intact and filtering still works with the in-memory normalization.
- Unknown future categories are retained. Repeated loads do not rewrite already normalized history.
- Filtering, option generation, and row labels share the same category mapping.

No demo reset is needed. Reloading the frontend applies the existing-history normalization.

### Salary validation feedback

- Error summaries now sit inside the sticky dialog heading, not above a long scrolled form.
- Failed submissions scroll the dialog to the top and focus the error summary.
- Repeated submissions of the same invalid value also reveal the message.
- The error remains inside the modal's top layer and visible while scrolling, in light and dark themes.
- Input values stay available for correction; failed salary validation does not save changes.

### Post-checkout guidance

- Dashboard and My attendance share the same attendance summary rules.
- Completed days show the checkout time and explain that no further check-in is needed today.
- The completed-day action remains disabled.
- Open/stale records have their own guidance instead of showing the completed/new-day prompt.

### Browser-page titles

The metadata observation was confirmed by code inspection: access pages did not update `document.title` when navigating from an application page.

Login, recovery, reset, invitation, expired-session, and not-found pages now use the same page-title hook as application pages.

## Regression checks

- `npm test`: **82 passing tests**, comprising 30 existing workflow tests, 10 theme tests, and 42 new QA regression cases.
- `npm run build`: TypeScript and production compilation pass.
- `node --check apps/web/tests/qa-regressions.browser.js`: browser harness syntax passes.
- Focused browser retest: **50 assertions passed, zero failures**, using isolated fixtures on port 5184. This covered invalid/valid/blank phone submission and reload, shared CEO validation, preservation and pagination of old/new audit history, salary errors at 1440-pixel light and 360-pixel dark layouts, completed-attendance guidance on both screens, and browser titles during navigation.
- The production build still reports the two previously documented non-blocking Zod comment-annotation warnings.

BUG-01 and BUG-02 are fixed and functionally retested in this frontend. The smaller modal/copy/title corrections also passed the focused browser assertions. Browser evidence here consists of rendered DOM, persisted state, focus, and element geometry checks, not new screenshot or operating-system print evidence.

New unit coverage includes optional/invalid/valid phone inputs, both account roles, failed-write preservation, audit aliases, old/new salary filtering, migration idempotence, storage-write failures, and completed/stale attendance guidance.

### Reproducible browser regression suite

Run a separate development server to keep review data isolated:

```powershell
npm run dev --workspace @ems/web -- --port 5184
```

Open `http://127.0.0.1:5184/preview/login`. From that page's browser console:

```javascript
import('/tests/qa-regressions.browser.js').then(module => module.runQaRegressionChecks())
```

The browser report is available as `window.__qaFixChecks`. Wait until `running` is false before interpreting `results` and `failures`.

The harness explicitly refuses to run on port 5173. It replaces only its own port-5184 synthetic fixture, exercises forms in a same-origin frame, and does not touch the user's normal demo records or theme preference.

The initial ad hoc browser run stopped at a JSON-property-order comparison, not a field mismatch. The corrected checked-in harness compares object values independent of property order.

## Previously blocked acceptance checks

The following **nine checks remain blocked or inconclusive from the original report** unless separately verified. This defect-fix pass does not turn partial DOM evidence into visual or print completion evidence:

1. C02: Employee voided-statement detail image.
2. C04: Malformed recovery-email rejection, visual proof.
3. C06: Reset-password mismatch, visual proof.
4. C07: Reset-password completion, visual proof.
5. C08: Invitation minimum-password-length rejection, visual proof.
6. C09: Invitation completion, visual proof.
7. C13: Company-settings persistence after reload, visual proof.
8. R20 / C14: Independent keyboard focus-trap confirmation.
9. R30: Print / Save PDF completion.

Programmatically focusing an error summary does not prove keyboard focus trapping. Inspecting a document title does not prove the blocked authentication form outcomes. Printing is deliberately not retriggered by this regression harness.
