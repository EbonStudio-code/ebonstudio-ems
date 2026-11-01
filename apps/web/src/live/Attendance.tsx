import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BackLink, Badge, Button, Card, Field, PageHeader } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { AsyncForm, Dialog, NoRows, Pager, PersonLink, ResourceState, value } from './components';
import type { Attendance as AttendanceRow } from './types';
import AttendanceClockControl from './AttendanceClockControl';
import AttendanceHistory, { AttendanceFilters, AttendanceMonthlySummary } from '../components/AttendanceHistory';
import { attendanceRange, attendanceTimestamp, attendanceTotals, timezoneLabel, validAttendanceRange, type AttendanceRange } from '../core/attendance-view';
import { dateKey } from '../core/dates';
import { useCurrentTime } from '../core/useCurrentTime';
export default function Attendance() {
  const {id} = useParams();
  const {ceo,base,refresh,notify,company,companyError} = useSession();
  const now = useCurrentTime(60000);
  const timezone = company?.timezone || 'UTC';
  const today = dateKey(now,timezone), month = attendanceRange(today,'month');
  const [page,setPage] = useState(1), [range,setRange] = useState<AttendanceRange>('month');
  const [customFrom,setFrom] = useState(''), [customTo,setTo] = useState(''), [state,setState] = useState('');
  const {from,to} = range === 'custom' ? {from:customFrom,to:customTo} : attendanceRange(today,range);
  const validRange = validAttendanceRange(from,to);
  const [correction,setCorrection] = useState(false);
  const rows = useResource<AttendanceRow[]>(id || !company || !validRange ? null : query(ceo ? '/attendance' : '/attendance/me',{page,limit:20,from,to,state}));
  // One record per employee/work date: a whole month fits the existing API's limit of 100.
  // Check the response total too, so partial or malformed responses never become monthly totals.
  const monthly = useResource<AttendanceRow[]>(!ceo && !id && company ? query('/attendance/me',{page:1,limit:100,...month}) : null);
  const completeMonth = monthly.result && monthly.result.pagination?.total === monthly.result.data.length;
  const totals = completeMonth ? attendanceTotals(monthly.result!.data,month.from,month.to) : null;
  const monthError = monthly.error || (monthly.result && !completeMonth ? new Error('The full month could not be loaded. Reload to see your summary.') : undefined);
  const detail = useResource<AttendanceRow>(id ? query('/attendance/'+id,{page,limit:20}) : null);
  const row = detail.result?.data;
  const timestamp = (instant: string | null) => attendanceTimestamp(instant,timezone);
  return <>{id && <BackLink to={base+'/attendance'}>Attendance history</BackLink>}<PageHeader title={id ? 'Attendance Record' : ceo ? 'Attendance' : 'My Attendance'}
    description={ceo ? `Review saved clock-ins and clock-outs.${company ? ` Times are shown in ${timezoneLabel(timezone)}.` : ''}` :
      `Clock in when you start, clock out when you finish.${company ? ` Times are shown in ${timezoneLabel(timezone)}.` : ''}`}
    actions={ceo && row && <Button variant="secondary" onClick={() => setCorrection(true)}>Correct record</Button>} />
    {!ceo && !id && <AttendanceClockControl />}
    {!ceo && !id && (totals ? <AttendanceMonthlySummary month={month.from} {...totals} /> :
      <ResourceState loading={monthly.loading || (!company && !companyError)} error={monthError || companyError} />)}
    {id ? <><ResourceState loading={detail.loading} error={detail.error} />{row && <>
      <Card title={row.workDate}><p><PersonLink id={row.employeeId} /> · <Badge>Present</Badge> · <Badge>{row.state === 'OPEN' ? 'Clocked in' : 'Clocked out'}</Badge></p><dl className="detail-grid">
        <dt>Clock in</dt><dd>{timestamp(row.checkInAt)}</dd><dt>Clock out</dt><dd>{timestamp(row.checkOutAt)}</dd><dt>Duration</dt><dd>{row.durationSeconds === null ? 'Open' : `${Math.floor(row.durationSeconds/3600)}h ${Math.floor(row.durationSeconds%3600/60)}m`}</dd>
        <dt>Nonworking punch</dt><dd>{row.nonWorkingDayFlag ? 'Yes' : 'No'}</dd><dt>Leave at punch time</dt><dd>{row.approvedLeaveFlag ? 'Yes' : 'No'}</dd><dt>Current approved-leave overlap</dt><dd>{row.currentApprovedLeaveOverlap ? 'Yes' : 'No'}</dd></dl></Card>
      <Card title="Correction History">{row.corrections && <><NoRows count={row.corrections.data.length} />{row.corrections.data.map(c => <article className="live-history" key={c.id}><strong>{timestamp(c.createdAt)}</strong><p>{c.reason}</p><p>Before: {timestamp(c.beforeValues.checkInAt)} to {timestamp(c.beforeValues.checkOutAt)}</p><p>After: {timestamp(c.afterValues.checkInAt)} to {timestamp(c.afterValues.checkOutAt)}</p></article>)}<Pager page={row.corrections.pagination} change={setPage} /></>}</Card>
      {correction && <Dialog title="Correct attendance" close={() => setCorrection(false)}><AsyncForm label="Save correction" cancel={() => setCorrection(false)} submit={async form => {
        const out = value(form,'checkOutAt');
        await api.request(`/attendance/${row.id}/corrections`,'POST',{version:row.version,checkInAt:new Date(value(form,'checkInAt')+'Z').toISOString(),
          checkOutAt:out ? new Date(out+'Z').toISOString() : null,reason:value(form,'reason')});
        setCorrection(false);refresh();notify('Correction and prior values saved.');
      }}><p className="inline-alert warning">These edit fields are UTC. Check-in must remain on work date {row.workDate} in company timezone. Empty checkout means OPEN.</p>
        <Field label="Check in (UTC)"><input name="checkInAt" type="datetime-local" step="1" required defaultValue={row.checkInAt.slice(0,19)} /></Field>
        <Field label="Check out (UTC, optional)"><input name="checkOutAt" type="datetime-local" step="1" defaultValue={row.checkOutAt?.slice(0,19) || ''} /></Field>
        <Field label="Correction reason"><textarea name="reason" required maxLength={500} rows={3} /></Field>
      </AsyncForm></Dialog>}</>}</>
      : <Card title="Attendance History" className="attendance-history">
        <AttendanceFilters range={range} from={from} to={to} state={state} changeRange={v=>{setRange(v);setPage(1);if(v==='custom'){setFrom(from);setTo(to);}}}
          changeFrom={v=>{setFrom(v);setPage(1);}} changeTo={v=>{setTo(v);setPage(1);}} changeState={v=>{setState(v);setPage(1);}} />
        {!validRange && <p role="alert" className="inline-alert error">Choose an end date on or after the start date.</p>}
        <ResourceState loading={rows.loading || (!company && !companyError)} error={rows.error || companyError} />
        {rows.result && <><AttendanceHistory timezone={timezone} showEmployee={ceo} records={rows.result.data.map(a=>({
          id:a.id,date:a.workDate,checkIn:a.checkInAt,checkOut:a.checkOutAt,seconds:a.durationSeconds,
          employee:ceo ? <PersonLink id={a.employeeId} /> : undefined,
          review:[a.nonWorkingDayFlag && 'Non-working day',a.approvedLeaveFlag && 'Leave at punch',a.currentApprovedLeaveOverlap && 'Current leave overlap'].filter(Boolean).join(', '),
          action:<Link className="text-link" to={`${base}/attendance/${a.id}`}>View record<span className="sr-only"> for {a.workDate}</span></Link>,
        }))} />{Boolean(rows.result.pagination?.total) && <Pager page={rows.result.pagination} change={setPage} />}</>}
      </Card>}</>;
}
