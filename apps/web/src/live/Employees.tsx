import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, BackLink, Badge, Button, Card, Field, PageHeader, Person, Table } from '../components/ui';
import { Plus } from 'lucide-react';
import PhoneField from '../components/PhoneField';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { Action, AsyncForm, Dialog, EnumSelect, label, NoRows, Pager, ResourceState, value } from './components';
import type { Employee } from './types';

function Editor({ employee, close }: {employee: Employee | null; close: () => void}) {
  const { refresh, notify, base } = useSession();
  const navigate = useNavigate();
  return <Dialog title={employee ? 'Edit employee' : 'Add employee'} close={close}><AsyncForm label={employee ? 'Save employee' : 'Create employee'} cancel={close} submit={async form => {
    const payload = Object.fromEntries(['fullName','email','employeeCode','jobTitle','department','startDate','phone'].map(key => [key,value(form,key)]));
    const saved = await api.request<Employee>(employee ? '/employees/'+employee.id : '/employees', employee ? 'PATCH' : 'POST', {...payload,...(employee ? {version: employee.version} : {})});
    refresh(); notify(`Employee saved.${saved.data.invitationDelivery ? ' Invitation delivery: '+saved.data.invitationDelivery+'.' : ''}`);
    close(); navigate(base+'/employees/'+saved.data.id);
  }}><p className="muted">{employee ? 'Changing email revokes sessions and requires a fresh setup invitation.' : 'An invite-only account will be created. No default password is assigned.'}</p>
    <div className="form-grid"><Field label="Full name"><input name="fullName" required maxLength={120} defaultValue={employee?.fullName} /></Field>
      <Field label="Work email"><input name="email" type="email" required maxLength={254} defaultValue={employee?.email} /></Field>
      <Field label="Employee code"><input name="employeeCode" required maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" defaultValue={employee?.employeeCode} /></Field>
      <Field label="Job title"><input name="jobTitle" required maxLength={100} defaultValue={employee?.jobTitle} /></Field>
      <Field label="Department"><input name="department" required maxLength={100} defaultValue={employee?.department} /></Field>
      <Field label="Start date"><input name="startDate" type="date" required defaultValue={employee?.startDate} /></Field>
      <PhoneField defaultValue={employee?.phone} wide /></div>
  </AsyncForm></Dialog>;
}
export default function Employees() {
  const { id } = useParams();
  const { ceo, base, refresh, notify } = useSession();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'deactivate' | 'reactivate' | null>(null);
  const detail = Boolean(id || !ceo);
  const selected = useResource<Employee>(detail ? ceo ? '/employees/'+id : '/employees/me' : null);
  const rows = useResource<Employee[]>(!detail ? query('/employees',{page,limit:20,search,department,status}) : null);
  const blockers = useResource<Record<string,number>>(ceo && id ? `/employees/${id}/deactivation-check` : null);
  const employee = selected.result?.data;
  if (detail) return <>{ceo && <BackLink to={base+'/employees'}>All employees</BackLink>}
    <PageHeader title={ceo ? 'Employee Profile' : 'My Profile'} description="Work details, contact information and account access." actions={ceo && employee && <Button variant="secondary" onClick={() => setEditing(true)}>Edit employee</Button>} />
    <ResourceState loading={selected.loading} error={selected.error} />{employee && <>
      <div className="profile-hero"><Avatar name={employee.fullName} large /><div><h2>{employee.fullName}</h2><p>{employee.jobTitle} · {employee.department}</p><Badge>{label(employee.employmentStatus)}</Badge></div></div>
      <div className="two-column"><Card title="Work Information"><dl className="detail-grid">
        <dt>Employee code</dt><dd>{employee.employeeCode}</dd><dt>Work email</dt><dd>{employee.email}</dd><dt>Start date</dt><dd>{employee.startDate}</dd>
        <dt>Account</dt><dd><Badge>{label(employee.accountStatus)}</Badge></dd><dt>Invitation delivery</dt><dd>{employee.invitationDelivery || 'Not requested'}</dd>
        <dt>Phone</dt><dd>{employee.phone || 'Not provided'}</dd></dl></Card>
        <Card title={ceo ? 'Account Actions' : 'My Phone Number'}>{!ceo ? <AsyncForm key={employee.version} label="Update phone" submit={async form => {
          await api.request('/employees/me','PATCH',{version:employee.version,phone:value(form,'phone')}); refresh(); notify('Phone saved.');
        }}><PhoneField defaultValue={employee.phone} /></AsyncForm> : <div className="stack">
          {employee.accountStatus === 'INVITED' && employee.employmentStatus === 'ACTIVE' && <AsyncForm label="Resend invitation" submit={async () => {
            const result = await api.request<{invitationDelivery:string}>(`/employees/${employee.id}/invitation`,'POST',{}); refresh(); notify('Invitation delivery: '+result.data.invitationDelivery);
          }} />}
          <ResourceState loading={blockers.loading} error={blockers.error} />
          {blockers.result && <><h3>Deactivation Checklist</h3><ul>{Object.entries(blockers.result.data).map(([name,count]) => <li key={name}>{name.replace(/[A-Z]/g,c => ' '+c.toLowerCase())}: {count}</li>)}</ul></>}
          <Button variant={employee.employmentStatus === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => setAction(employee.employmentStatus === 'ACTIVE' ? 'deactivate' : 'reactivate')}>{employee.employmentStatus === 'ACTIVE' ? 'Deactivate employee' : 'Reactivate employee'}</Button>
        </div>}</Card></div>
      {editing && <Editor employee={employee} close={() => setEditing(false)} />}
      {action && <Action title={action === 'deactivate' ? 'Deactivate employee' : 'Reactivate employee'} path={`/employees/${employee.id}/${action}`} payload={{version:employee.version}} close={() => setAction(null)} reason={action === 'deactivate'}>
        <p>History is retained. Deactivation revokes access and requires resolving blockers. Reactivation requires fresh password setup.</p>
      </Action>}</>}</>;
  return <><PageHeader title="Employees" eyebrow="YOUR PEOPLE" description="The people behind the work. Manage your team and their access." actions={<Button onClick={() => setEditing(true)}><Plus size={17} aria-hidden="true"/>Add employee</Button>} />
    <Card><div className="toolbar"><Field label="Search name or code"><input placeholder="Find a team member…" maxLength={100} value={search} onChange={e => {setSearch(e.target.value);setPage(1);}} /></Field>
      <Field label="Department"><input placeholder="Filter by department" maxLength={100} value={department} onChange={e => {setDepartment(e.target.value);setPage(1);}} /></Field>
      <EnumSelect title="Employment status" options={['ACTIVE','INACTIVE']} value={status} change={v => {setStatus(v);setPage(1);}} /></div>
      <ResourceState loading={rows.loading} error={rows.error} />{rows.result && <><NoRows count={rows.result.data.length} />
        <Table headings={['Employee','Department','Status','Account','Action']}>{rows.result.data.map(e => <tr key={e.id}><td><Person name={e.fullName} secondary={`${e.employeeCode} · ${e.jobTitle}`}/></td><td>{e.department}</td><td><Badge>{label(e.employmentStatus)}</Badge></td><td><Badge>{label(e.accountStatus)}</Badge></td><td><Link className="text-link" to={`${base}/employees/${e.id}`}>View profile</Link></td></tr>)}</Table>
        <Pager page={rows.result.pagination} change={setPage} /></>}</Card>
    {editing && <Editor employee={null} close={() => setEditing(false)} />}</>;
}
