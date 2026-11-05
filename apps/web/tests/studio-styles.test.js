import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const fonts = readFileSync(new URL('../src/fonts.css', import.meta.url), 'utf8');
const document = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('studio style invariants', () => {
  it('preserves the original light and dark brand foundations', () => {
    const light = css.match(/:root \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const dark = css.match(/:root\[data-theme='dark'\] \{([^}]+)\}/)?.[1] ?? '';
    expect(light).toContain('--canvas: #f5f3ef;');
    expect(light).toContain('--surface: #ffffff;');
    expect(light).toContain('--gold: #c9a227;');
    expect(dark).toContain('--canvas: #0e0e10;');
    expect(dark).toContain('--text: #f5f3ef;');
    expect(dark).not.toContain('--gold:');
  });
  it('uses finite, preference-scoped entrances rather than perpetual motion', () => {
    expect(css).toContain('@media screen and (prefers-reduced-motion: no-preference)');
    expect(css).toContain('animation: studio-assemble .75s var(--studio-ease) .15s backwards;');
    expect(css).not.toMatch(/animation[^;{}]*\binfinite\b/);
    expect(css).not.toMatch(/animation:[^;{}]*\b(forwards|both)\b/);
  });
  it('disables motion for accessibility and print without hiding content', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none !important; transition: none !important;/);
    expect(css).toMatch(/@media print \{[\s\S]*?animation: none !important; transition: none !important;/);
    expect(css).not.toMatch(/\.studio-dashboard\s*\{[^}]*opacity:\s*0/);
    expect(css).not.toContain('visibility: hidden');
  });
  it('loads real local variable fonts without third-party runtime requests', () => {
    expect(fonts.match(/@font-face/g)).toHaveLength(4);
    expect(fonts).toContain("font-family: 'Space Grotesk'");
    expect(fonts).toContain("font-family: 'Plus Jakarta Sans'");
    expect(fonts).toContain('font-weight: 400 700;');
    expect(fonts).toContain('font-weight: 400 800;');
    expect(fonts.match(/font-display: swap/g)).toHaveLength(4);
    expect(fonts).not.toMatch(/https?:|@import/);
    const assets = [...fonts.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map(match => match[1]);
    expect(new Set(assets).size).toBe(4);
    for (const asset of assets) {
      const buffer = readFileSync(new URL(`../public/fonts/${asset}`, import.meta.url));
      expect(buffer.subarray(0, 4).toString()).toBe('wOF2');
      expect(buffer.readUInt32BE(8)).toBe(buffer.length);
      expect(buffer.length).toBeLessThan(35000);
    }
  });
  it('preloads only the core subsets and retains redistribution notices', () => {
    for (const family of ['space-grotesk', 'plus-jakarta-sans']) {
      expect(document).toContain(`href="/fonts/${family}-latin.woff2" as="font" type="font/woff2" crossorigin`);
      expect(document).not.toContain(`href="/fonts/${family}-latin-ext.woff2"`);
    }
    for (const family of ['Space-Grotesk', 'Plus-Jakarta-Sans']) {
      const license = readFileSync(new URL(`../public/fonts/OFL-${family}.txt`, import.meta.url), 'utf8');
      expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
      expect(license).toContain('Project Authors');
    }
  });
  it('gives headings and body text separate families and keeps prominent text strong', () => {
    expect(css).toContain("--font-body: 'Plus Jakarta Sans'");
    expect(css).toContain("--font-display: 'Space Grotesk'");
    expect(css).toMatch(/body \{[^}]*font-family: var\(--font-body\)/);
    expect(css).toMatch(/h1, h2, h3 \{[^}]*font-family: var\(--font-display\); font-weight: 700/);
    expect(css).toMatch(/\.studio-intro h1 \{[^}]*font-weight: 700/);
    expect(css).toMatch(/\.auth-card > h1 \{[^}]*font-weight: 700/);
  });
  it('uses clean body-family numerals at large sizes', () => {
    for (const selector of ['.stat-value', '.attendance-month dd', '.leave-overview > strong']) {
      const rule = css.slice(css.indexOf(selector+' {')).split('}')[0];
      expect(rule).toContain('font-family: var(--font-body)');
      expect(rule).toContain('font-variant-numeric: proportional-nums');
    }
  });
  it('keeps shared UI text at least 13px, including small-screen overrides', () => {
    const sizes = [...css.matchAll(/(?:font-size|--text-[\w-]+):\s*(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
  });
  it('reserves decorative gold for primary actions and active navigation', () => {
    expect(css).toMatch(/\.text-link \{[^}]*color: var\(--text\)/);
    expect(css).toMatch(/\.eyebrow \{[^}]*color: var\(--muted\)/);
    expect(css).toMatch(/\.stat-icon \{[^}]*background: var\(--surface-subtle\)/);
    expect(css).not.toContain('border-top: 3px solid var(--gold)');
    expect(css).toContain('inset 0 1px 0 #ffffff08');
  });
  it('uses one shared token stylesheet without the legacy green/Inter layer',()=>{
    const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
    expect(main).not.toContain("import './themes.css'");
    expect(css).not.toMatch(/Inter|#245c50|#194b40|#f5f7f8/);
    for(const token of ['--space-sm','--space-xl','--radius-input','--shadow','--font-body','--text-xs']) {
      expect(css).toContain(token+':');
      expect(css).toContain('var('+token+')');
    }
  });
  it('does not retain rules for the confirmed unused live/preview components',()=>{
    for(const name of ['workspace-label','workspace-initial','sidebar-monogram','studio-intro-topline','studio-edition','theme-toggle-label','brand-mark','auth-features','attendance-banner']) {
      expect(css).not.toMatch(new RegExp('\\.'+name+'(?![\\w-])'));
    }
  });
  it('keeps mobile attendance as cards and preserves the current breadcrumb',()=>{
    expect(css).toContain('.attendance-desktop { display: none; }');
    expect(css).toContain('.attendance-days { display: grid;');
    expect(css).toContain('.breadcrumb > strong { display: inline; }');
    expect(css).toContain('.button.primary:hover:not(:disabled)');
    expect(css).not.toContain('.button.primary:hover {');
  });
  it('uses larger touch targets without scaling up icons or shrinking copy', () => {
    expect(css).toContain('--touch-target: 44px;');
    expect(css).toContain('@media (max-width: 950px), (pointer: coarse)');
    expect(css).toContain('min-width: var(--touch-target); min-height: var(--touch-target);');
    expect(css).not.toMatch(/\.nav-label\s*\{[^}]*text-transform/);
    for (const removed of ['progress-summary','progress-track','progress-legend','attendance-totals','dashboard-section-heading','workday-label']) {
      expect(css).not.toContain('.'+removed);
    }
  });
});
