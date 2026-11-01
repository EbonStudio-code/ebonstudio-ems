import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ThemeToggle from './ThemeToggle';
import { LoadingSkeleton, Table } from './ui';

const state = vi.hoisted(() => ({theme:'dark',toggleTheme:vi.fn()}));
vi.mock('../core/ThemeProvider', () => ({useTheme:() => state}));

describe('global polish accessibility', () => {
  it('makes scrollable tables keyboard-focusable with a descriptive region name',()=>{
    const html=renderToStaticMarkup(<Table headings={['Employee','Clock in']}><tr><td>Sample</td><td>09:00</td></tr></Table>);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Employee, Clock in table"');
  });
  it.each(['dark','light'])('gives the icon-only %s theme control an action label and tooltip', theme => {
    state.theme = theme;
    const html = renderToStaticMarkup(<ThemeToggle />);
    const target = theme === 'dark' ? 'light' : 'dark';
    expect(html).toContain(`aria-label="Switch to ${target} theme"`);
    expect(html).toContain(`title="Switch to ${target} theme"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<span');
    expect(html).not.toContain('>Light<');
    expect(html).not.toContain('>Dark<');
  });
  it.each(['rows','dashboard'] as const)('announces %s skeleton loading without fake values or focusable actions', layout => {
    const html = renderToStaticMarkup(<LoadingSkeleton layout={layout} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading records…');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('stat-value');
    expect(html.match(/class="skeleton-block"/g)).toHaveLength(layout === 'dashboard' ? 4 : 3);
  });
});
