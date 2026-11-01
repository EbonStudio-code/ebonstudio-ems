import type { ReactNode } from 'react';
import { Badge, Field, Table } from './ui';
import { formatDate } from '../core/dates';
import { attendanceHours, attendanceTimestamp, type AttendanceRange } from '../core/attendance-view';

export function AttendanceFilters({range,from,to,state,changeRange,changeFrom,changeTo,changeState}: {
  range: AttendanceRange; from: string; to: string; state: string;
  changeRange: (range: AttendanceRange) => void; changeFrom: (date: string) => void;
  changeTo: (date: string) => void; changeState: (state: string) => void;
}) {
  return <div className="attendance-filters">
    <Field label="Date range"><select value={range} onChange={e=>changeRange(e.target.value as AttendanceRange)}>
      <option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option>
    </select></Field>
    {range === 'custom' && <><Field label="From date"><input type="date" value={from} max={to || undefined} onChange={e=>changeFrom(e.target.value)} /></Field>
      <Field label="To date"><input type="date" value={to} min={from || undefined} onChange={e=>changeTo(e.target.value)} /></Field></>}
    <Field label="Session state"><select value={state} onChange={e=>changeState(e.target.value)}>
      <option value="">All sessions</option><option value="OPEN">Clocked in</option><option value="CLOSED">Clocked out</option>
    </select></Field>
  </div>;
}

export interface AttendanceHistoryRow {
  id: string; date: string; checkIn: string; checkOut: string | null; seconds: number | null;
  employee?: ReactNode; review: string; action: ReactNode;
}
export default function AttendanceHistory({records,timezone,showEmployee = false}: {
  records: AttendanceHistoryRow[]; timezone: string; showEmployee?: boolean;
}) {
  const stamp = (instant: string | null) => instant ? <time dateTime={instant}>{attendanceTimestamp(instant,timezone)}</time> : '—';
  if (!records.length) return <div className="attendance-empty"><h3>No Attendance Records</h3><p>No clock-ins match this range and session state. Try another range or clock in when you start work.</p></div>;
  return <>
    <div className="attendance-desktop"><Table headings={['Date',...(showEmployee ? ['Employee'] : []),'Clock in','Clock out','Duration','Attendance','Review','Record']}>
      {records.map(r=><tr key={r.id}><td>{formatDate(r.date)}</td>{showEmployee && <td>{r.employee}</td>}
        <td>{stamp(r.checkIn)}</td><td>{stamp(r.checkOut)}</td><td>{attendanceHours(r.seconds)}</td>
        <td><Badge>Present</Badge><small>{r.checkOut ? 'Clocked out' : 'Clocked in'}</small></td>
        <td>{r.review || '—'}</td><td>{r.action}</td></tr>)}
    </Table></div>
    <div className="attendance-days">{records.map(r=><article className="attendance-day" key={r.id}>
      <header><h3>{formatDate(r.date)}</h3><Badge>Present</Badge></header>
      <dl>{showEmployee && <div><dt>Employee</dt><dd>{r.employee}</dd></div>}
        <div><dt>Clock in</dt><dd>{stamp(r.checkIn)}</dd></div><div><dt>Clock out</dt><dd>{stamp(r.checkOut)}</dd></div>
        <div><dt>Duration</dt><dd>{attendanceHours(r.seconds)}</dd></div><div><dt>Session</dt><dd>{r.checkOut ? 'Clocked out' : 'Clocked in'}</dd></div>
        {r.review && <div><dt>Review</dt><dd>{r.review}</dd></div>}</dl>{r.action}
    </article>)}</div>
  </>;
}
export function AttendanceMonthlySummary({month,present,seconds,open}: {month:string;present:number;seconds:number;open:number}) {
  return <section className="attendance-month" aria-label="Monthly attendance summary">
    <div><h2>{formatDate(month,{month:'long',year:'numeric',day:undefined})}</h2><p>Monthly summary</p></div>
    <dl><div><dt>Days present</dt><dd>{present}</dd></div><div><dt>Completed hours</dt><dd>{attendanceHours(seconds)}</dd></div></dl>
    <p className="attendance-month-note">Hours include completed shifts only.{open > 0 && ` ${open} ${open === 1 ? 'shift is' : 'shifts are'} still open.`}</p>
  </section>;
}
