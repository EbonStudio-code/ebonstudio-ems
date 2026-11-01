import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink, Badge, Button, Card, Field, PageHeader, Table } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { AsyncForm, Dialog, EmployeePicker, EnumSelect, label, NoRows, Pager, ResourceState, value } from './components';
import type { Task } from './types';
const states = ['TODO','IN_PROGRESS','DONE','CANCELLED'] as const;
function Editor({ task, close }: {task:Task | null; close:()=>void}) {
  const {refresh, notify, base} = useSession();
  const navigate = useNavigate();
  return <Dialog title={task ? 'Edit task' : 'Create task'} close={close}><AsyncForm cancel={close} label="Save task" submit={async form => {
    const row = await api.request<Task>(task ? '/tasks/'+task.id : '/tasks',task ? 'PATCH' : 'POST',{
      ...(task ? {version:task.version} : {}),title:value(form,'title'),description:value(form,'description'),assigneeEmployeeId:value(form,'assigneeEmployeeId'),
      priority:value(form,'priority'),dueDate:value(form,'dueDate') || null});
    refresh();notify('Task saved.');close();navigate(`${base}/tasks/${row.data.id}`);
  }}>
    <Field label="Title"><input name="title" required maxLength={120} defaultValue={task?.title} /></Field>
    <Field label="Description"><textarea name="description" maxLength={5000} rows={4} defaultValue={task?.description} /></Field>
    <EmployeePicker initial={task?.assigneeEmployeeId} name="assigneeEmployeeId" />
    <div className="form-grid"><Field label="Priority"><select name="priority" defaultValue={task?.priority || 'NORMAL'}>{['LOW','NORMAL','HIGH'].map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
      <Field label="Due date (optional)"><input type="date" name="dueDate" defaultValue={task?.dueDate || ''} /></Field></div>
  </AsyncForm></Dialog>;
}
export default function Tasks() {
  const {id} = useParams();
  const {ceo,base,refresh,notify} = useSession();
  const [page,setPage] = useState(1), [state,setState] = useState(''), [priority,setPriority] = useState('');
  const [editing,setEditing] = useState(false);
  const rows = useResource<Task[]>(id ? null : query('/tasks',{page,limit:20,state,priority}));
  const detail = useResource<Task>(id ? '/tasks/'+id : null);
  const task = detail.result?.data;
  return <>{id && <BackLink to={base+'/tasks'}>All tasks</BackLink>}<PageHeader title={id ? 'Task Detail' : ceo ? 'Tasks' : 'My Tasks'} description="Access follows the current assignee. Stale edits never overwrite newer work." actions={ceo && (!id || task) && <Button onClick={() => setEditing(true)}>{id ? 'Edit task' : 'Create task'}</Button>} />
    {id ? <><ResourceState loading={detail.loading} error={detail.error} />{task && <Card title={task.title}><Badge>{label(task.state)}</Badge><p className="live-text">{task.description || 'No description.'}</p><p>Assigned to: {task.assigneeName}</p><p>Priority: {label(task.priority)} · Due: {task.dueDate || 'Not set'}</p>
      {(ceo || task.state !== 'CANCELLED') && <AsyncForm key={task.version} label="Update status" submit={async form => {
        await api.request(`/tasks/${task.id}/status`,'POST',{version:task.version,state:value(form,'state')});refresh();notify('Task status saved.');
      }}><Field label="Task status"><select name="state" defaultValue={task.state}>{states.filter(v => ceo || v !== 'CANCELLED').map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field></AsyncForm>}</Card>}</>
      : <Card><div className="toolbar"><EnumSelect title="Task status" options={states} value={state} change={v => {setState(v);setPage(1);}} /><EnumSelect title="Priority" options={['LOW','NORMAL','HIGH']} value={priority} change={v => {setPriority(v);setPage(1);}} /></div>
        <ResourceState loading={rows.loading} error={rows.error} />{rows.result && <><NoRows count={rows.result.data.length} /><Table headings={['Task','Assignee','Due','Priority','Status']}>{rows.result.data.map(row => <tr key={row.id}><td><Link to={`${base}/tasks/${row.id}`}>{row.title}</Link></td><td>{row.assigneeName}</td><td>{row.dueDate || '—'}</td><td>{label(row.priority)}</td><td><Badge>{label(row.state)}</Badge></td></tr>)}</Table><Pager page={rows.result.pagination} change={setPage} /></>}</Card>}
    {editing && <Editor task={task || null} close={() => setEditing(false)} />}</>;
}
