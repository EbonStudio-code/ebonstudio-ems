import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AttendanceHistory, { AttendanceFilters, AttendanceMonthlySummary } from './AttendanceHistory';

describe('attendance history presentation',()=>{
  it('hides table headers and pagination in an empty history',()=>{
    const html=renderToStaticMarkup(<AttendanceHistory timezone="UTC" records={[]} />);
    expect(html).toContain('No Attendance Records');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('0 results');
  });
  it('provides a semantic stacked day card as well as the desktop table',()=>{
    const html=renderToStaticMarkup(<AttendanceHistory timezone="Asia/Kolkata" records={[{
      id:'sample',date:'2026-11-01',checkIn:'2026-11-01T03:30:00Z',checkOut:null,seconds:null,review:'Leave at punch',
      action:<a href="/employee/attendance/sample">View record</a>,
    }]} />);
    expect(html).toContain('class="attendance-day"');
    expect(html).toContain('<dt>Clock in</dt>');
    expect(html).toContain('09:00');
    expect(html).toContain('Leave at punch');
    expect(html).toContain('In progress');
  });
  it('only shows date inputs for a custom range and labels each control',()=>{
    const props={from:'2026-11-01',to:'2026-11-30',state:'',changeRange:()=>{},changeFrom:()=>{},changeTo:()=>{},changeState:()=>{}};
    expect(renderToStaticMarkup(<AttendanceFilters {...props} range="month" />)).not.toContain('type="date"');
    const html=renderToStaticMarkup(<AttendanceFilters {...props} range="custom" />);
    expect(html).toContain('From date');expect(html).toContain('Session state');expect(html).toContain('max="2026-11-30"');
  });
  it('does not invent late, absent, scheduled shifts, or open-shift hours',()=>{
    const html=renderToStaticMarkup(<AttendanceMonthlySummary month="2026-11-01" present={1} seconds={0} open={1} />);
    expect(html).toContain('Days present');expect(html).toContain('0h 0m');
    expect(html).toContain('1 shift is still open');
    expect(html).not.toMatch(/Late|Absent|Scheduled/);
  });
});
