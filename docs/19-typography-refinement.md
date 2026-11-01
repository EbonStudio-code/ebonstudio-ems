# 19. Ebon Studio typography refinement

**1 November 2026.** User feedback: the text and fonts looked dull.

## Changed

- Added actual self-hosted **Space Grotesk** variable fonts for headings, section titles and summary figures.
- Added actual self-hosted **Plus Jakarta Sans** variable fonts for body copy, navigation, controls and tables.
- Replaced the previous unbundled Inter/Aptos/system-font stack with explicit heading/body tokens.
- Strengthened headings and figures to weight 700; improved label/action weights, supporting-text sizes and table headings.
- Moved important descriptions and field labels to the existing higher-contrast text tokens. Black, gold, white/ivory, logo artwork and semantic status colours did not change.
- Preserved the responsive layout, finite motion, reduced-motion rules, actions, API contracts and user data.

The old CSS named Inter/Aptos, but the project had no font files or font-face declarations. Its appearance depended on the fonts installed on the device. The new families are now actually bundled and decoded by the browser.

## Assets and privacy

`apps/web/src/fonts.css` defines four local WOFF2 subsets. Two core Latin fonts are preloaded; extended Latin is lazy-loaded by character range. System fallbacks remain for other scripts.

Total shipped font bytes: **90,304**. The two core Latin subsets total **49,636 bytes**. `font-display: swap` keeps content readable while they load.

The fonts are unmodified Google Fonts distribution files under SIL OFL 1.1. Their copyright notices, licenses and source URLs are in `apps/web/public/fonts/`. Font rendering makes no third-party requests. No runtime package dependency was added.

## Verification

- **115 tests passed**, including local-font declarations, WOFF2 signatures/lengths, preloads, notices, type weights, palette and motion invariants.
- TypeScript and production build passed. The two existing nonblocking Zod annotation warnings remain.
- All four built font files match their source files byte-for-byte. SHA-256 hashes and selected text-palette contrast calculations are in `docs/evidence/typography-2026-11-01.json`.
- On the isolated preview origin, the browser confirmed both core fonts decoded, body family Plus Jakarta Sans, H1 family Space Grotesk at weight 700, and no page overflow at the pane's **305px** width.
- The broader preview regression/layout run could not start reliably afterward: the embedded browser changed targets, the guarded origin check failed, and later main-frame reset returned an unsupported target-creation error. No test ran against the normal workspace and no alternative headless browser was launched.
- Therefore full responsive coverage, new screenshots, axe and native keyboard/screen-reader acceptance are **not claimed** for this pass. The computed token contrast checks are not a rendered-page accessibility audit.
- Backend journeys were not rerun for this typography-only change.

The enhanced `ebon-brand.browser.js` now also waits for font readiness and checks decoded files, computed families and heading weight. It remains restricted to the synthetic browser-test origins.

## Local review

Open `http://127.0.0.1:5173/login`, or `http://127.0.0.1:5173/preview/login` for fictional records. The normal frontend was not running at the start of verification and was restarted; the normal API was left untouched.
