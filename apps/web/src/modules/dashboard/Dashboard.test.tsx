import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { createDemoData } from '../../core/seed';
import { scopedData } from '../../core/domain';
import type { DemoData } from '../../core/models';

const state = vi.hoisted(() => ({ceo:true, data:null as unknown as DemoData}));
vi.mock('../../core/store', () => ({
  useWorkspace: () => {
    const session = {role:state.ceo ? 'CEO' as const : 'Employee' as const,employeeId:'emp-1'};
    return {data:scopedData(state.data,session),ceo:state.ceo,base:state.ceo?'/ceo':'/employee',session,
      person:state.data.employees[0],perform:vi.fn()};
  },
}));
const render = () => renderToStaticMarkup(<MemoryRouter><Dashboard /></MemoryRouter>);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
  state.ceo = true; state.data = createDemoData();
});
afterEach(() => vi.useRealTimers());

describe('preview dashboard refinement', () => {
  it('shows approvals before overdue work and does not duplicate them as stat cards', () => {
    const html = render();
    expect(html.indexOf('Leave Approvals')).toBeLessThan(html.indexOf('Work in Focus'));
    expect(html).not.toContain('Pending Leave');
    expect(html).not.toContain('progress-track');
  });
  it('preserves scoped employee work and user-written text', () => {
    state.ceo = false;
    state.data.tasks[0].title = 'iOS and API v2: review eBay';
    const html = render();
    expect(html).toContain('iOS and API v2: review eBay');
    expect(html).not.toContain(state.data.tasks[2].title);
    expect(html).not.toContain('Leave Approvals');
    expect(html).not.toContain('stat-card');
    expect(html.indexOf('Clock in</button>')).toBeLessThan(html.indexOf('Your Next Tasks'));
  });
  it('does not label already approved leave as an approval task', () => {
    state.data.leaves = state.data.leaves.filter(leave => leave.status === 'Approved');
    const html = render();
    expect(html).toContain('Time Off &amp; Requests');
    expect(html).not.toContain('Leave Approvals');
    expect(html).not.toContain('Awaiting your approval');
  });
  it('groups empty modules without inventing activity or cards', () => {
    state.data.tasks=[];state.data.leaves=[];state.data.holidays=[];state.data.complaints=[];
    const html = render();
    expect(html).toContain('dashboard-quiet');
    expect(html).toContain('No upcoming holidays.');
    expect(html).not.toContain('dashboard-attention');
    expect(html).not.toContain('0 overdue');
    expect(html).not.toContain('class="empty"');
  });
});
