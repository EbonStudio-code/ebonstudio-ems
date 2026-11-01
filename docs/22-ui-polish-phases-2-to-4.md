# UI polish, Phases 2–4

Date: 2026-11-01. Continued under the user's approval to finish all remaining phases in one go. Phase 1 stays documented separately in `21-ui-polish-phase-1.md`.

## Outcome

### Phase 2: dashboard

- Compact 32px desktop title and a single company-local date / timezone / working-day line.
- Shorter linked stat cards. Attendance uses the real checked-in / active-employee fraction and a bounded thin progress bar when the denominator is available. No placeholder metrics.
- Empty task, leave, holiday and salary sections use compact linked states. Complaints show a compact real-count summary.
- The connected dashboard uses a two-column grid instead of uneven independently stacked columns. Small screens use one column.
- Module visibility, zero values, non-working-day handling, employee scoping, links and clock actions remain intact.
- At CSS 1440×900 the four synthetic CEO cards ended at approximately 377px, comfortably above the fold.

### Phase 3: attendance

- Friendly instructions and company-timezone history. India timezone aliases read “India time”; other company timezones remain explicit.
- A large current display clock, today's recorded shift and separately labelled saved punches. The display clock never supplies a timestamp to a clock action.
- Available Clock in remains prominent. Future-start and completed actions remain disabled and neutral, with their existing reason.
- This week (Monday–Sunday), This month and Custom range filters plus a session-state filter. Inverted custom ranges show an error instead of sending an invalid query.
- An empty history hides the table and redundant pagination. At ≤720px, attendance days use labelled stacked cards. The mobile breadcrumb retains the page name.
- Monthly summary shows **days present and completed hours only**. Open shifts count as Present but contribute no unfinished hours.
- The monthly read is separate from the 20-row history and its filters. It requests the existing `limit=100`. The database already enforces one record per employee/work date, so the complete month has at most 31 records. Response total must equal the returned row count; otherwise the UI shows an error rather than partial or fake-zero totals.
- No Late/Absent counts or scheduled shift times were added. The existing API supplies none, and clock-in at any time still marks Present immediately.
- Shared attendance presentation also applies to `/preview`. Its normal storage was not touched by testing.

### Phase 4: shared CSS

- `src/styles.css` is now the shared token-driven stylesheet. Removed the `themes.css` import and file.
- One palette and typography/spacing/radius/shadow token set replaces the old green/Inter layer.
- Removed 413 overridden declarations and 11 unused class families after checking application TS/TSX/JS/JSX usage across live and preview. Kept other selectors and media-query order rather than guessing they were unused.
- Confirmed-unused families: workspace label/initial, sidebar monogram, studio intro topline/edition, theme-toggle label, old brand mark, auth features, old attendance banner/icon, old attendance summary.
- The original logo/assets, gold primary actions, ebony/ivory surfaces, theme toggle, self-hosted fonts, semantic statuses, reduced-motion rules and salary print structure remain.
- A broader preview audit found a scrollable table without keyboard access. Shared table regions now have a name, keyboard focus and an inset visible focus outline.
- Production CSS reduced from 67.71kB / 14.28kB gzip after Phase 3 to 62.12kB / 12.20kB gzip after Phase 4.

## Validation

Each phase ran `npm run typecheck`, `npm test` and `npm run build` from `apps/web` (the root scripts delegate to the same workspace).

| Phase | Typecheck | Tests | Production build | Rendered evidence |
| --- | --- | --- | --- | --- |
| 2 | Pass | 158 / 11 files | Pass | 8 live-page combinations, no axe violations/incomplete checks |
| 3 | Pass | 180 / 14 files | Pass | 8 live + 2 preview combinations, no axe violations/incomplete checks |
| 4 final | Pass | 184 / 14 files | Pass | 16 live/preview combinations, no axe violations/incomplete checks |

Focused combinations: CEO dashboard and employee attendance, light/dark, CSS 1440×900 and 390×844, using actual app components in exact-size same-origin iframes.

- Sampled rendered text stayed ≥13px with no sampled contrast failures or page overflow. Large stat numerals use Plus Jakarta Sans. No pixel-level digit-shape approval is claimed.
- Employee attendance has no horizontal table overflow in final desktop/mobile checks. The preview CEO dashboard still uses a horizontally scrollable table on mobile, now keyboard-focusable; it does not widen the page.
- Phase 3 interaction run: 13 passing assertions; live ticker observation skipped because the frame was hidden.
- Final interaction run: all 14 assertions pass, including display-clock advancement without a punch, empty state, future starter, >20-row monthly completeness, second history page, state/range filters, clock-in/out status toasts, retained Present, and mobile cards.
- The 28-day fixture intentionally includes synthetic future dates to stress pagination; this is not a claim about production attendance.
- 18 additional read-only preview module smoke checks (9 routes × light desktop/dark mobile) found no sampled text-contrast issues or page overflow.
- Initial Phase 3 test failure was an obsolete copy assertion. Updated the expected friendly wording, then reran successfully.
- Initial Phase 4 preview-mobile audits found one scrollable-region focus issue in each theme. Fixed it and retained both initial and final reports.
- Existing Zod/Rollup annotation warnings remain nonblocking. No new dependency was installed.

## Screenshot and manual-accessibility limits

Screenshot capture was attempted after **each phase**. Commands timed out, including diagnostic/recovery attempts and a final retry after a successful display-clock observation. No Phase 2–4 PNG was produced. Do not relabel Phase 1 screenshots as evidence for this work.

Native Tab input explicitly failed with “Browser pane is hidden; show the browser pane before sending keyboard input.” Frame visibility was intermittent: the final live-clock check succeeded, but screenshot capture still timed out. Full keyboard navigation, focus return, screen-reader testing, visual screenshot review, print rendering and runtime reduced-motion playback are **not certified**. Focus/reduced-motion rules have source tests; axe checks are automated evidence, not a complete WCAG-AA certification.

## Evidence

Under `docs/evidence/`:

- `phase-2-rendered-checks-2026-11-01.json`
- `phase-3-rendered-checks-2026-11-01.json`
- `phase-3-attendance-interactions-2026-11-01.json`
- `phase-4-css-consolidation-2026-11-01.json`
- `phase-4-rendered-checks-2026-11-01.json` (initial findings)
- `phase-4-final-rendered-checks-2026-11-01.json` (after fix)
- `phase-4-attendance-interactions-2026-11-01.json` (14 pass, including live ticker)
- `phase-4-preview-smoke-2026-11-01.json`

The final rendered-check file records the screenshot blocker at that point. The later final interaction file supersedes only the earlier live-ticker skip, not the screenshot or native-keyboard limits.

Reusable isolated harness: `apps/web/tests/polish-fixture.mjs`, `polish-review.browser.js`, `polish-attendance.browser.js`. Origin `127.0.0.1:5187`; synthetic memory/storage only, no API proxy, database, real mail or normal account.

## Safety and local handoff

- No production backend files, API contracts, permissions or attendance rules changed. Backend integration tests were not rerun for this UI-only work.
- No ordinary database records or normal preview storage were mutated. No email, import, reset, deployment or paid service was used.
- The user-reported task `QA_20261101 Task lifecycle <b>literal</b>` was **not removed**. Its current existence was not independently verified.
- Normal frontend/API were unavailable at final handoff checks and were restored under the prior launch authorization. Frontend wrapper PID 19824; API wrapper PID 13640. The proxied `/api/v1/health/ready` returned HTTP 200 with `status: ready`.
- Normal app: `http://127.0.0.1:5173/login`; preview: `http://127.0.0.1:5173/preview/login`.
- The owned UI review fixture (wrapper PID 19504) and its child processes were stopped after evidence collection. Normal app services remained healthy (proxied readiness HTTP 200) and the browser was returned to `/login`.
- Seven handoff blocks were appended at the end of the authorized Notion BACKEND page. Every returned block's plain text was checked against the submitted text.

## Follow-up: Title Case labels

The user requested “Company Overview” rather than “Company overview,” with the same treatment for sidebar labels and headings. Fixed page, section and stat headings plus navigation labels now use Title Case in live and preview. Examples: Company Overview, My Attendance, Leave Requests, Salary Slips and Company Settings.

Only authored UI copy changed. Descriptions, buttons, status values, user-written task/complaint titles, employee names and saved data retain their original casing. No blanket CSS or runtime capitalization is applied to records. Browser-title and connected-harness expectations were updated where applicable.

Validation: typecheck, all **187 tests in 16 files**, and production build pass. An initial test-only Node type import error was corrected by keeping filesystem-based assertions in the existing JavaScript test environment. The two known nonblocking Zod/Rollup warnings remain. Browser/screenshot and backend integration suites were not rerun for this copy-only follow-up.
