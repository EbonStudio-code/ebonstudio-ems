import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AttendanceClock from './AttendanceClock';
import { attendanceSummary, clockSummary } from '../core/attendance-summary';
import type { Attendance } from '../core/models';

const record = {workDate:'2026-11-02',checkInAt:'2026-11-02T03:30:12.000Z',checkOutAt:null};
const demo: Attendance = {id:'clock-test',employeeId:'emp-1',date:record.workDate,checkIn:record.checkInAt,checkOut:null,nonWorking:false,corrections:[]};

describe('attendance clock states', () => {
  it('shows an actionable unrecorded state without a fixed-time cutoff', () => {
    const state = clockSummary('CHECK_IN', null, null);
    expect(state).toMatchObject({present:false,record:null,action:'Clock in',disabled:false});
    expect(state.description).toContain('Present right away');
  });
  it('marks Present immediately before checkout', () => {
    expect(clockSummary('CHECK_OUT', record, record)).toMatchObject({present:true,action:'Clock out',disabled:false});
  });
  it('retains Present after checkout and prevents another clock-in', () => {
    const completed = {...record,checkOutAt:'2026-11-02T12:30:00.000Z'};
    expect(clockSummary('COMPLETE', null, completed)).toMatchObject({present:true,record:completed,action:'Day completed',disabled:true});
  });
  it('does not count yesterday’s open session as today’s attendance', () => {
    const state = clockSummary('CHECK_OUT', record, null);
    expect(state).toMatchObject({present:false,action:'Clock out',disabled:false});
    expect(state.description).toContain('Today is not marked Present');
  });
  it.each(['NOT_STARTED','CEO_CORRECTION_REQUIRED','UNKNOWN','COMPLETE','CHECK_OUT'])('blocks unsafe action state %s', action => {
    expect(clockSummary(action, null, null).disabled).toBe(true);
  });
  it('honours preview start dates in the company timezone', () => {
    expect(attendanceSummary(undefined, undefined, 'Asia/Kolkata', Date.parse('2026-11-01T18:00:00Z'), '2026-11-02').disabled).toBe(true);
    expect(attendanceSummary(undefined, undefined, 'Asia/Kolkata', Date.parse('2026-11-01T18:30:00Z'), '2026-11-02').disabled).toBe(false);
  });
  it('recognizes company-local midnight without requiring a new UTC day', () => {
    const overnight = {...demo,date:'2026-11-01',checkIn:'2026-11-01T18:00:00.000Z'};
    expect(attendanceSummary(overnight, undefined, 'Asia/Kolkata', Date.parse('2026-11-01T18:31:00.000Z'))).toMatchObject({present:false,action:'Clock out',disabled:false});
  });
  it('does not offer a new day when the previous open record is over 24 hours old', () => {
    expect(attendanceSummary(demo, undefined, 'Asia/Kolkata', Date.parse('2026-11-03T04:00:00Z'))).toMatchObject({present:false,disabled:true,action:'Correction required'});
  });
  it('ignores historical completed records for today', () => {
    expect(attendanceSummary(undefined, {...demo,checkOut:'2026-11-02T12:30:00Z'}, 'UTC', Date.parse('2026-11-03T10:00:00Z'))).toMatchObject({present:false,action:'Clock in'});
  });
});

describe('attendance clock presentation', () => {
  it('keeps dashboard attendance compact without losing actions or saved punches', () => {
    const render = (summary: ReturnType<typeof clockSummary>) => renderToStaticMarkup(<MemoryRouter><AttendanceClock
      summary={summary} timezone="Asia/Kolkata" compact action={<button disabled={summary.disabled}>{summary.action}</button>}
      historyTo="/employee/attendance" /></MemoryRouter>);
    const ready = render(clockSummary('CHECK_IN',null,null));
    expect(ready).toContain('Clock in</button>');
    expect(ready).not.toContain('attendance-live-time');
    expect(ready).not.toContain('attendance-clock-times');
    expect(ready).toContain('href="/employee/attendance"');
    const open = render(clockSummary('CHECK_OUT',record,record));
    expect(open).toContain('09:00:12');
    expect(open).toContain('Today’s shift');
    expect(render(clockSummary('CEO_CORRECTION_REQUIRED',record,null))).toContain('disabled=""');
  });
  it('displays saved server time to the second in the company timezone', () => {
    const html = renderToStaticMarkup(<MemoryRouter><AttendanceClock
      summary={clockSummary('CHECK_OUT',record,record)} timezone="Asia/Kolkata"
      action={<button>Clock out</button>} historyTo="/employee/attendance" /></MemoryRouter>);
    expect(html).toContain('09:00:12');
    expect(html).toContain('dateTime="2026-11-02T03:30:12.000Z"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('>Present</span>');
    expect(html).toContain('Your saved punches appear above.');
    expect(html).toContain('Current time');
    expect(html).toContain('href="/employee/attendance"');
  });
  it('labels preview time honestly and shows no fake timestamp before clock-in', () => {
    const html = renderToStaticMarkup(<AttendanceClock summary={clockSummary('CHECK_IN',null,null)}
      timezone="UTC" preview action={<button>Clock in</button>} />);
    expect(html).toContain('Fictional preview');
    expect(html).toContain('Browser clock');
    expect(html).not.toContain('class="attendance-clock-times"><div><dt>Today’s shift</dt><dd><time');
    expect(html).toContain('>Not started</dd>');
    expect(html).not.toContain('Recorded using server time');
  });
});
