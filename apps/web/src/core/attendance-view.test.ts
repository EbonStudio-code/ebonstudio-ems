import { describe, expect, it } from 'vitest';
import { attendanceHours, attendanceRange, attendanceTimestamp, attendanceTotals, timezoneLabel, validAttendanceRange } from './attendance-view';
import { dateKey } from './dates';

describe('attendance presentation helpers',()=>{
  it.each([
    ['2026-11-01','month','2026-11-01','2026-11-30'],
    ['2024-02-29','month','2024-02-01','2024-02-29'],
    ['2026-12-31','month','2026-12-01','2026-12-31'],
    ['2026-11-01','week','2026-10-26','2026-11-01'],
    ['2026-11-02','week','2026-11-02','2026-11-08'],
  ] as const)('calculates %s %s without browser timezone drift',(day,range,from,to)=>{
    expect(attendanceRange(day,range)).toEqual({from,to});
  });
  it('selects the company-local month across UTC midnight',()=>{
    const today=dateKey('2026-10-31T19:00:00Z','Asia/Kolkata');
    expect(attendanceRange(today,'month').from).toBe('2026-11-01');
  });
  it.each([['','',true],['2026-11-01','',true],['2026-11-02','2026-11-01',false],['2026-02-30','2026-03-01',false]])('validates custom range %s to %s',(from,to,valid)=>{
    expect(validAttendanceRange(String(from),String(to))).toBe(valid);
  });
  it('counts every recorded day, not just one history page',()=>{
    const records=Array.from({length:31},(_,i)=>({workDate:`2026-10-${String(i+1).padStart(2,'0')}`,checkOutAt:'saved',durationSeconds:28800}));
    expect(attendanceTotals(records,'2026-10-01','2026-10-31')).toEqual({present:31,seconds:892800,open:0});
  });
  it('keeps open shifts Present but excludes their incomplete hours',()=>{
    const rows=[{workDate:'2026-11-01',checkOutAt:null,durationSeconds:7200},{workDate:'2026-11-02',checkOutAt:'saved',durationSeconds:3661},
      {workDate:'2026-10-31',checkOutAt:'saved',durationSeconds:28800}];
    expect(attendanceTotals(rows,'2026-11-01','2026-11-30')).toEqual({present:2,seconds:3661,open:1});
    expect(attendanceHours(3661)).toBe('1h 1m');
    expect(attendanceHours(null)).toBe('In progress');
  });
  it('labels India time and uses it for history punches',()=>{
    expect(timezoneLabel('Asia/Calcutta')).toBe('India time');
    expect(timezoneLabel('Europe/London')).toBe('Europe/London');
    expect(attendanceTimestamp('2026-11-01T03:30:00Z','Asia/Kolkata')).toContain('09:00');
    expect(attendanceTimestamp(null,'UTC')).toBe('—');
  });
});
