import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Brand from './Brand';
import AuthStory from './AuthStory';

describe('Ebon Studio identity', () => {
  it('uses the original local wordmark with an accessible name and stable dimensions', () => {
    const html = renderToStaticMarkup(<Brand />);
    expect(html).toContain('src="/brand/ebon-studio-logo.svg"');
    expect(html).toContain('alt="Ebon Studio"');
    expect(html).toContain('width="477" height="166"');
  });
  it('uses the supplied reversed asset on ebony surfaces', () => {
    expect(renderToStaticMarkup(<Brand reversed />)).toContain('/brand/ebon-studio-logo-reversed.svg');
  });
  it('distinguishes the internal EMS from a fictional preview', () => {
    const render = (preview: boolean) => renderToStaticMarkup(<MemoryRouter><AuthStory preview={preview} /></MemoryRouter>);
    expect(render(false)).toContain('Internal workspace');
    expect(render(false)).toContain('invited team members only');
    expect(render(true)).toContain('Fictional demo');
    expect(render(true)).not.toContain('Teamspace');
  });
  it('presents descriptive feature cards without pretending to show live records', () => {
    const html = renderToStaticMarkup(<MemoryRouter><AuthStory /></MemoryRouter>);
    expect(html).toContain('Good People.');
    expect(html).toContain('Great Things.');
    expect(html).toContain('01 / PEOPLE');
    expect(html).toContain('02 / TIME');
    expect(html).toContain('03 / WORK');
    expect(html).not.toContain('stat-value');
    expect(html).not.toContain('Crew online');
  });
});
