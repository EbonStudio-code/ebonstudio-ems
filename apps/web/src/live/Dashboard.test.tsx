import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { CurrentAttendance } from './types';

const state = vi.hoisted(() => ({
  ceo: true,
  summary: {} as Record<string, unknown>,
  loading: false,
  current: {nextAction:'CHECK_IN',openRecord:null,todayRecord:null} as CurrentAttendance,
}));
vi.mock('./state', () => ({
  useSession: () => ({
    ceo: state.ceo, base: state.ceo ? '/ceo' : '/employee',
    session: { displayName: 'Example Person', enabledModules: Object.keys(state.summary) },
    company: {timezone:'Asia/Kolkata'},
    refresh: vi.fn(),
  }),
  useResource: (path: string) => ({ result: state.loading ? null : { data: path === '/attendance/me/current' ? state.current : state.summary }, loading: state.loading }),
}));
const render = () => renderToStaticMarkup(<MemoryRouter><Dashboard /></MemoryRouter>);
beforeEach(() => {
  state.ceo = true;
  state.loading = false;
  state.summary = {date:'2026-11-02',timezone:'Asia/Kolkata',workingDay:true};
  state.current = {nextAction:'CHECK_IN',openRecord:null,todayRecord:null};
});

describe('branded connected dashboard', () => {
  it('renders real summary counts, including zero, without invented trends', () => {
    state.summary.employees = {activeCount:0};
    state.summary.tasks = {unfinished:7,overdue:2,work:[]};
    const html = render();
    expect(html).toContain('<h1>Company Overview</h1>');
    expect(html).toContain('>0</strong>');
    expect(html).toContain('>7</strong>');
    expect(html).toContain('2 overdue');
    expect(html).toContain('href="/ceo/employees"');
  });
  it('leaves disabled modules out instead of displaying fake zero counts', () => {
    const html = render();
    expect(html).not.toContain('href="/ceo/tasks"');
    expect(html).not.toContain('href="/ceo/attendance"');
    expect(html).not.toContain('href="/ceo/leave"');
  });
  it('preserves employee-only links and attendance states', () => {
    state.ceo = false;
    state.summary.attendance = [{state:'CLOSED',workDate:'2026-11-02'}];
    state.summary.tasks = {unfinished:1,overdue:0,work:[{id:'task-1',title:'Review a draft',state:'TODO',dueDate:null}]};
    const html = render();
    expect(html).toContain('<h1>My Overview</h1>');
    expect(html).toContain('Present</strong>');
    expect(html).toContain('href="/employee/tasks/task-1"');
    expect(html).not.toContain('href="/ceo/');
    expect(html).not.toContain('Employee directory');
  });
  it('does not imply absence on a non-working day', () => {
    state.summary.workingDay = false;
    state.summary.attendance = {checkedIn:0,currentlyOpen:0,staleOpen:0,notCheckedIn:2,notCheckedInEmployees:[{id:'emp-1',fullName:'Example Person'}]};
    const html = render();
    expect(html).toContain('No absence classification.');
    expect(html).not.toContain('No check-in recorded today');
  });
  it('flags an earlier open check-in rather than implying today is complete', () => {
    state.ceo = false;
    state.summary.attendance = [{state:'OPEN',workDate:'2026-10-31'}];
    const html = render();
    expect(html).toContain('Needs review');
    expect(html).toContain('An earlier check-in is still open');
    expect(html).not.toContain('Attendance complete');
  });
  it('puts an employee clock-in action before the summary figures', () => {
    state.ceo = false;
    state.summary.attendance = [];
    const html = render();
    expect(html).toContain('>Clock in</button>');
    expect(html).toContain('href="/employee/attendance"');
    expect(html.indexOf('attendance-clock')).toBeLessThan(html.indexOf('stats-grid'));
  });
  it('does not offer clock-in to the CEO or when attendance is disabled', () => {
    expect(render()).not.toContain('attendance-clock');
    state.ceo = false;
    expect(render()).not.toContain('attendance-clock');
  });
  it('escapes task and holiday content', () => {
    state.summary.tasks = {unfinished:1,overdue:0,work:[{id:'task-1',title:'<script>unsafe()</script>',state:'TODO',dueDate:'2026-11-03'}]};
    const html = render();
    expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
    expect(html).not.toContain('<script>unsafe()');
  });
  it('keeps loading state visible without placeholder figures', () => {
    state.loading = true;
    const html = render();
    expect(html).toContain('Loading records');
    expect(html).not.toContain('stat-value');
  });
  it('shows actual attendance context and a bounded progress indicator', () => {
    state.summary.employees = {activeCount:1};
    state.summary.attendance = {checkedIn:1,currentlyOpen:1,staleOpen:0,notCheckedIn:0,notCheckedInEmployees:[]};
    const html = render();
    expect(html).toContain('1 of 1 present');
    expect(html).toContain('width:100%');
  });
  it('uses compact linked empty sections instead of large empty cards', () => {
    state.summary.holidays = [];
    state.summary.salarySlips = {drafts:0,published:0,latestPublished:null};
    const html = render();
    expect(html).toContain('compact-state');
    expect(html).toContain('No upcoming holidays.');
    expect(html).toContain('href="/ceo/holidays"');
    expect(html).not.toContain('class="empty"');
  });
});
