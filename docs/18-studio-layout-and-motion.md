# 18. Ebon Studio layout and content-motion redesign

**1 November 2026.** User instruction: keep the existing black, gold and white colour choice and original Ebon identity; change the rest of the interface design. This supersedes the coloured Energy Lab directions as the requested application treatment.

## Implemented in the actual EMS and fictional preview

- A docked, inset ebony sidebar with rounded corners, quieter grouping and a revised studio footer.
- Larger editorial page headings, more deliberate spacing and a shared `StudioIntro` for both dashboards.
- An overview/date/action header followed by larger real summary figures and clearly separated detail sections.
- Reworked cards, table density, form surfaces, pill-shaped primary/secondary actions and account grouping.
- A new sign-in composition: the original logo, "Good people. Great things.", and descriptive People / Time / Work cards that assemble into place. These cards contain no pretend live metrics.
- Short, coordinated heading/card entrances, focused hover responses and dialog reveals. The animation is finite and does not gate interaction, alter live counts or run continuously.
- Responsive rules for the sidebar, dashboard, long numeric/text summaries and compact mobile sign-in.
- Reduced-motion and print rules disable animation; hover transforms are restricted to pointing devices that support hover.

## Preserved

The original foundations remain: ebony `#0E0E10`, gold `#C9A227`, white `#FFFFFF`, warm ivory `#F5F3EF`. Existing readable gold variants and dark/light theme tokens remain. Semantic status/error colours were retained for meaning; decorative avatar colours now use brand/neutral tones instead of introducing a new colourful palette.

The original SVG assets, actual company settings, private records, permissions, module filtering, routes, authentication, API contracts and business actions were not changed. No backend, application dependency, external font or deployment change was made.

The Harvey reference informed the *idea* of coordinated content reveals, not a pixel copy or an imported implementation. Its original scroll trigger and timing were not verified. The separate Energy Lab stays an exploratory development page and is not the main application.

## Validation

| Check | Outcome |
| --- | --- |
| Final `npm run test` | **112 passed**, 8 files |
| Final `npm run build` | TypeScript and Vite passed |
| Connected browser journey suite | **31 assertions passed**, isolated synthetic database only |
| Style-source regressions | Original palette, finite/preference-scoped entrances, print/reduced-motion rules checked |
| Responsive/contrast suite | **Incomplete**, browser infrastructure stalled before a result could be collected |
| Final preview browser suite and axe audit | **Not completed**, same browser-target limitation |
| Full visual/keyboard/screen-reader acceptance | Not claimed |

The connected journey evidence is `docs/evidence/studio-connected-2026-11-01.json`. Do not reuse the earlier Ebon/energy-lab layout or accessibility pass counts as results for this redesign.

The responsive harness now waits for finite entrance animations with a timeout and checks palette preservation, unclipped headings/figures and post-entrance visibility in addition to its existing checks.

### Resolved and unresolved validation issues

- A new stylesheet test initially used Node filesystem types inside the frontend TS build; another attempt used a CSS raw import which Vitest stubbed. It now lives as a standalone JavaScript test in `apps/web/tests/studio-styles.test.js`, reads the stylesheet directly, and passes without adding application dependencies or changing build settings.
- The two existing nonblocking Zod PURE-annotation build warnings remain.
- Browser diagnostics passed basic health checks, but evaluation began returning a different local origin or an empty `null` origin after successful navigation acknowledgements. Restarting only this session's agent-browser daemon did not reliably restore the embedded target. No alternative headless browser was launched.
- Normal motion preference was requested again and navigation back to the normal login URL was acknowledged. The final pane contents could not be confirmed, so the user should open the URL directly.

## Review locally

- Actual EMS: `http://127.0.0.1:5173/login`
- Fictional demo: `http://127.0.0.1:5173/preview/login`

Remaining acceptance work: rerun `qa-regressions.browser.js` and the enhanced `ebon-brand.browser.js` on isolated origins after the embedded browser target is healthy; inspect both themes at 360/900/1440px, contrast, keyboard navigation and system-reduced motion.
