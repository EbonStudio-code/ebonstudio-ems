import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BackLink, Badge, Button, Card, Confirm, Empty, Field, FormActions, Modal, NotFound, PageHeader, Pagination, Person, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { dateKey, formatDate, formatStamp, workingDates } from '../../core/dates';
import { leaveStatuses } from '../../core/models';
import type { Leave as LeaveRecord } from '../../core/models';

function RequestForm({ onClose }: { onClose: () => void }) {
  const { data, perform } = useWorkspace();
  const today = dateKey(new Date(), data.settings.timezone);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const days = workingDates(start, end, data.settings.workingDays, data.holidays.map(h => h.date));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (perform({ type: 'leave.create', values: { type: String(form.get('type')) as LeaveRecord['type'], startDate: start, endDate: end, reason: String(form.get('reason')) } }, 'Demo leave request submitted for CEO review.')) onClose();
  }
  return <Modal title="Request Leave" onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <Field label="Leave type" wide><select name="type"><option>Annual</option><option>Sick</option><option>Unpaid</option></select></Field>
    <Field label="Start date"><input type="date" required min={today} value={start} onChange={e => setStart(e.target.value)} /></Field>
    <Field label="End date"><input type="date" required min={start || today} value={end} onChange={e => setEnd(e.target.value)} /></Field>
    <div className="inline-alert info full">{days.length} working day{days.length === 1 ? '' : 's'} requested. Weekends and company holidays are excluded. Full days only.</div>
    <Field label="Reason" wide><textarea name="reason" required maxLength={500} rows={4} placeholder="Add a short reason for your request..." /></Field>
    </div><FormActions onCancel={onClose} submitLabel="Submit leave request" /></form></Modal>;
}

export default function Leave() {
  const { id } = useParams();
  const { data, ceo, base, perform } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  const [employee, setEmployee] = useState('');
  const [action, setAction] = useState<{ record: LeaveRecord; status: LeaveRecord['status'] } | null>(null);
  const filtered = data.leaves.filter(l => (!status || l.status === status) && (!employee || l.employeeId === employee));
  const pagination = usePagination(filtered);
  const selected = data.leaves.find(l => l.id === id);
  const actionDialog = action && <Confirm title={`${action.status === 'Cancelled' ? ceo ? 'Cancel' : 'Withdraw' : action.status === 'Approved' ? 'Approve' : 'Reject'} Leave Request?`}
    description={action.status === 'Approved' ? 'The snapshotted working dates will be marked as approved leave. No salary calculation is affected.' : 'The request history will be retained. Rejected or cancelled requests cannot be edited or reopened.'}
    reason={ceo && action.status !== 'Approved'} danger={action.status !== 'Approved'} onClose={() => setAction(null)}
    onConfirm={reason => perform({ type: 'leave.status', id: action.record.id, status: action.status, reason }, `Demo request marked ${action.status.toLowerCase()}.`)} />;
  if (id) {
    if (!selected) return <NotFound to={`${base}/leave`} />;
    const employee = data.employees.find(e => e.id === selected.employeeId);
    return <><BackLink to={`${base}/leave`}>All leave requests</BackLink><PageHeader title={`${selected.type} Leave Request`} description={`${employee?.name} · ${selected.days.length} working day${selected.days.length === 1 ? '' : 's'}`} actions={<Badge>{selected.status}</Badge>} />
      <div className="two-column"><Card title="Request Details"><dl className="detail-grid"><dt>Employee</dt><dd>{employee?.name}</dd><dt>Leave type</dt><dd>{selected.type}</dd><dt>Start date</dt><dd>{formatDate(selected.startDate)}</dd><dt>End date</dt><dd>{formatDate(selected.endDate)}</dd><dt>Working days</dt><dd>{selected.days.length}</dd></dl><h3>Reason</h3><p className="preserve-lines">{selected.reason}</p><h3>Reserved Date Snapshot</h3><div className="date-chips">{selected.days.map(day => <span key={day}>{formatDate(day)}</span>)}</div>
        <div className="form-actions">{ceo && selected.status === 'Pending' && <><Button variant="danger" onClick={() => setAction({ record: selected, status: 'Rejected' })}>Reject</Button><Button onClick={() => setAction({ record: selected, status: 'Approved' })}>Approve request</Button></>}
          {(selected.status === 'Pending' || (ceo && selected.status === 'Approved')) && <Button variant="secondary" onClick={() => setAction({ record: selected, status: 'Cancelled' })}>{ceo ? 'Cancel request' : 'Withdraw request'}</Button>}</div>
      </Card><Card title="Request History"><div className="history">{selected.history.map((entry, index) => <div className="history-item" key={index}><Badge>{entry.status}</Badge><p>{entry.actor} · {formatStamp(entry.at, data.settings.timezone)}</p>{entry.reason && <small>{entry.reason}</small>}</div>)}</div></Card></div>{actionDialog}
    </>;
  }
  return <><PageHeader title={ceo ? 'Leave Requests' : 'My Leave'} description={ceo ? 'Review requests and keep an eye on team availability.' : 'Plan time away and track the status of your requests.'} actions={!ceo && <Button onClick={() => setCreating(true)}><Plus size={17} />Request leave</Button>} />
    <div className="summary-strip">{(['Pending', 'Approved', 'Rejected'] as const).map(s => <span key={s}><strong>{data.leaves.filter(l => l.status === s).length}</strong>{s}</span>)}</div>
    <div className="inline-alert info">This version tracks requests only. Leave balances, accruals, and payroll deductions are not calculated.</div>
    <Card><div className="toolbar"><select aria-label="Filter leave status" value={status} onChange={e => { setStatus(e.target.value); pagination.setPage(1); }}><option value="">All statuses</option>{leaveStatuses.map(s => <option key={s}>{s}</option>)}</select>
      {ceo && <select aria-label="Filter leave employee" value={employee} onChange={e => { setEmployee(e.target.value); pagination.setPage(1); }}><option value="">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}</div>
      {filtered.length ? <Table headings={[...(ceo ? ['Employee'] : []), 'Type', 'Dates', 'Days', 'Status', 'Action']}>{pagination.rows.map(request => <tr key={request.id}>
        {ceo && <td><Person name={data.employees.find(e => e.id === request.employeeId)?.name ?? 'Employee'} /></td>}<td>{request.type}</td><td>{formatDate(request.startDate)}<small>to {formatDate(request.endDate)}</small></td><td>{request.days.length}</td><td><Badge>{request.status}</Badge></td><td><Link className="text-link" to={`${base}/leave/${request.id}`}>View request</Link></td></tr>)}</Table> : <Empty title="No Matching Leave Requests" description="New requests will appear here." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>{creating && <RequestForm onClose={() => setCreating(false)} />}{actionDialog}
  </>;
}
