# 21. UI polish, Phase 1

**1 November 2026. Phase 1 only. Phases 2–4 have not started.**

## Changes

- Large stat/count numerals now use **Plus Jakarta Sans with proportional numerals**. Space Grotesk remains the heading font; both self-hosted font families and original logo assets are unchanged.
- Gold is reserved for primary actions and active navigation, apart from the authentic logo and existing semantic warning colours. Secondary links, eyebrows, chips, avatars and supporting surfaces are neutral.
- Shared text sizes, including mobile overrides, are at least **13px**. Muted and secondary dark-mode colours have higher contrast. Input borders have stronger contrast in both themes.
- Dark cards are separated from the ebony canvas by lighter surfaces, visible borders and a subtle inset top highlight. Clickable cards retain restrained, reduced-motion-aware hover lift.
- Removed the duplicate company box, sidebar monogram/filler, dashboard slogans and duplicate dashboard header date. One company-local dashboard date remains.
- The theme switch is icon-only, with an action-specific accessible label and matching tooltip.
- Added static, accessible skeletons for async page/resource loading. Decorative placeholders are hidden from assistive technology; a loading status remains announced.
- Existing successful clock-in/out notifications were retained, styled and verified, not duplicated. Disabled actions now use neutral surfaces rather than faded gold.

The first stat card's decorative gold border was neutralized as part of the global gold reduction. Card proportions and dashboard composition remain for Phase 2.

## Scope and data safety

No production backend file, API contract, permission, attendance policy or database record was changed for this phase. No UI dependency was added.

Screenshots show the actual `src/live` page components, with **synthetic in-memory API responses** provided by `apps/web/tests/polish-fixture.mjs` on loopback port 5187. It has no database connection, mailer or API proxy. It is not included in production imports/build inputs.

The QA task identified by the user, `QA_20261101 Task lifecycle <b>literal</b>`, was not modified or deleted. Its existence was supplied by the user, not independently checked against their database.

## Validation

- `npm run typecheck`: passed.
- `npm test`: **156 passed**, 11 test files.
- `npm run build`: passed. The two pre-existing nonblocking Zod/Rollup annotation warnings remain.
- 44 static colour-token combinations passed: ordinary text at least 4.5:1, input/focus boundaries at least 3:1. Lowest tested text-token ratio: **5.00:1**.
- Actual rendered text checks on both focused live pages found no sub-13px text or contrast failures in the tested states.
- **Eight axe-core 4.12.1 audits** across both pages, dark/light and desktop/mobile: zero violations and zero incomplete checks.
- Eight screenshots saved. The same-origin app frames had verified **1440×900** and **390×844 CSS pixel** viewports. PNGs retain the embedded browser's native device pixel density, rather than being resized.
- Computed stat styling confirmed **Plus Jakarta Sans / proportional-nums**, including fixtures whose values are `1`. One dashboard date and removed filler were verified.
- `/preview` CEO and employee mobile smoke checks passed. Preview data was confined to the isolated origin.
- Synthetic clock-in/out UI requests displayed the existing `role="status"` confirmation toasts, retained Present and ended in the disabled completed state.

Evidence lives in `docs/evidence/phase-1-*.json` and `phase-1-*.png`.

### Limits and deferred work

- At final handoff, the normal frontend was restarted and `/login` returned HTTP 200. The normal API on port 3000 was unavailable (`ECONNREFUSED`), so proxied API requests returned 500. No backend restart or configuration change was attempted in this UI-only phase. The screenshot fixture did not depend on that API.
- The first screenshot attempt was blocked by an unavailable browser target. After the user reopened the pane, all eight required captures and automated audits completed.
- Native keyboard dispatch was later blocked because the browser pane was hidden. Full keyboard, focus-return and screen-reader acceptance are **not claimed**. Native button semantics, labels and focus styles remain; relevant unit tests pass.
- Supplemental screenshots for empty/not-started states timed out after the pane became hidden. Their DOM states were checked, but those extra captures are not counted among the eight successful screenshots.
- This agent could not visually inspect the PNGs through the image viewer. Nonblank file checks and rendered geometry/font/contrast checks are not a substitute for human visual sign-off. The screenshots are provided for user review.
- Finite entrance animations were finished only inside synthetic review frames so settled layouts could be captured; animation playback was not re-certified.
- Existing large empty cards and dashboard composition remain for Phase 2.
- Existing attendance empty state above table headings, horizontal table scrolling on mobile, missing mobile breadcrumb page label, developer-style attendance copy, filters and monthly summary remain for Phase 3. No new summary fields were invented.
- Full CSS/token consolidation and proven-dead-rule removal remain for Phase 4. This phase only adjusted sizes in the older base stylesheet where needed.

## Review captures

| Page | Dark | Light |
| --- | --- | --- |
| CEO, 1440×900 | `phase-1-ceo-dark-desktop.png` | `phase-1-ceo-light-desktop.png` |
| Attendance, 1440×900 | `phase-1-employee-dark-desktop.png` | `phase-1-employee-light-desktop.png` |
| CEO, 390×844 | `phase-1-ceo-dark-mobile.png` | `phase-1-ceo-light-mobile.png` |
| Attendance, 390×844 | `phase-1-employee-dark-mobile.png` | `phase-1-employee-light-mobile.png` |

All paths above are under `docs/evidence/`. Stop for user review before Phase 2.
