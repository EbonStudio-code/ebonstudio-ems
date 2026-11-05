import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { CurrentAttendance } from './types';

const state = vi.hoisted(() => ({
  ceo: true,
  summary: {} as Record<string, unknown>,
  loading: false,
  error: null as unknown,
  current: {nextAction:'CHECK_IN',openRecord:null,todayRecord:null} as CurrentAttendance,
}));
vi.mock('./state', () => ({
  useSession: () => ({
    ceo: state.ceo, base: state.ceo ? '/ceo' : '/employee',
    session: { displayName: 'Example Person', enabledModules: Object.keys(state.summary) },
    company: {timezone:'Asia/Kolkata'},
    refresh: vi.fn(),
  }),
  useResource: (path: string) => ({ result: state.loading || state.error ? null : { data: path === '/attendance/me/current' ? state.current : state.summary }, loading: state.loading, error:state.error }),
}));
const render = () => renderToStaticMarkup(<MemoryRouter><Dashboard /></MemoryRouter>);
beforeEach(() => {
  state.ceo = true;
  state.loading = false;
  state.error = null;
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
    state.current = {nextAction:'COMPLETE',openRecord:null,todayRecord:{workDate:'2026-11-02',checkInAt:'2026-11-02T03:30:00Z',checkOutAt:'2026-11-02T11:30:00Z'}} as CurrentAttendance;
    state.summary.tasks = {unfinished:1,overdue:0,work:[{id:'task-1',title:'Review a draft',state:'TODO',dueDate:null}]};
    const html = render();
    expect(html).toContain('<h1>My Overview</h1>');
    expect(html).toContain('Present</span>');
    expect(html).not.toContain('Attendance Today');
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
    state.current = {nextAction:'CEO_CORRECTION_REQUIRED',todayRecord:null,openRecord:{workDate:'2026-10-31',checkInAt:'2026-10-31T03:30:00Z',checkOutAt:null}} as CurrentAttendance;
    const html = render();
    expect(html).toContain('An Earlier Workday Needs Attention');
    expect(html).toContain('Ask the CEO to correct it');
    expect(html).not.toContain('Attendance complete');
  });
  it('puts an employee clock-in action before tasks without duplicate summary cards', () => {
    state.ceo = false;
    state.summary.attendance = [];
    state.summary.tasks = {unfinished:1,overdue:0,work:[{id:'task-1',title:'Review a draft',state:'TODO',dueDate:null}]};
    const html = render();
    expect(html).toContain('>Clock in</button>');
    expect(html).toContain('href="/employee/attendance"');
    expect(html.indexOf('attendance-clock')).toBeLessThan(html.indexOf('Your Next Tasks'));
    expect(html).not.toContain('stat-card');
    expect(html).not.toContain('attendance-live-time');
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
    expect(html).toContain('dashboard-quiet');
    expect(html).toContain('Salary Slips');
    expect(html).not.toContain('Salary Statements');
  });
  it('orders approval, overdue and correction sections ahead of routine work in the DOM', () => {
    state.summary.tasks = {unfinished:7,overdue:2,work:[]};
    state.summary.attendance = {checkedIn:1,currentlyOpen:2,staleOpen:1,notCheckedIn:0,notCheckedInEmployees:[]};
    state.summary.leave = {pending:3,approvedToday:0,upcoming:[],nextApproved:null};
    const html = render();
    expect(html.indexOf('Leave Approvals')).toBeLessThan(html.indexOf('Work in Focus'));
    expect(html.indexOf('Work in Focus')).toBeLessThan(html.indexOf('Attendance Corrections'));
    expect(html).toContain('Awaiting your approval');
    expect(html).not.toContain('No unfinished tasks.');
    expect(html).not.toContain('Pending Leave');
  });
  it('does not offer approval or correction authority to employees', () => {
    state.ceo = false;
    state.summary.leave = {pending:1,approvedToday:0,upcoming:[],nextApproved:null};
    const html = render();
    expect(html).toContain('Waiting for CEO review');
    expect(html).not.toContain('Awaiting your approval');
    expect(html).not.toContain('dashboard-attention');
  });
  it('keeps empty, loading and failed requests distinct', () => {
    state.summary.holidays = [];
    expect(render()).toContain('No upcoming holidays.');
    state.loading = true;
    expect(render()).not.toContain('No upcoming holidays.');
    state.loading = false;
    state.error = new Error('Synthetic request failed');
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Synthetic request failed');
    expect(html).not.toContain('compact-state');
    expect(html).not.toContain('stat-value');
  });
  it('keeps the dashboard calm when no work needs attention', () => {
    state.summary.tasks = {unfinished:0,overdue:0,work:[]};
    state.summary.leave = {pending:0,approvedToday:0,upcoming:[],nextApproved:null};
    const html = render();
    expect(html).not.toContain('dashboard-attention');
    expect(html).not.toContain('0 overdue');
    expect(html).not.toContain('Awaiting your approval');
  });
});
