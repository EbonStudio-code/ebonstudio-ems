# 16. Ebon Studio EMS branding

**1 November 2026.** This workspace is Ebon Studio's internal employee management system, not the separate school software discussed previously.

## Implemented

- Copied six original, hash-verified SVG/PNG assets from the supplied `D:\DELL T7810\Ebon Studio Logo` folder into `apps/web/public/brand`. Source artwork was not edited.
- Replaced frontend Teamspace branding with Ebon Studio, including browser titles, favicons and the touch icon.
- Added shared `Brand` and `AuthStory` components. Connected and fictional-preview authentication screens use the same identity, with distinct access/demo notices.
- Reworked `themes.css` around ebony `#0E0E10`, gold `#C9A227` and ivory `#F5F3EF`. Light surfaces use darker gold for readable links; primary gold buttons use dark text.
- Added an ebony navigation rail, icon-based grouped navigation, clearer account/header treatment, consistent spacing, responsive cards/tables/forms/dialogs and a matching dark theme.
- Redesigned the connected dashboard using only existing API summaries. Counts, tasks, attendance, requests, holidays and salary links remain permission-scoped. Disabled modules do not display invented figures. Earlier open attendance is flagged for review.
- Improved the connected employee directory's presentation without changing its filters, pagination or mutations.
- Gave authentication pages a visible primary heading and a named brand landmark, including mobile layouts.

## Verification

| Check | Result |
| --- | --- |
| `npm run test` | 105 passed, including new branding/dashboard regressions |
| `npm run typecheck` | Passed; also included in the final build |
| `npm run build` | Passed; two existing nonblocking Zod annotation warnings remain |
| Existing preview browser suite | 50 assertions passed |
| Existing connected browser suite | 31 assertions passed against an isolated synthetic PostgreSQL fixture |
| Branded layout suite | 424 connected + 424 preview assertions passed |
| Login axe audit, light and dark | Zero violations and zero incomplete checks in each |

Browser evidence is in `docs/evidence/ebon-*-2026-11-01.json`. A login screenshot is saved as `docs/evidence/ebon-login-2026-11-01.png`.

`apps/web/tests/ebon-brand.browser.js` checks both roles, branding/assets, titles, theme persistence, mobile navigation, page overflow and representative text contrast. It exercises module pages at 1440px/light and 360px/dark, with additional dashboard and login width/theme combinations including 900px. It refuses the normal workspace origin.

The desktop browser owns its viewport and rejects viewport emulation. Responsive checks therefore use actual 360px, 900px and 1440px iframes in that browser. This is DOM/geometry/contrast evidence, not pixel-perfect visual approval, a full accessibility certification or a native keyboard/screen-reader acceptance test.

An initial preview run was interrupted by competing Vite dependency caches. The test servers were restarted with separate `tmp/vite-ebon-preview` and `tmp/vite-ebon-connected` caches, then the suites passed. Early logo checks were made before image decode; the harness now waits for decoding. Two login landmark/heading audit findings were fixed before the final clean audit.

## Scope and safety

No normal database records, company settings, credentials, permissions or backend modules were changed. Existing demo storage keys were retained. Tests used ports 5184/5186 and the isolated browser fixture, not the user's normal API/database. The synthetic fixture and temporary test frontends were stopped after verification.

No new application dependency, external font, tracking request, email delivery, paid service or deployment was added. Existing production-readiness requirements remain unchanged. Stored company/legal names and historical salary snapshots are deliberately not overwritten by frontend branding.

Normal local entry: `http://127.0.0.1:5173/login`. Fictional preview: `http://127.0.0.1:5173/preview/login`.
