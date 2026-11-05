import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { modules } from '../core/modules';
import { Card, PageHeader } from './ui';

describe('heading and navigation copy', () => {
  it('uses Title Case for preview sidebar labels', () => {
    expect(modules.filter(m => m.title.includes(' ')).map(m => m.title)).toEqual([
      'My Profile', 'Leave Requests', 'Salary Slips', 'Company Settings', 'Audit History', 'Account Security',
    ]);
    expect(modules.flatMap(m => m.employeeTitle ? [m.employeeTitle] : [])).toEqual([
      'My Attendance', 'My Leave', 'My Tasks', 'My Complaints',
    ]);
    expect(modules.find(m => m.id === 'salary-slips')?.title).toBe('Salary Slips');
  });
  it('preserves user-written names and description casing instead of transforming all text', () => {
    const title = 'iOS and API v2: review eBay';
    const html = renderToStaticMarkup(<><PageHeader title={title} description="Keep this sentence as written." />
      <Card title={title}><p>Saved record content.</p></Card></>);
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain(`<h2>${title}</h2>`);
    expect(html).toContain('<p>Keep this sentence as written.</p>');
  });
});
