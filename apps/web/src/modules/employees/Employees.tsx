import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, Pencil, Plus, Search, UserRound } from 'lucide-react';
import { Avatar, BackLink, Badge, Button, Card, Confirm, Empty, Field, FormActions, Modal, NotFound, PageHeader, Pagination, Person, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import type { Employee } from '../../core/models';
import { blockers } from '../../core/domain';
import { dateKey, formatDate } from '../../core/dates';
import PhoneField from '../../components/PhoneField';

function Editor({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { perform, data } = useWorkspace();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    if (perform({ type: 'employee.save', id: employee?.id, values: {
      name: get('name'), email: get('email'), code: get('code'), jobTitle: get('jobTitle'),
      department: get('department'), startDate: get('startDate'), phone: get('phone'),
    } }, employee ? 'Employee details saved in this demo.' : 'Demo employee created. No invitation email was sent.')) onClose();
  }
  return <Modal title={employee ? 'Edit Employee' : 'Add Employee'} onClose={onClose}><form onSubmit={submit}>
    <div className="inline-alert info">Use fictional details only. Invitations are simulated.</div>
    <div className="form-grid"><Field label="Full name"><input name="name" required maxLength={120} defaultValue={employee?.name} placeholder="Full name" /></Field>
      <Field label="Work email"><input name="email" type="email" required defaultValue={employee?.email} placeholder="name@example.test" /></Field>
      <Field label="Employee code"><input name="code" required maxLength={30} defaultValue={employee?.code ?? `EMP-${String(data.employees.length + 1).padStart(3, '0')}`} /></Field>
      <Field label="Job title"><input name="jobTitle" required maxLength={100} defaultValue={employee?.jobTitle} /></Field>
      <Field label="Department"><input name="department" required maxLength={100} list="departments" defaultValue={employee?.department} /><datalist id="departments">{[...new Set(data.employees.map(e => e.department))].map(d => <option key={d} value={d} />)}</datalist></Field>
      <Field label="Start date" hint={employee ? 'Locked if attendance or leave history exists.' : undefined}><input name="startDate" type="date" required defaultValue={employee?.startDate ?? dateKey()} /></Field>
      <PhoneField defaultValue={employee?.phone} wide />
    </div><FormActions onCancel={onClose} submitLabel={employee ? 'Save employee' : 'Create demo employee'} />
  </form></Modal>;
}

export default function Employees() {
  const { id } = useParams();
  const { data, ceo, base, person, perform } = useWorkspace();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Employee | null | undefined>();
  const [statusDialog, setStatusDialog] = useState(false);
  const filtered = data.employees.filter(e => `${e.name} ${e.code} ${e.email}`.toLowerCase().includes(search.toLowerCase()) && (!department || e.department === department) && (!status || e.status === status));
  const pagination = usePagination(filtered);
  const selected = ceo ? data.employees.find(e => e.id === id) : person;
  const editDialog = editing !== undefined && <Editor employee={editing} onClose={() => setEditing(undefined)} />;
  if (id || !ceo) {
    if (!selected) return <NotFound to={`${base}/dashboard`} />;
    const pending = blockers(data, selected.id);
    function updatePhone(event: FormEvent<HTMLFormElement>) {
      event.preventDefault(); perform({ type: 'employee.phone', phone: String(new FormData(event.currentTarget).get('phone') ?? '') }, 'Demo phone number updated.');
    }
    return <>{ceo && <BackLink to={`${base}/employees`}>All employees</BackLink>}
      <PageHeader title={ceo ? 'Employee Profile' : 'My Profile'} description="Work details and account information, all in one place." actions={ceo && <Button variant="secondary" onClick={() => setEditing(selected)}><Pencil size={15} />Edit profile</Button>} />
      <div className="profile-hero"><Avatar name={selected.name} large /><div><h2>{selected.name}</h2><p>{selected.jobTitle} · {selected.department}</p><div className="inline"><Badge>{selected.status}</Badge><span className="muted">{selected.code}</span></div></div></div>
      <div className="two-column"><Card title="Work Information"><dl className="detail-grid"><dt>Full name</dt><dd>{selected.name}</dd><dt>Work email</dt><dd>{selected.email}</dd><dt>Employee code</dt><dd>{selected.code}</dd><dt>Department</dt><dd>{selected.department}</dd><dt>Job title</dt><dd>{selected.jobTitle}</dd><dt>Start date</dt><dd>{formatDate(selected.startDate)}</dd><dt>Account</dt><dd><Badge>{selected.account}</Badge></dd></dl></Card>
        <div className="stack"><Card title="Contact Details">{ceo ? <p>{selected.phone || 'No phone number added.'}</p> : <form className="stack" onSubmit={updatePhone}><PhoneField key={selected.id} defaultValue={selected.phone} /><Button type="submit">Update phone</Button></form>}</Card>
          {ceo ? <Card title="Account Actions"><div className="stack">
            {selected.account === 'Invited' && selected.status === 'Active' && <><Button variant="secondary" onClick={() => perform({ type: 'employee.invite', id: selected.id }, 'Invitation resend simulated. No email was sent.')}><Mail size={16} />Simulate resend invitation</Button><Button variant="secondary" onClick={() => perform({ type: 'employee.activate', id: selected.id }, 'Demo account activated. You can select it in the employee preview.')}>Simulate invite acceptance</Button></>}
            <p className="muted">History is retained when an employee is deactivated.</p>
            <Button variant={selected.status === 'Active' ? 'danger' : 'secondary'} onClick={() => setStatusDialog(true)}>{selected.status === 'Active' ? 'Deactivate employee' : 'Reactivate employee'}</Button>
          </div></Card> : <Card title="Need to Change Something?"><p className="muted">Your name, work email, and employment details are managed by the CEO.</p><Link className="text-link" to={`${base}/complaints`}>Contact the CEO through a complaint</Link></Card>}
        </div></div>
      {statusDialog && <Confirm title={selected.status === 'Active' ? 'Deactivate Employee?' : 'Reactivate Employee?'} description={selected.status === 'Active' ? 'Resolve outstanding work first. Deactivation retains the employee history.' : 'Reactivation creates an invited demo account. Simulate invite acceptance afterward.'} reason={selected.status === 'Active'} danger={selected.status === 'Active'} onClose={() => setStatusDialog(false)} onConfirm={reason => perform({ type: 'employee.status', id: selected.id, active: selected.status !== 'Active', reason })}>
        {selected.status === 'Active' && pending.length > 0 && <div className="inline-alert warning"><strong>Resolve these blockers first:</strong><ul>{pending.map(text => <li key={text}>{text}</li>)}</ul></div>}
      </Confirm>}{editDialog}
    </>;
  }
  return <><PageHeader title="Employees" description={`Meet the ${data.employees.length} people in your demo team. Manage their profiles and access.`} actions={<Button onClick={() => setEditing(null)}><Plus size={17} />Add employee</Button>} />
    <div className="summary-strip"><span><UserRound size={17} /><strong>{data.employees.filter(e => e.status === 'Active').length}</strong> Active employees</span><span><strong>{new Set(data.employees.map(e => e.department)).size}</strong> Departments</span><span><strong>{data.employees.filter(e => e.account === 'Invited').length}</strong> Pending invitations</span></div>
    <Card><div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search employees" placeholder="Search name, email, or code..." value={search} onChange={e => { setSearch(e.target.value); pagination.setPage(1); }} /></div>
      <select aria-label="Filter department" value={department} onChange={e => { setDepartment(e.target.value); pagination.setPage(1); }}><option value="">All departments</option>{[...new Set(data.employees.map(e => e.department))].map(d => <option key={d}>{d}</option>)}</select>
      <select aria-label="Filter employee status" value={status} onChange={e => { setStatus(e.target.value); pagination.setPage(1); }}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select></div>
      {filtered.length ? <Table headings={['Employee', 'Department', 'Job title', 'Status', 'Account', 'Action']}>{pagination.rows.map(e => <tr key={e.id}><td><Person name={e.name} secondary={`${e.code} · ${e.email}`} /></td><td>{e.department}</td><td>{e.jobTitle}</td><td><Badge>{e.status}</Badge></td><td><Badge>{e.account}</Badge></td><td><Link className="text-link" to={`${base}/employees/${e.id}`}>View profile</Link></td></tr>)}</Table> : <Empty title="No Matching Employees" description="Try another name or clear the filters." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>{editDialog}
  </>;
}
