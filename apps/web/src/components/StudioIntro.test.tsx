import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import StudioIntro from './StudioIntro';
import { Stat } from './ui';

describe('studio presentation', () => {
  it('preserves the primary heading, actions and real metadata', () => {
    const html = renderToStaticMarkup(<MemoryRouter><StudioIntro title="Company Overview" description="Today at the studio"
      actions={<button>View team</button>} meta={<time dateTime="2026-11-01">1 November</time>} /></MemoryRouter>);
    expect(html).toContain('<h1>Company Overview</h1>');
    expect(html).toContain('<p>Today at the studio</p>');
    expect(html).toContain('View team');
    expect(html).toContain('dateTime="2026-11-01"');
    expect(html).not.toContain('stat-value');
    expect(html).not.toContain('YOUR PEOPLE. YOUR MOMENTUM.');
    expect(html).not.toContain('EBON / WORKSPACE');
  });
  it('does not invent metadata or figures while data loads', () => {
    const html = renderToStaticMarkup(<MemoryRouter><StudioIntro title="My Overview" description="Loading your workspace" /></MemoryRouter>);
    expect(html).not.toContain('studio-intro-meta');
    expect(html).not.toContain('stat-value');
  });
  it('keeps real values intact and distinguishes long text for responsive sizing', () => {
    const numeric = renderToStaticMarkup(<Stat title="People" value={0} caption="Active" icon={null} />);
    const text = renderToStaticMarkup(<Stat title="Attendance" value="Needs review" caption="Earlier check-in" icon={null} />);
    expect(numeric).toContain('data-numeric="true">0</strong>');
    expect(text).toContain('data-numeric="false">Needs review</strong>');
  });
});
