import { useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Field, FormActions, Modal, PageHeader, Pagination, Person, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import type { Attendance as AttendanceRecord } from '../../core/models';
import { dateKey, duration, formatDate, formatStamp, formatTime } from '../../core/dates';
import AttendanceClockControl from './AttendanceClockControl';
import AttendanceHistory, { AttendanceFilters, AttendanceMonthlySummary } from '../../components/AttendanceHistory';
import { attendanceRange, attendanceTotals, timezoneLabel, validAttendanceRange, type AttendanceRange } from '../../core/attendance-view';
import { useCurrentTime } from '../../core/useCurrentTime';

function RecordDialog({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const { data, ceo, perform } = useWorkspace();
  const person = data.employees.find(e => e.id === record.employeeId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const checkOut = String(form.get('checkOut') ?? '');
    if (perform({ type: 'attendance.correct', id: record.id, checkIn: `${form.get('checkIn')}:00.000Z`, checkOut: checkOut ? `${checkOut}:00.000Z` : null, reason: String(form.get('reason')) }, 'Attendance corrected in the demo; original values retained.')) onClose();
  }
  return <Modal title="Attendance record" onClose={onClose} wide><div className="record-summary"><Person name={person?.name ?? 'Employee'} secondary={formatDate(record.date)} /><Badge>Present</Badge><Badge>{record.checkOut ? 'Clocked out' : 'Clocked in'}</Badge></div>
    <dl className="detail-grid"><dt>Clock in</dt><dd>{formatStamp(record.checkIn, data.settings.timezone)}</dd><dt>Clock out</dt><dd>{record.checkOut ? formatStamp(record.checkOut, data.settings.timezone) : 'Still open'}</dd><dt>Duration</dt><dd>{duration(record.checkIn, record.checkOut)}</dd></dl>
    {record.corrections.length > 0 && <div className="history"><h3>Correction History</h3>{record.corrections.map((c, i) => <div key={i} className="history-item"><strong>{formatStamp(c.at)} · CEO correction</strong><p>{c.reason}</p><small>{formatTime(c.beforeIn)} - {formatTime(c.beforeOut)} → {formatTime(c.afterIn)} - {formatTime(c.afterOut)}</small></div>)}</div>}
    {ceo && <form onSubmit={submit} className="stack"><h3>Correct This Record</h3><p className="muted">Dates are entered in the demo company timezone, UTC. The original work date cannot change.</p><div className="form-grid">
      <Field label="Check-in (UTC)"><input type="datetime-local" name="checkIn" required defaultValue={record.checkIn.slice(0, 16)} /></Field>
      <Field label="Check-out (UTC)" hint="Leave empty only if this record should stay open."><input type="datetime-local" name="checkOut" defaultValue={record.checkOut?.slice(0, 16) ?? ''} /></Field>
      <Field label="Correction reason" wide><textarea name="reason" required maxLength={500} rows={3} /></Field></div>
      <FormActions onCancel={onClose} submitLabel="Save correction" />
    </form>}
    {!ceo && <div className="form-actions"><Button variant="secondary" onClick={onClose}>Close record</Button></div>}
  </Modal>;
}

export default function Attendance() {
  const { data, ceo } = useWorkspace();
  const now = useCurrentTime(60000);
  const today = dateKey(now, data.settings.timezone);
  const [day, setDay] = useState(ceo ? today : '');
  const [employee, setEmployee] = useState('');
  const [range,setRange] = useState<AttendanceRange>('month'), [from,setFrom] = useState(''), [to,setTo] = useState(''), [state,setState] = useState('');
  const filter = range === 'custom' ? {from,to} : attendanceRange(today,range);
  const validRange = validAttendanceRange(filter.from,filter.to);
  const month = attendanceRange(today,'month');
  const totals = attendanceTotals(data.attendance.map(r=>({workDate:r.date,checkOutAt:r.checkOut,
    durationSeconds:r.checkOut ? Math.floor((Date.parse(r.checkOut)-Date.parse(r.checkIn))/1000) : null})),month.from,month.to);
  const [selectedId, setSelectedId] = useState('');
  const records = [...data.attendance].filter(a => ceo ? (!day || a.date === day) && (!employee || a.employeeId === employee) :
    validRange && (!filter.from || a.date >= filter.from) && (!filter.to || a.date <= filter.to) && (!state || (state === 'OPEN' ? !a.checkOut : Boolean(a.checkOut)))).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const pagination = usePagination(records);
  const selected = data.attendance.find(a => a.id === selectedId);
  return <><PageHeader title={ceo ? 'Attendance' : 'My Attendance'} description={`${ceo ? 'Review saved clock-ins and clock-outs.' : 'Clock in when you start, clock out when you finish.'} Times are shown in ${timezoneLabel(data.settings.timezone)}.`} />
    {!ceo && <AttendanceClockControl />}
    {!ceo && <AttendanceMonthlySummary month={month.from} {...totals} />}
    {ceo && <div className="summary-strip"><span><strong>{records.length}</strong> Matching records</span><span><strong>{records.filter(r => !r.checkOut).length}</strong> Open check-ins</span><span><strong>{records.filter(r => r.checkOut).length}</strong> Completed days</span></div>}
    <Card title="Attendance History" className="attendance-history">{ceo ? <div className="toolbar"><Field label="Working date"><input type="date" value={day} onChange={e => { setDay(e.target.value); pagination.setPage(1); }} /></Field>
      {ceo && <Field label="Employee"><select value={employee} onChange={e => { setEmployee(e.target.value); pagination.setPage(1); }}><option value="">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
      <Button variant="secondary" onClick={() => { setDay(''); setEmployee(''); pagination.setPage(1); }}>Clear filters</Button></div> :
      <AttendanceFilters range={range} from={filter.from} to={filter.to} state={state} changeRange={v=>{setRange(v);pagination.setPage(1);if(v==='custom'){setFrom(filter.from);setTo(filter.to);}}}
        changeFrom={v=>{setFrom(v);pagination.setPage(1);}} changeTo={v=>{setTo(v);pagination.setPage(1);}} changeState={v=>{setState(v);pagination.setPage(1);}} />}
      {!validRange && !ceo ? <p role="alert" className="inline-alert error">Choose an end date on or after the start date.</p> :
      <AttendanceHistory timezone={data.settings.timezone} showEmployee={ceo} records={pagination.rows.map(record => {
        const overlap = data.leaves.some(l => l.employeeId === record.employeeId && l.status === 'Approved' && l.days.includes(record.date));
        return {id:record.id,date:record.date,checkIn:record.checkIn,checkOut:record.checkOut,
          seconds:record.checkOut ? Math.floor((Date.parse(record.checkOut)-Date.parse(record.checkIn))/1000) : null,
          employee:<Person name={data.employees.find(e => e.id === record.employeeId)?.name ?? 'Employee'} />,
          review:[record.nonWorking && 'Non-working day',overlap && 'Approved leave overlap'].filter(Boolean).join(', '),
          action:<button className="text-link" onClick={() => setSelectedId(record.id)}>{ceo ? 'View / correct' : 'View record'}<span className="sr-only"> for {record.date}</span></button>};
      })} />}
      {records.length > 0 && <Pagination {...pagination} onChange={pagination.setPage} />}
    </Card>{selected && <RecordDialog record={selected} onClose={() => setSelectedId('')} />}
  </>;
}
