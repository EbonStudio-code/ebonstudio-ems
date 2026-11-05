import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink, Badge, Button, Card, Field, PageHeader, Table } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { Action, AsyncForm, companyDate, Dialog, EnumSelect, label, NoRows, Pager, PersonLink, ResourceState, timestamp, value } from './components';
import type { Leave as LeaveRow } from './types';
function RequestLeave({close}:{close:()=>void}) {
  const {company,refresh,notify,base} = useSession();
  const navigate = useNavigate();
  const [preview,setPreview] = useState<{payload:{type:string;startDate:string;endDate:string;reason:string};dates:string[];count:number} | null>(null);
  return <Dialog title="Request Leave" close={close}>{preview ? <AsyncForm label="Submit leave request" cancel={close} submit={async () => {
    const row = await api.request<LeaveRow>('/leave/requests','POST',preview.payload);refresh();close();
    notify(`Request saved for ${row.data.dayCount} working day(s). The dates shown in this record are authoritative.`);navigate(`${base}/leave/${row.data.id}`);
  }}><p><strong>{preview.count} working day(s)</strong>, excluding holidays and nonworking weekdays.</p><p className="live-text">{preview.dates.join(', ')}</p>
    <label className="live-check"><input type="checkbox" required />I understand final dates are recalculated when submitted. Existing leave is not silently changed by later holidays.</label></AsyncForm>
    : <AsyncForm label="Preview working dates" cancel={close} submit={async form => {
      const payload = {type:value(form,'type'),startDate:value(form,'startDate'),endDate:value(form,'endDate'),reason:value(form,'reason')};
      const result = await api.request<{workingDatesSnapshot:string[];dayCount:number}>('/leave/preview','POST',{type:payload.type,startDate:payload.startDate,endDate:payload.endDate});
      setPreview({payload,dates:result.data.workingDatesSnapshot,count:result.data.dayCount});
    }}><Field label="Leave type"><select name="type" required>{company!.leaveTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
      <div className="form-grid"><Field label="Start date"><input type="date" name="startDate" min={companyDate(company!.timezone)} required /></Field>
        <Field label="End date"><input type="date" name="endDate" min={companyDate(company!.timezone)} required /></Field></div>
      <Field label="Reason"><textarea name="reason" required maxLength={500} rows={3} /></Field><p className="muted">Full days only, maximum 366 calendar days. This does not calculate leave entitlement or pay.</p>
    </AsyncForm>}</Dialog>;
}
export default function Leave() {
  const {id} = useParams();
  const {ceo,base} = useSession();
  const [page,setPage] = useState(1), [state,setState] = useState('');
  const [create,setCreate] = useState(false), [action,setAction] = useState('');
  const rows = useResource<LeaveRow[]>(id ? null : query('/leave/requests',{page,limit:20,state}));
  const detail = useResource<LeaveRow>(id ? '/leave/requests/'+id : null);
  const row = detail.result?.data;
  return <>{id && <BackLink to={base+'/leave'}>All leave requests</BackLink>}<PageHeader title={id ? 'Leave Request' : ceo ? 'Leave Requests' : 'My Leave'} description="Whole-day requests with stored working-date snapshots and an auditable decision history." actions={!ceo && !id && <Button onClick={() => setCreate(true)}>Request leave</Button>} />
    {id ? <><ResourceState loading={detail.loading} error={detail.error} />{row && <><Card title={row.type}><p><PersonLink id={row.employeeId} /> · <Badge>{label(row.state)}</Badge></p>
      <p>{row.startDate} to {row.endDate} · {row.dayCount} working day(s)</p><p className="live-text">{row.reason}</p><details><summary>Stored working dates</summary><p className="live-text">{row.workingDatesSnapshot.join(', ')}</p></details>
      <div className="page-actions">{ceo && row.state === 'PENDING' && <><Button onClick={() => setAction('approve')}>Approve</Button><Button variant="danger" onClick={() => setAction('reject')}>Reject</Button></>}
        {(row.state === 'PENDING' || (ceo && row.state === 'APPROVED')) && <Button variant="secondary" onClick={() => setAction('cancel')}>{ceo ? 'Cancel leave' : 'Withdraw request'}</Button>}</div></Card>
      <Card title="Decision History">{row.history?.map(h => <article key={h.id} className="live-history"><strong>{label(h.toState)}</strong><small> {timestamp(h.createdAt)}</small><p>{h.reason || 'No additional reason'}</p></article>)}</Card>
      {action && <Action title={label(action)+' Request'} path={`/leave/requests/${row.id}/${action}`} payload={{version:row.version}} close={() => setAction('')} reason={action === 'reject' || (action === 'cancel' && ceo)}><p>Approval retains the stored working dates. Rejection/cancellation releases their reservations.</p></Action>}</>}</>
      : <Card><EnumSelect title="Leave status" options={['PENDING','APPROVED','REJECTED','CANCELLED']} value={state} change={v => {setState(v);setPage(1);}} />
        <ResourceState loading={rows.loading} error={rows.error} />{rows.result && <><NoRows count={rows.result.data.length} /><Table headings={['Type',...(ceo ? ['Employee'] : []),'Dates','Days','Status']}>{rows.result.data.map(l => <tr key={l.id}><td><Link to={`${base}/leave/${l.id}`}>{l.type}</Link></td>{ceo && <td><PersonLink id={l.employeeId} /></td>}<td>{l.startDate} to {l.endDate}</td><td>{l.dayCount}</td><td><Badge>{label(l.state)}</Badge></td></tr>)}</Table><Pager page={rows.result.pagination} change={setPage} /></>}</Card>}
    {create && <RequestLeave close={() => setCreate(false)} />}</>;
}
