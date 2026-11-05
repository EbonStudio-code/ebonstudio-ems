import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardSections from './DashboardSections';

describe('dashboard sections', () => {
  it('orders actionable content without changing the supplied sections', () => {
    const sections = [
      {id:'task', content:<h2>Tasks</h2>},
      {id:'quiet', content:<h2>Quiet</h2>, quiet:true},
      {id:'leave', content:<h2>Approvals</h2>, priority:3},
      {id:'attendance', content:<h2>Corrections</h2>, priority:1},
    ];
    const html = renderToStaticMarkup(<DashboardSections sections={sections} />);
    expect(html.indexOf('Approvals')).toBeLessThan(html.indexOf('Corrections'));
    expect(html.indexOf('Corrections')).toBeLessThan(html.indexOf('Tasks'));
    expect(html.indexOf('Tasks')).toBeLessThan(html.indexOf('Quiet'));
    expect(sections.map(s => s.id)).toEqual(['task','quiet','leave','attendance']);
  });
  it('does not add an empty panel grid or quiet section', () => {
    expect(renderToStaticMarkup(<DashboardSections sections={[]} />)).toBe('');
    const html = renderToStaticMarkup(<DashboardSections sections={[{id:'quiet',content:'No requests',quiet:true}]} />);
    expect(html).not.toContain('dashboard-panels');
    expect(html).toContain('dashboard-quiet');
  });
});
