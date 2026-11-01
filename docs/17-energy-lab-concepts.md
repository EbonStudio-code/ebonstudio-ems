# 17. Energy Lab: animated design exploration

**1 November 2026.** The user rejected the restrained office-dashboard direction and asked for something electric, cool and animated. No final EMS design has been selected.

## Live concepts

Open `http://127.0.0.1:5173/concepts/energy/index.html` while the normal Vite development server is running.

- `#gold`: **Electric Gold**, kinetic circular rings, warm amber energy, left navigation.
- `#aurora`: **Aurora Glass**, pastel cyan/violet light, glass panels, tilted orbital motion, horizontal navigation.
- `#neon`: **Neon Grid**, lime/cyan highlights, geometric orbital forms, compact icon rail, sharper typography.

The original Ebon logo assets remain unchanged. These are original coded concepts, not imported Figma frames or copies of Mobbin screenshots.

The standalone files are in `apps/web/concepts/energy/`. They are not imported by the React application, placed in the production public directory, or added to the build inputs. Existing EMS routes, styles, dependencies, API and records were not changed.

## Interactions and boundaries

- Concept switching, entrance replay, hover responses and continuous decorative motion.
- Sample task completion and check-in, both reversible and memory-only.
- Sample overview/tasks/crew navigation.
- Native focus-preview dialog with Escape dismissal and focus return.
- Pause control and automatic `prefers-reduced-motion` support.
- Decorative animations pause when the document is hidden.

All people and metrics are fictional and labelled. Focus mode is a visual preview, not a timer. There are no application API requests, external fonts, application-storage access, attendance writes or saved edits. Vite's normal development client is still present.

## Checks

- JavaScript syntax checks passed for `energy.js` and `checks.browser.js`.
- **207 browser assertions passed**, with no failures, across three concepts at 360px, 768px and 1440px.
- Covered loaded assets, page/headline/card geometry, animation progress, pause/replay, task counters, sample attendance, dialog geometry/focus, navigation, skip-link preservation and resource/API boundaries.
- Native reduced-motion emulation confirmed zero running animations, disabled replay and the correct system-preference notice. The original dark/no-reduction browser preference was restored.
- Axe 4.12.1 reported **zero violations for each concept**, with one incomplete contrast rule per concept. Gradient backgrounds/text and a partially overlapping footer require visual/manual contrast review. This is not full accessibility acceptance.
- Native keyboard, assistive-technology and physical-device acceptance remain outside this exploratory pass. Existing EMS unit/integration suites were not rerun because their application code did not change.

Reports: `docs/evidence/energy-lab-layout-2026-11-01.json` and `docs/evidence/energy-lab-accessibility-2026-11-01.json`.

Screenshot: `docs/evidence/energy-lab-aurora-2026-11-01.png`. The live page, not a still image, demonstrates the motion.

To rerun the scoped browser checks from the local concept page:

```js
import('/concepts/energy/checks.browser.js')
  .then(module => module.runEnergyChecks());
```

The harness refuses non-loopback hosts and any path other than this concept page.
